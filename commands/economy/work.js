require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription(`Work for your Budz!`),
  async execute(interaction) {
    const settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    const dailyWorkPoints = settings.work_points;
    const userId = interaction.member.id;

    let user = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      userId,
    ]);

    // Maak gebruiker aan als die nog niet bestaat
    if (user.length === 0) {
      await execute(
        `INSERT INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, 420, "[]", -1, -1, -1, 0]
      );
      user = await execute(`SELECT * FROM economy WHERE user_id = ?`, [userId]);
    }

    const now = Date.now();
    const lastWorked = user[0].work;
    const oneHour = 60 * 60 * 1000;
    const canWork = lastWorked === -1 || now - lastWorked > oneHour;

    if (canWork) {
      await execute(
        `UPDATE economy SET coins = coins + ?, work = ? WHERE user_id = ?`,
        [dailyWorkPoints, now, userId]
      );

      const claimedEmbed = new EmbedBuilder()
        .setTitle("💼 | You Worked!")
        .setDescription(
          `> You earned **${dailyWorkPoints} Budz™** for working!\n> Come back in **1 hour** to work again.\n### Commands\n> - Use */stats* to view your profile.\n> - Use */richest* to view the economy leaderboard.`
        )
        .setColor("#00b7ff")
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setFooter({ text: `🍃 HighBot` })
        .setTimestamp();

      await interaction.reply({ ephemeral: false, embeds: [claimedEmbed] });
    } else {
      const remaining = Math.floor((lastWorked + oneHour) / 1000); // Discord uses seconds

      const cooldownEmbed = new EmbedBuilder()
        .setTitle("❌ | Too Soon!")
        .setDescription(
          `> You already worked recently.\n> **You can work again in: <t:${remaining}:R>.**`
        )
        .setColor("#00b7ff")
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setFooter({ text: `🍃 HighBot` })
        .setTimestamp();

      await interaction.reply({ ephemeral: true, embeds: [cooldownEmbed] });
    }
  },
};
