require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("weekly")
    .setDescription(`Claim your weekly Budz`),

  async execute(interaction) {
    const settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    const WEEKLY_COOLDOWN = 604_800_000; // 7 days in milliseconds
    const now = Date.now();

    let user = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);

    // Insert default user if not exists
    if (user.length === 0) {
      await execute(
        `INSERT INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [interaction.member.id, 420, "[]", -1, -1, -1, 0]
      );
    }

    // Fetch latest user data
    const newData = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);
    const weeklyClaimPoints = settings.weekly_points;
    const alreadyClaimedWeekly = newData[0].weekly;

    let claimed = false;
    if (
      alreadyClaimedWeekly === -1 ||
      now - alreadyClaimedWeekly > WEEKLY_COOLDOWN
    ) {
      claimed = true;
    }

    if (claimed) {
      await execute(
        `UPDATE economy SET coins = coins + ?, weekly = ? WHERE user_id = ?`,
        [weeklyClaimPoints, now, interaction.member.id]
      );

      const claimedEmbed = new EmbedBuilder()
        .setTitle("💰 | Successfully Claimed!")
        .setDescription(
          `> You have successfully claimed your **Weekly** gift of \`\`${weeklyClaimPoints}\`\` **Budz™**.\n> Please come back next week to claim again!\n### Commands\n> - Use */stats* to view your profile.\n> - Use */richest* to view the economy leaderboard.`
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
      const nextClaimTimestamp = Math.floor(
        (alreadyClaimedWeekly + WEEKLY_COOLDOWN) / 1000
      );

      const claimedEmbed = new EmbedBuilder()
        .setTitle("❌ | Error Claiming Gift!")
        .setDescription(
          `> You've already claimed your **Weekly Budz™**.\n> **You can claim again in**: <t:${nextClaimTimestamp}:R>.`
        )
        .setColor("#00b7ff")
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setFooter({ text: `🍃 HighBot` })
        .setTimestamp();

      await interaction.reply({ ephemeral: true, embeds: [claimedEmbed] });
    }
  },
};
