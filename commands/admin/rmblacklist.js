require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const {
  execute,
  makeid,
  getCurrentDateTime,
  getCurrentTimestamp,
} = require("../../database/database");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("rmblacklist")
    .setDescription(`Remove a channel from the blacklist`)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to remove from blacklist")
        .setRequired(true)
    ),
  async execute(interaction) {
    /**
     * ====================
     * 🚀 Defining Embeds Block START
     * ====================
     */
    let channel = await interaction.options.getChannel("channel");
    const noAdmin = new EmbedBuilder()
      .setTitle(":x: | Invalid Permissions")
      .setDescription(
        `> ⚠️ Dear ${interaction.member}, to use this command, You must be a valid admin of the server.`
      )
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setThumbnail(
        "https://cdn.creazilla.com/cliparts/5626337/red-x-clipart-lg.png"
      )
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setColor("DarkRed");

    const toAdmin = new EmbedBuilder()
      .setTitle("⚠️ | Blacklist Updated - Blacklist Removed")
      .setThumbnail(interaction.member.user.displayAvatarURL())
      .setDescription(
        `> Dear admins, the channel blacklist has been updated. Please view the details down below:\n\n> **Admin:** ${
          interaction.member
        }\n> **Blacklist Type:** ❌ Removal\n> **Removed Channel:** ${channel}\n> **Update Occured At:** <t:${Math.round(
          Date.now() / 1000
        )}:R>`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    const blacklistedAlready = new EmbedBuilder()
      .setTitle(":x: | Channel blacklist not found")
      .setDescription(
        `> Dear ${interaction.member}, the channel you have chosen to remove from the blacklist, ${channel}, has not been blacklisted before.\n### Suggestions\n> - Use \`\`/list\`\` to view the blacklist\n> - \`\`Use /blacklist\`\` to add a blacklist.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    const toUser = new EmbedBuilder()
      .setTitle("⚠️ | Blacklist Updated - Blacklist Removed")
      .setThumbnail(interaction.member.user.displayAvatarURL())
      .setDescription(
        `> You have successfully updated the channel blacklist. Please view the details down below:\n> **Removed Channel:** ${channel}\n> **Update Occured At:** <t:${Math.round(
          Date.now() / 1000
        )}:R>`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();
    /**
     * ====================
     * 🚀 Defining Embeds Block END
     * ====================
     */

    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({ ephemeral: true, embeds: [noAdmin] });
    }

    let blacklistData = await execute(
      `SELECT * FROM blacklist WHERE channel_id = ?`,
      [channel.id]
    );

    if (blacklistData.length == 0) {
      return interaction.reply({
        ephemeral: true,
        embeds: [blacklistedAlready],
      });
    }

    await execute(`DELETE FROM blacklist WHERE channel_id = ?`, [channel.id]);
    const path = require("path");
    const logsPath = path.join(__dirname, "../../logs.json");
    function loadLogs() {
      if (!fs.existsSync(logsPath)) return {};
      return JSON.parse(fs.readFileSync(logsPath, "utf8"));
    }
    const logs = loadLogs();
    let message;
    if (logs["highbotLogging"]) {
      const adminChannel = await interaction.guild.channels.fetch(
        process.env.ADMIN_CHANNEL
      );

      message = await adminChannel.send({ embeds: [toAdmin] });
    }
    if (message) {
      const ActionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(message.url)
          .setLabel("View Admin Log")
          .setEmoji("🚀")
      );

      await interaction.reply({
        ephemeral: true,
        embeds: [toUser],
        components: [ActionRow],
      });
    } else {
      await interaction.reply({
        ephemeral: true,
        embeds: [toUser],
      });
    }
  },
};
