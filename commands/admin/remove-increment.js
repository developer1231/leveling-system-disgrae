const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove-increment")
    .setDescription("Remove an increment entry for a role.")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to remove the increment from.")
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

    const row = await execute(`SELECT * FROM increments WHERE role_id = ?`, [
      role.id,
    ]);

    if (row.length === 0) {
      return interaction.reply({
        content: "❌ This role does not have an increment entry.",
        ephemeral: true,
      });
    }

    await execute(`DELETE FROM increments WHERE role_id = ?`, [role.id]);

    const embed = new EmbedBuilder()
      .setTitle("🗑️ Increment Removed")
      .setDescription(`Removed increment entry for role: ${role}`)
      .setColor("Red")
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
