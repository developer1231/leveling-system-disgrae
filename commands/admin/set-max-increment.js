const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
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
        `> ⚠️ To use this command, You must be a valid admin of the server.`
      )
      .setTimestamp()
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
      .setTitle("✅ Max Increment Updated")
      .setDescription(`> **New Max Increment:** \`${newValue}\``)
      .setColor("Green")
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
