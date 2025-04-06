const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const {
  execute,
  makeid,
  getCurrentDateTime,
  getCurrentTimestamp,
} = require("../../database/database");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("roster")
    .setDescription(`Display the team roster`),
  async execute(interaction) {
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
    let allMemberData = await execute(`SELECT * FROM roster;`);
    let message = "";
    for (const entry of allMemberData) {
      //  await run(`create table if not exists roster (
      //       member_id TEXT PRIMARY KEY
      //       )`);
      //     console.log("created table roster");
      //     await run(`create table if not exists status (
      //       member_id TEXT PRIMARY KEY,
      //       status TEXT,
      //       timestamp TEXT,
      //       approved TEXT,
      //       FOREIGN KEY (member_id) REFERENCES roster(member_id) ON DELETE CASCADEß`);
      let statusData = await execute(
        `SELECT * FROM status WHERE member_id = ?`,
        [entry.member_id]
      );
      message += `\n> <@${entry.member_id}> - ${
        statusData[0].status
      }\n> **Last Status Update**: <t:${Math.round(
        Number(statusData[0].timestamp) / 1000
      )}:R>\n`;
    }

    const toAdmin = new EmbedBuilder()
      .setTitle("📝 | Current Roster")
      .setDescription(
        `> Dear ${interaction.member}, please view the current team roster down below:\n${message}\n### ⚙️ Control Options\n> - Use */delete (user)* to delete a user from the roster.\n> - Use */make-member (user)* to add a user to the roster.\n\n> Unsure about what the statusses mean? Please use */info* to receive more information about all statusses and their meaning.`
      )
      .setTimestamp()
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setColor("White");
    await interaction.reply({ ephemeral: true, embeds: [toAdmin] });
  },
};
