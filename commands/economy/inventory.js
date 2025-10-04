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
    .setName("inventory")
    .setDescription("View your items"),

  async execute(interaction) {
    // Ensure user exists in economy
    await execute(
      `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ? ,?, ?, ?, ? ,?)`,
      [interaction.member.id, 420, "[]", -1, -1, -1, 0]
    );

    // Fetch user data
    let [user] = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);

    let items;
    try {
      items = JSON.parse(user.items || "[]");
    } catch {
      items = [];
    }

    const errorEmbed = (msg) =>
      new EmbedBuilder()
        .setTitle("📦 Inventory")
        .setDescription(`> ${msg}`)
        .setColor("Red")
        .setFooter({ text: "🍃 HighBot" })
        .setTimestamp();

    if (items.length === 0) {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          errorEmbed(
            "Your inventory is empty.\n> Please use */shop* to view the shop and buy items to fill your inventory."
          ),
        ],
      });
    }

    // Pagination setup
    let page = 0;
    const perPage = 7;

    const getPageEmbed = (pageIndex) => {
      const start = pageIndex * perPage;
      const paginated = items.slice(start, start + perPage);

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s Inventory`)
        .setColor("#00b7ff")
        .setFooter({
          text: `Page ${pageIndex + 1} of ${Math.ceil(items.length / perPage)}`,
        })
        .setTimestamp();

      embed.setDescription(
        paginated.length > 0
          ? paginated
              .map((item, i) => {
                let typeText = item.type;
                let extra = "";

                if (item.type === "roles" && item.role_id) {
                  extra = `🎭 **Role:** <@&${item.role_id}>`;
                } else if (item.type === "xp") {
                  extra = `⭐ **Gain:** ${item.gain} **XP**`;
                }

                return `> **${start + i + 1}:  ${item.item} (ID: *${
                  item.id
                }*)**\n> 💰 **Bought for:** ${
                  item.price
                } **Budz**\n> 📂 **Type:** ${mapTypes(typeText)}${
                  extra ? `\n> ${extra}` : ""
                }`;
              })
              .join("\n\n") +
              `\n\n> - You can use your **XP Boosts** using */redeem (id)*.\n> - If you have an item *(xp and role items excluded)*, you can click on the below **'Sell'** button to sell your items back to the shop for **50%** of its price.`
          : `> **No items bought yet.**`
      );

      return embed;
    };

    const getRow = (pageIndex) => {
      const row = new ActionRowBuilder();
      row.addComponents(
        new ButtonBuilder()
          .setCustomId("prev_page")
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId("next_page")
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled((pageIndex + 1) * perPage >= items.length)
      );
      return row;
    };

    const getSellRow = (pageIndex) => {
      const start = pageIndex * perPage;
      const paginated = items.slice(start, start + perPage);

      const row = new ActionRowBuilder();

      // Only add sell buttons for cosmetics
      paginated.forEach((item) => {
        if (item.type === "cosmetic") {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`sell_${item.id}`)
              .setLabel(`Sell ${item.item}`)
              .setStyle(ButtonStyle.Danger)
          );
        }
      });

      return row.components.length > 0 ? row : null;
    };

    // Initial reply
    const initialComponents = [getRow(page)];
    const sellRow = getSellRow(page);
    if (sellRow) initialComponents.push(sellRow);

    const message = await interaction.reply({
      embeds: [getPageEmbed(page)],
      components: initialComponents,
      ephemeral: false,
    });

    const collector = message.createMessageComponentCollector({
      time: 60_000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        const notYourInventory = new EmbedBuilder()
          .setTitle("❌ Not your inventory")
          .setDescription(
            "> You cannot interact with someone else's inventory.\n> To open your own inventory, please use */inventory*."
          )
          .setColor("Red")
          .setFooter({ text: "🍃 HighBot" })
          .setTimestamp();
        return i.reply({ ephemeral: true, embeds: [notYourInventory] });
      }

      if (i.customId === "prev_page") page--;
      else if (i.customId === "next_page") page++;
      else if (i.customId.startsWith("sell_")) {
        const itemId = i.customId.replace("sell_", "");
        const itemIndex = items.findIndex((x) => x.id === itemId);

        if (itemIndex === -1) {
          const notFound = new EmbedBuilder()
            .setTitle("❌ Item not found")
            .setDescription(
              "> That item could not be found in your inventory. Maybe you have already sold or redemeed it?"
            )
            .setColor("Red")
            .setFooter({ text: "🍃 HighBot" })
            .setTimestamp();
          return i.reply({ ephemeral: true, embeds: [notFound] });
        }

        const item = items[itemIndex];

        if (item.type !== "cosmetic") {
          const notCosmetic = new EmbedBuilder()
            .setTitle("❌ Cannot sell")
            .setDescription(
              "> Only cosmetic items can be sold.\n> Roles and XP Boosts are unsellable."
            )
            .setColor("Red")
            .setFooter({ text: "🍃 HighBot" })
            .setTimestamp();
          return i.reply({ ephemeral: true, embeds: [notCosmetic] });
        }

        const refund = Math.floor(item.price / 2);
        items.splice(itemIndex, 1);

        await execute(
          `UPDATE economy SET items = ?, coins = coins + ? WHERE user_id = ?`,
          [JSON.stringify(items), refund, interaction.member.id]
        );

        const soldEmbed = new EmbedBuilder()
          .setTitle("💰 Item Sold")
          .setDescription(
            `> You successfully sold **${item.item}** for \`\`${refund}\`\` **Budz™**!`
          )
          .setColor("#00b7ff")
          .setFooter({ text: "🍃 HighBot" })
          .setTimestamp();

        await i.reply({ ephemeral: false, embeds: [soldEmbed] });
      }

      // Refresh embed
      const newComponents = [getRow(page)];
      const newSellRow = getSellRow(page);
      if (newSellRow) newComponents.push(newSellRow);

      await message.edit({
        embeds: [getPageEmbed(page)],
        components: newComponents,
      });
    });
  },
};
