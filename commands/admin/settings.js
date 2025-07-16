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
    .setName("settings")
    .setDescription(`Leveling settings`)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Set the levelup channel")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("levelup")
        .setDescription("Set the levelup notification level")
        .addChoices(
          {
            name: `✅ Enabled`,
            value: "true",
          },
          {
            name: `❌ Disabled`,
            value: "false",
          }
        )
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

    const toSetChannel = interaction.options.getChannel("channel");
    const levelup = interaction.options.getString("levelup");

    let config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    let flags = "";

    if (levelup !== null) {
      flags += `\n> Set leveling notifications to ${
        levelup === "true" ? "Enabled ✅" : "Disabled ❌"
      }`;
      config.level_up = levelup === "true";
    }

    if (toSetChannel) {
      flags += `\n> Set leveling notification channel to ${toSetChannel}`;
      config.channel_id = toSetChannel.id;
    }

    fs.writeFileSync("./settings.json", JSON.stringify(config, null, 2));

    let enabledLevelUpMessages = config.level_up ? "Enabled ✅" : "Disabled ❌";
    let channel = await interaction.guild.channels.fetch(config.channel_id);

    const dashboard = new EmbedBuilder()
      .setTitle("🚀 | Level Up Message Dashboard")
      .setDescription(
        `> Below you can find the server configuration regarding the level up messages.\n\n> \`\`Level Up Messages:\`\` ${enabledLevelUpMessages}\n> \`\`Channel:\`\` ${channel}\n### Updates\n${
          flags.length > 0 ? flags : "> No changes made to the dashboard"
        }.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();
    const toAdmin = new EmbedBuilder()
      .setTitle("⚠️ | Leveling Settings Updated")
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp()
      .setDescription(
        `> Dear admins, the leveling settings have been updated. Please view the details down below:\n\n> **Admin:** ${
          interaction.member
        }\n${flags}\n> **Update Occured At:** <t:${Math.round(
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
      ephemeral: true,
      embeds: [dashboard],
      components: [ActionRow],
    });
  },
};
