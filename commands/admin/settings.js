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
    .setDescription("Leveling settings")
    .addChannelOption((option) =>
      option.setName("channel").setDescription("Set the levelup channel")
    )
    .addStringOption((option) =>
      option
        .setName("levelup")
        .setDescription("Enable or disable levelup notification")
        .addChoices(
          { name: "✅ Enabled", value: "true" },
          { name: "❌ Disabled", value: "false" }
        )
    ),

  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: "🚫 Admin only command.",
      });
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

    const enabledLevelUpMessages = config.level_up
      ? "Enabled ✅"
      : "Disabled ❌";
    const channel = config.channel_id
      ? await interaction.guild.channels.fetch(config.channel_id)
      : "`❌ Not set`";

    const dashboard = new EmbedBuilder()
      .setTitle("🚀 | Level Up Message Dashboard")
      .setDescription(
        `> **Notifications:** ${enabledLevelUpMessages}\n> **Channel:** ${channel}\n> **Message:** ${
          config.levelup_message || "`❌ Not set`"
        }\n### Updates\n${flags.length > 0 ? flags : "> No changes made."}`
      )
      .setColor("#00b7ff");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("edit_level_message")
        .setLabel("Edit Level Message")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      ephemeral: true,
      embeds: [dashboard],
      components: [row],
    });
  },
};
