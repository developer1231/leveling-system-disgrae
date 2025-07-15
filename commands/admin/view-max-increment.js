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
    const config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));

    const embed = new EmbedBuilder()
      .setTitle("⚙️ | Current Max Increment")
      .setDescription(
        `> **Max Increment:** \`\`${config.max_increment}\`\`\n### Suggestions\n> - \`\`/set-max-increment\`\`: to set the maximum increment.\n> - \`\`/add-increment\`\`: to set add a role increment.\n> - \`\`/remove-increment\`\`: to remove a role increment.\n> - \`\`/list-increments\`\`: to list all role increments.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `⚡️ Dank Bot` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
