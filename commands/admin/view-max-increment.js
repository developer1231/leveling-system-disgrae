const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("view-max-increment")
    .setDescription("View the current max increment value from settings.")
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
    const config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Current Max Increment")
      .setDescription(`> **Max Increment:** \`${config.max_increment}\``)
      .setColor("Blue")
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
