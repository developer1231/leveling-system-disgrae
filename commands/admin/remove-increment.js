const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

    console.log(role);
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
    const roleId = role.id;
    const embed = new EmbedBuilder()
      .setTitle("🗑️ | Increment Removed")
      .setDescription(
        `> Removed increment entry for role: <@&${roleId}>\n### Suggestions\n> - \`\`/set-max-increment\`\`: to set the maximum increment.\n> - \`\`/add-increment\`\`: to set add a role increment.\n> - \`\`/remove-increment\`\`: to remove a role increment.\n> - \`\`/list-increments\`\`: to list all role increments.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
       .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();
    const toAdmin = new EmbedBuilder()
      .setTitle("⚠️ | Increment List Updated - Increment removed")
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
        }\n> **Increment List Type:** ❌ Removal\n> **Removed Role:** ${role}\n> **Update Occured At:** <t:${Math.round(
          Date.now() / 1000
        )}:R>`
      );
    const adminChannel = await interaction.guild.channels.fetch(
      process.env.ADMIN_CHANNEL
    );

    let message = await adminChannel.send({ embeds: [toAdmin] });
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
  },
};
