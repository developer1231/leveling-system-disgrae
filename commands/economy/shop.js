require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { execute } = require("../../database/database");

function mapTypes(type) {
  if (type === "roles") return `⚡️ Role`;
  if (type === "xp") return `🚀 XP Boost`;
  return `🔥 Cosmetic`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription(`Display the shop`),

  async execute(interaction) {
    let shopItems = await execute(`SELECT * FROM shop`);

    let user = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);

    if (user.length === 0) {
      await execute(
        `INSERT INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [interaction.member.id, 420, "[]", -1, -1, -1, 0]
      );
    }

    if (shopItems.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle("❌ No Items Found")
        .setDescription("> The shop is currently empty.")
        .setColor("Red")
        .setFooter({ text: "🍃 HighBot" })
        .setTimestamp();
      return interaction.reply({ ephemeral: true, embeds: [emptyEmbed] });
    }
    shopItems = shopItems.sort((x, y) => y.price - x.price);
    const pageSize = 7;
    const pages = [];
    for (let i = 0; i < shopItems.length; i += pageSize) {
      pages.push(shopItems.slice(i, i + pageSize));
    }

    let currentPage = 0;

    const generateEmbed = (pageIndex) => {
      const items = pages[pageIndex]
        .map((item) => {
          let gainText = "";
          if (item.type === "roles" && item.role_id) {
            gainText = `\n> **Role:** <@&${item.role_id}>`;
          } else if (item.type === "xp" && item.gain > 0) {
            gainText = `\n> **Redeemable:** ✅ - **${item.gain} XP**`;
          }
          return (
            `> **Name:** ${item.item} *(ID: ${item.id})*` +
            `\n> **Type:** ${mapTypes(item.type)}` +
            `${gainText}\n> **Price:** ${item.price} Budz™`
          );
        })
        .join("\n\n");

      return new EmbedBuilder()
        .setTitle("💰 | Budz™ Shop")
        .setDescription(
          `> Use */inventory* to view your items.\n> **XP boosts** can be redeemed with */redeem*.\n\n${items}`
        )
        .setColor("#00b7ff")
        .setFooter({
          text: `🍃 HighBot | Page ${pageIndex + 1}/${pages.length}`,
        })
        .setTimestamp();
    };

    const generateButtons = (pageIndex) => {
      const buttons = pages[pageIndex].map((item) =>
        new ButtonBuilder()
          .setCustomId(`buy_${item.id}`)
          .setLabel(`Buy ${item.item}`)
          .setStyle(ButtonStyle.Success)
      );

      const navButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("⬅️ Prev")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("Next ➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === pages.length - 1)
      );

      const itemRow = new ActionRowBuilder().addComponents(buttons.slice(0, 5));
      const itemRow2 =
        buttons.length > 5
          ? new ActionRowBuilder().addComponents(buttons.slice(5))
          : null;

      return [navButtons, itemRow, itemRow2].filter(Boolean);
    };

    const msg = await interaction.reply({
      embeds: [generateEmbed(currentPage)],
      components: generateButtons(currentPage),
      ephemeral: false,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      time: 600000,
    });

    collector.on("collect", async (btnInt) => {
      if (btnInt.user.id !== interaction.user.id)
        return btnInt.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Unauthorized")
              .setDescription("> his shop menu isn’t for you.")
              .setColor("Red"),
          ],
        });

      if (btnInt.customId === "prev_page") {
        currentPage--;
        await btnInt.update({
          embeds: [generateEmbed(currentPage)],
          components: generateButtons(currentPage),
        });
      } else if (btnInt.customId === "next_page") {
        currentPage++;
        await btnInt.update({
          embeds: [generateEmbed(currentPage)],
          components: generateButtons(currentPage),
        });
      } else if (btnInt.customId.startsWith("buy_")) {
        const itemId = btnInt.customId.split("buy_")[1];

        const [shopItem] = await execute(`SELECT * FROM shop WHERE id = ?`, [
          itemId,
        ]);
        if (!shopItem)
          return btnInt.reply({
            ephemeral: true,
            embeds: [
              new EmbedBuilder()
                .setTitle("❌ Item Not Found")
                .setDescription("> This item no longer exists in the shop.")
                .setColor("Red"),
            ],
          });

        let [user] = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
          btnInt.user.id,
        ]);

        if (!user) {
          await execute(
            `INSERT INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [btnInt.user.id, 420, "[]", -1, -1, -1, 0]
          );
          [user] = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
            btnInt.user.id,
          ]);
        }

        if (user.coins < shopItem.price) {
          return btnInt.reply({
            ephemeral: true,
            embeds: [
              new EmbedBuilder()
                .setTitle("❌ Not Enough Budz™")
                .setDescription(
                  `> You need **${shopItem.price} Budz™**, but you only have **${user.coins} Budz™**.`
                )
                .setColor("Red"),
            ],
          });
        }

        // Load user items
        let items = [];
        try {
          items = JSON.parse(user.items || "[]");
        } catch (e) {}

        // Prevent duplicates for roles/cosmetics
        const alreadyOwns = items.some((i) => i.id === shopItem.id);
        if (
          alreadyOwns &&
          (shopItem.type === "roles" || shopItem.type === "cosmetic")
        ) {
          return btnInt.reply({
            ephemeral: true,
            embeds: [
              new EmbedBuilder()
                .setTitle("❌ Already Owned")
                .setDescription(
                  `> You already own **${shopItem.item}**!\n> Please view your inventory using */inventory*.`
                )

                .setAuthor({
                  name: `${interaction.client.user.username}`,
                  iconURL: `${interaction.client.user.displayAvatarURL()}`,
                })
                .setFooter({ text: `🍃 HighBot` })
                .setTimestamp()

                .setColor("Red"),
            ],
          });
        }

        // Deduct coins
        await execute(
          `UPDATE economy SET coins = coins - ? WHERE user_id = ?`,
          [shopItem.price, btnInt.user.id]
        );

        // Store full item object

        items.push({
          id: shopItem.id,
          item: shopItem.item,
          type: shopItem.type,
          price: shopItem.price,
          gain: shopItem.gain,
          role_id: shopItem.role_id,
          boughtAt: Date.now(),
        });

        await execute(`UPDATE economy SET items = ? WHERE user_id = ?`, [
          JSON.stringify(items),
          btnInt.user.id,
        ]);

        // Role assignment
        if (shopItem.type === "roles" && shopItem.role_id) {
          const role = await btnInt.guild.roles.fetch(shopItem.role_id);
          if (role) await btnInt.member.roles.add(role).catch(() => {});
          return btnInt.reply({
            ephemeral: true,
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ Purchase Successful")
                .setDescription(
                  `> You bought **${shopItem.item}** for ${shopItem.price} **Budz™** and received the role <@&${shopItem.role_id}>!`
                )
                .setColor("#00b7ff"),
            ],
          });
        }

        // XP boost
        if (shopItem.type === "xp") {
          return btnInt.reply({
            ephemeral: true,
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ Purchase Successful")
                .setDescription(
                  `> You bought an **XP Booster** worth **${shopItem.gain} XP**!\n### Instructions\n> - Use */inventory* to view your inventory\n> - Use */redeem (ID)* to redeem this **XP booster!**`
                )
                .setColor("#00b7ff"),
            ],
          });
        }

        // Cosmetic
        return btnInt.reply({
          ephemeral: true,
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Purchase Successful")
              .setDescription(
                `> You bought A new Cosmetic Item! **Congratulations!**\n> **Item:** ${shopItem.item}\n> **Price**: ${price} **Budz™**\n### Instructions\n> - Use */inventory* to view all of your items.`
              )
              .setColor("#00b7ff"),
          ],
        });
      }
    });
  },
};
