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
        `> ⚠️ Dear ${interaction.member}, to use this command, You must be a valid admin of the server.`
      )
      .setFooter({ text: `⚡️ Dank Bot` })
      .setTimestamp()
      .setThumbnail(
        "https://cdn.creazilla.com/cliparts/5626337/red-x-clipart-lg.png"
      )
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setColor("DarkRed");

    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({ ephemeral: true, embeds: [noAdmin] });
    }

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
        `${channelString}\n### Commands\n> - \`/blacklist\`: blacklist a channel from XP gaining.\n> - \`/rmblacklist\`: remove a channel from the blacklist.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `⚡️ Dank Bot` })
      .setTimestamp();

    await interaction.reply({
      ephemeral: true,
      embeds: [embed],
    });
  },
};
