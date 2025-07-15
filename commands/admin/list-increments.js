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
    const rows = await execute(`SELECT * FROM increments`);

    if (rows.length === 0) {
      return interaction.reply({
        content: "❌ No increments found.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("📄 | Increment List")
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `⚡️ Dank Bot` })
      .setTimestamp();

    let description =
      "> Please view the increment list below.\n### Suggestions\n> - ``/set-max-increment``: to set the maximum increment.\n> - ``/add-increment``: to set add a role increment.\n> - ``/remove-increment``: to remove a role increment.\n> - ``/list-increments``: to list all role increments.\n\n";
    for (const row of rows) {
      const role = await interaction.guild.roles
        .fetch(row.role_id)
        .catch(() => null);
      if (role) {
        description += `> • ${role} — **${row.increment}**\n`;
      } else {
        description += `> • <@&${row.role_id}> (not found) — **${row.increment}**\n`;
      }
    }

    embed.setDescription(description);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
