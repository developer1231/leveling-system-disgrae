require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const {
  execute,
  makeid,
  getCurrentDateTime,
  getCurrentTimestamp,
} = require("../../database/database");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("change-status")
    .setDescription(`Take a status action`)
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Type of status to set")
        .setRequired(true)
        .addChoices(
          { name: `🔴|⛑️ Sick Leave`, value: `🔴|⛑️ Sick Leave` },
          {
            name: `🔴|⏱️ Long Term Leave`,
            value: `🔴|⏱️ Long Term Leave`,
          },
          {
            name: `🔴|👤 Personal Leave`,
            value: `🔴|👤 Personal Leave`,
          },
          {
            name: `🔴 Casual Leave`,
            value: `🔴 Casual Leave`,
          },
          {
            name: `🟢 Active`,
            value: `🟢 Active`,
          }
        )
    ),
  async execute(interaction) {
    let newStatus = interaction.options.getString("status");
    let userData = await execute(`SELECT * FROM roster WHERE member_id = ?`, [
      interaction.member.id,
    ]);
    if (userData.length == 0) {
      const Embed = new EmbedBuilder()
        .setTitle(":x: | Invalid Permissions")
        .setDescription(
          `> To use this command, you must be part of the team roster.\n> Please refrain from using this command.`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("DarkRed");

      return interaction.reply({ ephemeral: true, embeds: [Embed] });
    }
    const oldStatus = userData[0].status;
    const lastUpdated = userData[0].timestamp;
    if (newStatus == "🟢 Active") {
      // set status, and send message.
      const adminChannel = await interaction.guild.channels.fetch(
        process.env.ADMIN_CHANNEL
      );
      const toAdmin = new EmbedBuilder()
        .setTitle("⚠️ | Roster Updated - User Status Changed")
        .setThumbnail(interaction.member.user.displayAvatarURL())
        .setDescription(
          `> Dear admins, the roster changed as a user just changed their status. Please view the details down below:\n\n> **User:** ${
            interaction.member
          }\n> **Previous Status:** ${oldStatus}\n> **New Status:** ${newStatus}\n> **Previous Update Occured At:** <t:${Math.round(
            lastUpdated / 1000
          )}:R>`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("White");
      await adminChannel.send({ embeds: [toAdmin] });
      await execute(
        `UPDATE status SET status = ?, timestamp = ? WHERE member_id = ?`,
        [newStatus, getCurrentDateTime(), interaction.member.id]
      );
      await interaction.reply({
        ephemeral: true,
        content: `> :white_check_mark: You have successfully updated your status!`,
      });
    } else {
      await execute(`UPDATE status SET approved = ? WHERE member_id = ?`, [
        newStatus,
        interaction.member.id,
      ]);
      const modal = new ModalBuilder()
        .setCustomId("reason-modal")
        .setTitle("Provide Reason For Leave");

      const favoriteColorInput = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Provide reason for the leave:")
        .setStyle(TextInputStyle.Paragraph);

      const hobbiesInput = new TextInputBuilder()
        .setCustomId("duration")
        .setLabel("Duration in days, e.g. 12")
        .setStyle(TextInputStyle.Short);

      const firstActionRow = new ActionRowBuilder().addComponents(
        favoriteColorInput
      );
      const secondActionRow = new ActionRowBuilder().addComponents(
        hobbiesInput
      );

      modal.addComponents(firstActionRow, secondActionRow);
      await interaction.showModal(modal);
    }
  },
};
