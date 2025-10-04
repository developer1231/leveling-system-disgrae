require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("all-roles")
    .setDescription(`View all leveling roles`),
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

    const rolesData = await execute(`SELECT * FROM roles`, []);

    let roleString = "";

    if (rolesData.length === 0) {
      roleString = "> ✅ No leveling roles are currently setup.";
    } else {
      const roleMentions = await Promise.all(
        rolesData.map(async (entry) => {
          try {
            const role = await interaction.guild.roles.fetch(entry.role_id);
            return rolesData
              ? `<@&${role.id}> - **Level:** ${entry.level}`
              : `Unknown Role (${entry.role_id})`;
          } catch {
            return `Unknown Role (${entry.role_id})`;
          }
        })
      );

      roleString = roleMentions.map((ch) => `> ${ch}`).join("\n");
    }

    const embed = new EmbedBuilder()
      .setTitle("⚡️ | All Leveling Roles")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(
        `${roleString}\n### Commands\n> - \`/add-role\`: add a role to a level.\n> - \`/remove-role\`: remove a leveling role.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    await interaction.reply({
      ephemeral: true,
      embeds: [embed],
    });
  },
};
