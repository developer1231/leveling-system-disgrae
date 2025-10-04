require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription(`Economy settings`)
    .addIntegerOption((option) =>
      option.setName("daily").setDescription("Set the daily points amount")
    )
    .addIntegerOption((option) =>
      option.setName("weekly").setDescription("Set the weekly points amount")
    )
    .addIntegerOption((option) =>
      option.setName("work").setDescription("Set the work command reward")
    )
    .addIntegerOption((option) =>
      option
        .setName("levelup")
        .setDescription("Set the points rewarded on level up")
    )
    .addIntegerOption((option) =>
      option.setName("giftcap").setDescription("Set the daily gift cap")
    ),

  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
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

      return interaction.reply({ ephemeral: true, embeds: [noAdmin] });
    }

    const daily = interaction.options.getInteger("daily");
    const weekly = interaction.options.getInteger("weekly");
    const work = interaction.options.getInteger("work");
    const levelup = interaction.options.getInteger("levelup");
    const giftcap = interaction.options.getInteger("giftcap");

    let config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    let flags = "";

    if (daily !== null) {
      config.daily_points = daily;
      flags += `\n> Set daily reward to \`${daily}\` points`;
    }
    if (weekly !== null) {
      config.weekly_points = weekly;
      flags += `\n> Set weekly reward to \`${weekly}\` points`;
    }
    if (work !== null) {
      config.work_points = work;
      flags += `\n> Set work reward to \`${work}\` points`;
    }
    if (levelup !== null) {
      config.level_up_points = levelup;
      flags += `\n> Set level-up reward to \`${levelup}\` points`;
    }
    if (giftcap !== null) {
      config.daily_gift_cap = giftcap;
      flags += `\n> Set daily gift cap to \`${giftcap}\` points`;
    }

    fs.writeFileSync("./settings.json", JSON.stringify(config, null, 2));

    const summaryEmbed = new EmbedBuilder()
      .setTitle("💰 | Economy Settings Dashboard")
      .setDescription(
        `> Here is the current configuration for your server economy:\n\n` +
          `> \`\`Daily:\`\` ${config.daily_points} pts\n` +
          `> \`\`Weekly:\`\` ${config.weekly_points} pts\n` +
          `> \`\`Work:\`\` ${config.work_points} pts\n` +
          `> \`\`Level Up:\`\` ${config.level_up_points} pts\n` +
          `> \`\`Daily Gift Cap:\`\` ${config.daily_gift_cap} pts\n` +
          `### Updates\n${flags.length > 0 ? flags : "> No changes made"}`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    const toAdmin = new EmbedBuilder()
      .setTitle("⚠️ | Economy Settings Updated")
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setDescription(
        `> Dear admins, the economy settings have been updated. Please view the details down below:\n\n> **Admin:** ${
          interaction.member
        }\n${flags}\n> **Update Occured At:** <t:${Math.round(
          Date.now() / 1000
        )}:R>`
      );
    const path = require("path");
    const logsPath = path.join(__dirname, "./logs.json");
    function loadLogs() {
      if (!fs.existsSync(logsPath)) return {};
      return JSON.parse(fs.readFileSync(logsPath, "utf8"));
    }
    const logs = loadLogs();
    if (logs["highbotLogging"]) {
      const adminChannel = await interaction.guild.channels.fetch(
        process.env.ADMIN_CHANNEL
      );

      const logMessage = await adminChannel.send({ embeds: [toAdmin] });
    }
    const ActionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(logMessage.url)
        .setLabel("View Admin Log")
        .setEmoji("💼")
    );

    await interaction.reply({
      ephemeral: true,
      embeds: [summaryEmbed],
      components: [ActionRow],
    });
  },
};
