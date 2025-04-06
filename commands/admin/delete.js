require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
// todo : add admin messages
const {
  execute,
  makeid,
  getCurrentDateTime,
  getCurrentTimestamp,
} = require("../../database/database");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("delete")
    .setDescription(`Delete a member from the team`)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to demote")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the deletion")
        .setRequired(true)
    ),
  async execute(interaction) {
    let user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason");
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      const Embed = new EmbedBuilder()
        .setTitle(":x: | Invalid Permissions")
        .setDescription(
          `> To use this command, you must have the required **Administrator** permissions.`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("DarkRed");
      return interaction.reply({ ephemeral: true, embeds: [Embed] });
    }
    let existingUser = await execute(
      `SELECT * FROM roster WHERE member_id = ?`,
      [user.id]
    );
    if (existingUser.length == 0) {
      const Embed = new EmbedBuilder()
        .setTitle(":x: | User doesn't exist")
        .setDescription(
          `> This command is used to delete users from the team roster such that they are unable to use the */action* command.\n\n> This user, ${user}, however, doesn't exist in the database and therefore is not yet part of the team. You cannot remove the user.\n### ⚙️ Control Options\n> - To add the user to the roster, use */make-member (${user})*\n> - To view the current roster, use */roster*.`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("DarkRed");
      return interaction.reply({ ephemeral: true, embeds: [Embed] });
    }
    await execute(`DELETE FROM roster WHERE member_id = ?`, [user.id]);
    const toAdmin = new EmbedBuilder()
      .setTitle(":white_check_mark: | Action Succesful")
      .setDescription(
        `> The user has successfully been removed from the roster.\n> They will now be unable to use the following commands:\n> - */action*\n### ⚙️ Control Options\n> - */roster*: To view the full roster\n> - */delete (user)*: To remove a user from the roster\n> - */make-member (user)*: To add a user to the roster.`
      )
      .setTimestamp()
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setColor("White");
    await interaction.reply({ ephemeral: true, embeds: [toAdmin] });
    try {
      const toMember = new EmbedBuilder()
        .setTitle(":x: | Removed from roster")
        .setDescription(
          `> Dear ${user}, admin ${
            interaction.member
          } has removed you from the team roster.\n> **Provided reason by ${
            interaction.member
          }**: ${
            reason ? reason : "No reason provided"
          }.\n> ### What does this mean?\n> You have been removed from the team roster, meaning that you are not part of the team anymore.\n> You are unable to use the */action* command anymore.`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("White");
      await user.send({ ephemeral: false, embeds: [toMember] });
    } catch (e) {}
    const adminChannel = await interaction.guild.channels.fetch(
      process.env.ADMIN_CHANNEL
    );

    const toMember = new EmbedBuilder()
      .setTitle("⚠️ | Roster Updated - Member Removed")
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setDescription(
        `> Dear admins, the roster has been updated as a member has been removed from the roster. Please check the details down below:\n\n> **Removed member**: ${user}\n> **Admin:** ${
          interaction.member
        }\n> **Reason:** ${
          reason ? reason : "No reason specified"
        }.\n> **Occured at:** ${getCurrentDateTime()}\n### ⚙️ Control Options\n> - */roster*: To view the full roster\n> - */delete (user)*: To remove a user from the roster\n> - */make-member (user)*: To add a user to the roster.`
      )
      .setTimestamp()
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setColor("White");
    await adminChannel.send({ embeds: [toMember] });
  },
};
