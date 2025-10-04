const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gift")
    .setDescription("Gift Budz to another user.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to gift Budz to")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Amount of Budz to gift")
        .setRequired(true)
    ),

  async execute(interaction) {
    const settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    const senderId = interaction.member.id;
    const receiver = interaction.options.getUser("user");
    const amount = interaction.options.getInteger("amount");

    let user = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);

    if (user.length === 0) {
      await execute(
        `INSERT INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [interaction.member.id, 420, "[]", -1, -1, -1, 0]
      );
    }

    // Fetch fresh data
    const newData = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);
    const gift_cap = newData[0].gift_cap;
    const MAX_GIFT_CAP = settings.daily_gift_cap;

    // helper to reply with error embed
    const errorEmbed = (msg) =>
      new EmbedBuilder()
        .setTitle("🚫 | Error")
        .setDescription(`> ${msg}`)
        .setColor("Red")

        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setFooter({ text: `🍃 HighBot` })
        .setTimestamp();

    if (gift_cap + amount > MAX_GIFT_CAP) {
      const maxToSend = Math.max(0, MAX_GIFT_CAP - gift_cap);
      if (maxToSend === 0) {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            errorEmbed(
              `You cannot send anymore **Budz™** as you've hit the daily **${MAX_GIFT_CAP} Budz™** gifting cap!`
            ),
          ],
        });
      } else {
        return interaction.reply({
          ephemeral: true,
          embeds: [
            errorEmbed(
              `You can only send **${maxToSend} Budz™** as there's a daily **${MAX_GIFT_CAP} Budz™** gifting cap!`
            ),
          ],
        });
      }
    }

    if (receiver.id === senderId) {
      return interaction.reply({
        ephemeral: true,
        embeds: [errorEmbed("You can't gift **Budz™** to yourself!")],
      });
    }

    if (amount <= 0) {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          errorEmbed("You must gift a **positive** amount of **Budz™**!"),
        ],
      });
    }

    const sender = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      senderId,
    ]);
    if (sender.length === 0) {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          errorEmbed(
            "You are not registered in the economy system yet. Please, use */daily* to get yourself registered."
          ),
        ],
      });
    }

    if (sender[0].coins < amount) {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          errorEmbed(
            `> You don't have enough **Budz™**.\n>You only have **${sender[0].coins} Budz™**.`
          ),
        ],
      });
    }

    // Ensure receiver exists
    const receiverData = await execute(
      `SELECT * FROM economy WHERE user_id = ?`,
      [receiver.id]
    );
    if (receiverData.length === 0) {
      await execute(
        `INSERT INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [receiver.id, 420, "[]", -1, -1, -1, 0]
      );
    }

    // Transfer coins
    await execute(
      `UPDATE economy SET coins = coins - ?, gift_cap = gift_cap + ? WHERE user_id = ?`,
      [amount, amount, senderId]
    );
    await execute(`UPDATE economy SET coins = coins + ? WHERE user_id = ?`, [
      amount,
      receiver.id,
    ]);

    // Success embed
    const embed = new EmbedBuilder()
      .setTitle("🎁 | Budz Gifted!")
      .setDescription(
        `> You have successfully gifted **${amount} Budz™** to ${receiver}.\n> **Spread the love! 🌱**`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    const toReceiver = new EmbedBuilder()
      .setTitle("🎁 | Budz Received!")
      .setDescription(
        `> You have received **${amount} Budz™** from ${interaction.member}.\n> **Spread the love! 🌱**`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();
      try {
      await receiver.send({embeds: [toReceiver]})
      } catch(e){
        console.log(e)
      }

    await interaction.reply({ ephemeral: true, embeds: [embed] });
  },
};
