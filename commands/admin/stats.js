const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { execute } = require("../../database/database");
const { getLevelFromXP, getXpFromLevel } = require("../../calculator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("View your XP and activity stats"),

  async execute(interaction) {
    const userId = interaction.user.id;


    const userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
      userId,
    ]);

    if (!userData || userData.length === 0) {
      return interaction.reply({
        content: "❌ You don't have any stats yet.",
        ephemeral: true,
      });
    }

    const user = userData[0];

   
    const xpNeededForNextLevel = getXpFromLevel(user.current_level + 1);
    const xpNeededForCurrentLevel = getXpFromLevel(user.current_level);

    const xpToNextLevel = xpNeededForNextLevel - user.xp;
    const xpCurrentGained = user.xp - xpNeededForCurrentLevel;

   
    const totalSeconds = user.voice * 60;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats for ${interaction.user.username}`)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(
        `> - You can use **/profile** to view your current profile.\n> - **/leaderboard** displays the current leaderboard.`
      )
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .addFields(
        {
          name: `⚡️ Stats`,
          value: `**${user.messages}** messages\n**${hours}h ${minutes}m ${seconds}s** in voice`,
          inline: true,
        },
        {
          name: "🚀 Experience",
          value: `Level ${user.current_level}\n**${xpCurrentGained}** / ${xpNeededForNextLevel} XP\n${user.xp} total XP`,
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
      ephemeral: true,
    });
  },
};
