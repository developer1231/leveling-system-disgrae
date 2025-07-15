require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
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
          `> ⚠️ To use this command, you must be a valid admin of the server.`
        )
        .setTimestamp()
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

    // Save updated config
    fs.writeFileSync("./settings.json", JSON.stringify(config, null, 2));

    // Update display strings after changes
    let enabledLevelUpMessages = config.level_up ? "Enabled ✅" : "Disabled ❌";
    let channel = await interaction.guild.channels.fetch(config.channel_id);

    const dashboard = new EmbedBuilder()
      .setTitle("🚀 | Level Up Message Dashboard")
      .setDescription(
        `> Below you can find the server configuration regarding the level up messages.\n\n> \`\`Level Up Messages:\`\` ${enabledLevelUpMessages}\n> \`\`Channel:\`\` ${channel}\n\n### Updates\n${
          flags.length > 0 ? flags : "> No changes made to the dashboard"
        }.`
      )
      .setTimestamp()
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setColor("DarkRed");

    await interaction.reply({ ephemeral: true, embeds: [dashboard] });
  },
};
