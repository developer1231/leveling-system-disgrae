const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list-increments")
    .setDescription("List all roles with their increment values.")
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
    const rows = await execute(`SELECT * FROM increments`);

    if (rows.length === 0) {
      return interaction.reply({
        content: "❌ No increments found.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("📄 Increment List")
      .setColor("Blue")
      .setTimestamp();

    let description = "";
    for (const row of rows) {
      const role = await interaction.guild.roles
        .fetch(row.role_id)
        .catch(() => null);
      if (role) {
        description += `• ${role} — **${row.increment}**\n`;
      } else {
        description += `• <@&${row.role_id}> (not found) — **${row.increment}**\n`;
      }
    }

    embed.setDescription(description);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
