const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-max-increment")
    .setDescription("Set a new max increment value in settings.")
    .addIntegerOption((option) =>
      option
        .setName("value")
        .setDescription("The new max increment value.")
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
    const newValue = interaction.options.getInteger("value");

    const config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    config.max_increment = newValue;

    fs.writeFileSync("./settings.json", JSON.stringify(config, null, 2));

    const embed = new EmbedBuilder()
      .setTitle("✅ | Max Increment Updated")
      .setDescription(
        `> **New Max Increment:** \`\`${newValue}\`\`.\n### Suggestions\n> - \`\`/set-max-increment\`\`: to set the maximum increment.\n> - \`\`/add-increment\`\`: to set add a role increment.\n> - \`\`/remove-increment\`\`: to remove a role increment.\n> - \`\`/list-increments\`\`: to list all role increments.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();
    const toAdmin = new EmbedBuilder()
      .setTitle("⚠️ | Increment Settings Updated - Max Increment Set")
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setDescription(
        `> Dear admins, the increment settings have been updated. Please view the details down below:\n\n> **Admin:** ${
          interaction.member
        }\n> **Increment Type:** ⚙️ Settings Change\n> **Set Max Increment:** ${newValue}\n> **Update Occured At:** <t:${Math.round(
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
