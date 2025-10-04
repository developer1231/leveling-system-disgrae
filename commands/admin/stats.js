const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { execute } = require("../../database/database");
const { getLevelFromXP, getXpFromLevel } = require("../../calculator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View XP and activity stats")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to view the stats of")
        .setRequired(false)
    ),

  async execute(interaction) {
    const userP =
      interaction.options.getUser("user") ?? interaction.member.user;
    const userId = userP.id;

    const userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
      userId,
    ]);
    await execute(
      `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ? ,?, ?, ?, ? ,?)`,
      [userId, 420, "[]", -1, -1, -1, 0]
    );
    const economyData = await execute(
      `SELECT * FROM economy WHERE user_id = ?`,
      [userId]
    );
    if (!userData || userData.length === 0) {
      return interaction.reply({
        content: `> ❌ This user ${interaction.options.getUser(
          "user"
        )} doesn't have any stats yet.`,
        ephemeral: true,
      });
    }

    const user = userData[0];

    const xpNeededForNextLevel = getXpFromLevel(user.current_level + 1);
    const xpNeededForCurrentLevel = getXpFromLevel(user.current_level);

    const xpToNextLevel = xpNeededForNextLevel - user.xp;
    const xpCurrentGained = user.xp;

    const totalSeconds = user.voice * 60;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats for ${userP.username}`)
      .setThumbnail(userP.displayAvatarURL())
      .setDescription(
        `> - You can use **/rank** to view your current rank.\n> - **/leaderboard** displays the current leaderboard.`
      )
      .setAuthor({
        name: userP.username,
        iconURL: userP.displayAvatarURL(),
      })
      .addFields(
        {
          name: `⚡️ Stats`,
          value: `**${user.messages}** messages\n**${hours}h ${minutes}m ${seconds}s** in voice`,
          inline: true,
        },
        {
          name: "🚀 Experience",
          value: `Level ${user.current_level}\n**${xpCurrentGained}** / ${xpNeededForNextLevel} XP`,
          inline: true,
        },
        {
          name: `💰 Budz™`,
          value: `${economyData[0].coins}`,
          inline: true,
        }
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  },
};
