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
    .setName("add-role")
    .setDescription(`Add a leveling role`)
    .addRoleOption((option) =>
      option.setName("role").setDescription("The role to add").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("level")
        .setDescription("The level members reach to get the role")
        .setRequired(true)
    ),
  async execute(interaction) {
    /**
     * ====================
     * 🚀 Defining Embeds Block START
     * ====================
     */
    let role = await interaction.options.getRole("role");
    let level = await interaction.options.getInteger("level");

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
      .setTitle("⚠️ | Leveling Roles Updated - Role added")
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setDescription(
        `> Dear admins, the leveling roles list has been updated. Please view the details down below:\n\n> **Admin:** ${
          interaction.member
        }\n> **Leveling List Type:** ✅ Added\n> **Added Role:** ${role}\n> **Tied Level:** ${level}\n> **Update Occured At:** <t:${Math.round(
          Date.now() / 1000
        )}:R>`
      );

    const blacklistedAlready = new EmbedBuilder()
      .setTitle(":x: | Role already tied to level")
      .setDescription(
        `> Dear ${interaction.member}, the role you have chosen to tie to level ${level}, ${role}, has already been tied to another level before.\n### Suggestions\n> - Use \`\`/all-roles\`\` to view the leveling list\n> - \`\`Use /remove-role\`\` to remove a role.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    const toUser = new EmbedBuilder()
      .setTitle("⚠️ | Leveling Roles Updated - Role added")
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setDescription(
        `> Dear ${
          interaction.member
        }, the leveling roles list has been updated. Please view the details down below:\n\n> **Leveling List Type:** ✅ Added\n> **Added Role:** ${role}\n> **Tied Level:** ${level}\n> **Update Occured At:** <t:${Math.round(
          Date.now() / 1000
        )}:R>`
      );
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

    let rolesData = await execute(`SELECT * FROM roles WHERE role_id = ?`, [
      role.id,
    ]);

    if (rolesData.length > 0) {
      return interaction.reply({
        ephemeral: true,
        embeds: [blacklistedAlready],
      });
    }

    await execute(`INSERT INTO roles (role_id, level) VALUES (?, ?)`, [
      role.id,
      level,
    ]);
    const path = require("path");
     const logsPath = path.join(__dirname, "../../logs.json");
    function loadLogs() {
      if (!fs.existsSync(logsPath)) return {};
      return JSON.parse(fs.readFileSync(logsPath, "utf8"));
    }
    let message;
    const logs = loadLogs();
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
