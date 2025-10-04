require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const cache = require("../../cache"); // Make sure this points to your invite cache module

module.exports = {
  data: new SlashCommandBuilder()
    .setName("invites")
    .setDescription("Check the number of invites a user has")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Select a user to check their invites")
        .setRequired(false)
    ),
  async execute(interaction) {
    // --- Permissions check ---
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      const noAdmin = new EmbedBuilder()
        .setTitle(":x: | Invalid Permissions")
        .setDescription(
          `> ⚠️ Dear ${interaction.member}, to use this command, you must be a valid admin of the server.`
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

      return interaction.reply({ ephemeral: true, embeds: [noAdmin] });
    }

    // --- Target user ---
    const target = interaction.options.getUser("user") || interaction.user;

    // --- Fetch invites from cache ---
    const guildInvites = cache.getGuildInvites(interaction.guild.id);
    let totalInvites = 0;

    guildInvites.forEach((data) => {
      if (data.inviterId === target.id) totalInvites += data.uses;
    });

    // --- Embed ---
    const embed = new EmbedBuilder()
      .setTitle(`📊 | Invite Count`)
      .setDescription(
        `> ${target} has **${totalInvites}** invite${
          totalInvites === 1 ? "" : "s"
        }!`
      )
      .setColor("#00b7ff")
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      });

    await interaction.reply({ ephemeral: true, embeds: [embed] });
  },
};
