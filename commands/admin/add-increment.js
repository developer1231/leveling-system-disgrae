const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("add-increment")
    .setDescription("Add or update an increment value for a role.")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to add or update.")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("increment")
        .setDescription("The increment value.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
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
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({ ephemeral: true, embeds: [noAdmin] });
    }
    const role = interaction.options.getRole("role");
    const increment = interaction.options.getInteger("increment");

    await execute(
      `INSERT OR REPLACE INTO increments (role_id, increment) VALUES (?, ?)`,
      [role.id, increment]
    );

    const embed = new EmbedBuilder()
      .setTitle("✅ | Increment Added")
      .setDescription(
        `> **Role:** ${role}\n> **Increment:** ${increment}\n### Suggestions\n> - \`\`/set-max-increment\`\`: to set the maximum increment.\n> - \`\`/add-increment\`\`: to set add a role increment.\n> - \`\`/remove-increment\`\`: to remove a role increment.\n> - \`\`/list-increments\`\`: to list all role increments.`
      )
      .setColor("#00b7ff")
      .setThumbnail(interaction.guild.iconURL())
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();
    const toAdmin = new EmbedBuilder()
      .setTitle("⚠️ | Increment List Updated - Increment added")
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setDescription(
        `> Dear admins, the increment list has been updated. Please view the details down below:\n\n> **Admin:** ${
          interaction.member
        }\n> **Increment List Type:** ✅ Added\n> **Added Role:** ${role}\n> **Set Increment:** ${increment}\n> **Update Occured At:** <t:${Math.round(
          Date.now() / 1000
        )}:R>`
      );
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
        embeds: [embed],
        ephemeral: true,
        components: [ActionRow],
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }
  },
};
