require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list")
    .setDescription(`View all blacklisted channels`),
  async execute(interaction) {
    const noAdmin = new EmbedBuilder()
      .setTitle(":x: | Invalid Permissions")
      .setDescription(
        `> ⚠️ To use this command, you must be a valid admin of the server.`
      )
      .setTimestamp()
      .setAuthor({
        name: interaction.client.user.username,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setColor("DarkRed");

    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({ ephemeral: true, embeds: [noAdmin] });
    }

    // Get all blacklisted channels for this guild
    const blacklistData = await execute(`SELECT * FROM blacklist`, []);

    let channelString = "";

    if (blacklistData.length === 0) {
      channelString = "> ✅ No channels are currently blacklisted.";
    } else {
      const channelMentions = await Promise.all(
        blacklistData.map(async (entry) => {
          try {
            const channel = await interaction.guild.channels.fetch(
              entry.channel_id
            );
            return channel
              ? `<#${channel.id}>`
              : `Unknown Channel (${entry.channel_id})`;
          } catch {
            return `Unknown Channel (${entry.channel_id})`;
          }
        })
      );

      channelString = channelMentions.map((ch) => `> ${ch}`).join("\n");
    }

    const embed = new EmbedBuilder()
      .setTitle("📃 | Blacklisted Channels")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(
        `${channelString}\n\n### Commands\n> - \`/blacklist\`: blacklist a channel from XP gaining.\n> - \`/rmblacklist\`: remove a channel from the blacklist.`
      )
      .setTimestamp()
      .setAuthor({
        name: interaction.client.user.username,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setColor("White");

    await interaction.reply({
      ephemeral: true,
      embeds: [embed],
    });
  },
};
