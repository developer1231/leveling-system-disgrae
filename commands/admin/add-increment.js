const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
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
    const role = interaction.options.getRole("role");
    const increment = interaction.options.getInteger("increment");

    await execute(
      `INSERT OR REPLACE INTO increments (role_id, increment) VALUES (?, ?)`,
      [role.id, increment]
    );

    const embed = new EmbedBuilder()
      .setTitle("✅ Increment Added")
      .setDescription(`Role: ${role}\nIncrement: **${increment}**`)
      .setColor("Green")
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
