const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const fs = require("fs");
const n = require("../../config.json");
const {
  execute,
  makeid,
  getCurrentDateTime,
  getCurrentTimestamp,
} = require("../../database/database");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("make-member")
    .setDescription(`Make a member a team member`)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to promote")
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
        .setColor("#6488EA");
      return interaction.reply({ ephemeral: true, embeds: [Embed] });
    }
    let existingUser = await execute(
      `SELECT * FROM roster WHERE member_id = ?`,
      [user.id]
    );
    if (existingUser.length > 0) {
      const Embed = new EmbedBuilder()
        .setTitle(":x: | User already exists")
        .setDescription(
          `> This command is used to add new users to the team roster such that they are able to use the */action* command.\n\n> This user, ${user}, already exists in the database and is already part of the team. You cannot add the user again.\n⚙️ ### Control Options\n> - To delete the user, use */delete (${user})*\n> - To view the current roster, use */roster*.`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("#6488EA");
      return interaction.reply({ ephemeral: true, embeds: [Embed] });
    }
    await execute(`INSERT INTO roster(member_id) VALUES (?)`, [user.id]);
    await execute(
      `INSERT INTO status(member_id, status, timestamp, approved) VALUES (?, ?, ? ,?)`,
      [user.id, "🟢 Active", getCurrentTimestamp(), "true"]
    );
    const toAdmin = new EmbedBuilder()
      .setTitle(":white_check_mark: | Action Succesful")
      .setDescription(
        `> The user has successfully been added to the roster.\n> They will now be able to use the following commands:\n> - */action*\n⚙️ ### Control Options\n> - */roster*: To view the full roster\n> - */delete (user)*: To remove a user from the roster.`
      )
      .setTimestamp()
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setColor("#6488EA");
    await interaction.reply({ ephemeral: true, embeds: [toAdmin] });
    try {
      const toMember = new EmbedBuilder()
        .setTitle(":white_check_mark: | Added to roster")
        .setDescription(
          `> Dear ${user}, admin ${
            interaction.member
          } has added you to the team roster.\n> **Reason provided by ${
            interaction.member
          }**: ${
            reason ? reason : "No reason provided"
          }.\n> ### What does this mean?\n> You have been added to the team roster, meaning that you are now part of the team. You must oblige to the following rules:\n> - If your status is **Active**, you must be active. Failing to do so can lead to termination of team perks.\n> - You are allowed to request leaves and or change your status using */action*.\n> - A leave notice doesn't officially start until the date you entered, and UNTIL AN ADMIN ACCEPTS YOUR NOTICE.\n\n> **Remember, an admin may deny your request.**\n\n> **🎉 Good luck, and welcome to the team!**`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("#6488EA");
      return user.send({ ephemeral: false, embeds: [toMember] });
    } catch (e) {}
  },
};
