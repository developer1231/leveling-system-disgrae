require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription(`Claim your daily Budz`),

  async execute(interaction) {
    const settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    const DAILY_COOLDOWN = 86_400_000; // 24 hours in milliseconds
    const now = Date.now();

    let user = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);

    // If user doesn't exist in DB, insert default row
    if (user.length === 0) {
      await execute(
        `INSERT INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [interaction.member.id, 420, "[]", -1, -1, -1, 0]
      );
    }

    // Fetch fresh user data
    const newData = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);
    const dailyClaimPoints = settings.daily_points;
    const alreadyClaimedDaily = newData[0].daily;

    let claimed = false;

    if (
      alreadyClaimedDaily === -1 ||
      now - alreadyClaimedDaily > DAILY_COOLDOWN
    ) {
      claimed = true;
    }

    if (claimed) {
      await execute(
        `UPDATE economy SET coins = coins + ?, daily = ? WHERE user_id = ?`,
        [dailyClaimPoints, now, interaction.member.id]
      );

      const claimedEmbed = new EmbedBuilder()
        .setTitle("💰 | Successfully Claimed!")
        .setDescription(
          `> You have successfully claimed your **Daily** gift of \`\`${dailyClaimPoints}\`\` **Budz™**.\n> Come back in 24h to claim more!\n### Commands\n> - Use */stats* to view your profile.\n> - Use */richest* to view the economy leaderboard.`
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
        (alreadyClaimedDaily + DAILY_COOLDOWN) / 1000
      );

      const claimedEmbed = new EmbedBuilder()
        .setTitle("❌ | Error Claiming Gift!")
        .setDescription(
          `> You've already claimed your **Daily Budz™**.\n> **You can claim again in:** <t:${nextClaimTimestamp}:R>.`
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
