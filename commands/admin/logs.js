require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const logsPath = path.join(__dirname, "../../logs.json");

// Default log keys with initial values
const defaultLogs = {
  highbotLogging: true,
  vcLogs: true,
  messageEdits: true,
  messageDeletes: true,
  channelCreate: true,
  channelEdit: true,
  channelDelete: true,
  roleCreate: true,
  roleEdit: true,
  roleDelete: true,
  roleUpdate: true,
  memberKick: true,
  memberBan: true,
  memberUnban: true,
  memberTimeout: true,
  guildMemberAdd: true,
  guildMemberRemove: true,
};

// -----------------------------
// JSON helpers
// -----------------------------
function loadLogs() {
  let data = {};
  if (fs.existsSync(logsPath)) {
    data = JSON.parse(fs.readFileSync(logsPath, "utf8"));
  }

  // Merge defaults without overwriting existing values
  data = { ...defaultLogs, ...data };

  return data;
}

function saveLogs(data) {
  fs.writeFileSync(logsPath, JSON.stringify(data, null, 2));
}

// -----------------------------
// Slash Command
// -----------------------------
module.exports = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("View and toggle logging settings"),
  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: "> ❌ Only admins can manage logs.",
      });
    }

    let logs = loadLogs();
    let lastAction = "No actions yet.";

    // -----------------------------
    // Embed generator
    // -----------------------------
    function createEmbed() {
      return new EmbedBuilder()
        .setTitle("⚙️ Logging Dashboard")
        .setDescription(
          `Select a log category below to toggle ON/OFF.\n\n**Last action:** ${lastAction}`
        )
        .setColor("#00b7ff")
        .setTimestamp();
    }

    // -----------------------------
    // Dropdown options
    // -----------------------------
    function createOptions() {
      return Object.keys(defaultLogs).map((key) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(key.charAt(0).toUpperCase() + key.slice(1))
          .setDescription(
            `Toggle ${key} logs (currently ${logs[key] ? "ON ✅" : "OFF ❌"})`
          )
          .setValue(key)
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("logs_select")
      .setPlaceholder("Select a log to toggle")
      .addOptions(createOptions())
      .setMinValues(1)
      .setMaxValues(1);

    // Buttons for Enable/Disable All
    const enableAllBtn = new ButtonBuilder()
      .setCustomId("enable_all")
      .setLabel("Enable All")
      .setStyle(ButtonStyle.Success);

    const disableAllBtn = new ButtonBuilder()
      .setCustomId("disable_all")
      .setLabel("Disable All")
      .setStyle(ButtonStyle.Danger);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      enableAllBtn,
      disableAllBtn
    );

    const message = await interaction.reply({
      embeds: [createEmbed()],
      components: [row1, row2],
      ephemeral: true,
      fetchReply: true,
    });

    // -----------------------------
    // Collector
    // -----------------------------
    const collector = message.createMessageComponentCollector({
      time: 1000 * 60 * 10,
    });

    collector.on("collect", async (i) => {
      if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return i.reply({
          ephemeral: true,
          content: "❌ Only admins can toggle logs.",
        });
      }

      // -----------------------------
      // Handle dropdown toggle
      // -----------------------------
      if (i.isStringSelectMenu()) {
        const value = i.values[0];
        logs[value] = !logs[value];

        saveLogs(logs);

        lastAction = `\`${value}\` toggled ${logs[value] ? "ON ✅" : "OFF ❌"}`;

        // Update dropdown
        const updatedSelect = new StringSelectMenuBuilder()
          .setCustomId("logs_select")
          .setPlaceholder("Select a log to toggle")
          .addOptions(createOptions())
          .setMinValues(1)
          .setMaxValues(1);

        await i.update({
          embeds: [createEmbed()],
          components: [
            new ActionRowBuilder().addComponents(updatedSelect),
            row2,
          ],
        });
      }

      // -----------------------------
      // Handle Enable All / Disable All buttons
      // -----------------------------
      if (i.isButton()) {
        const enable = i.customId === "enable_all";

        Object.keys(defaultLogs).forEach((key) => (logs[key] = enable));

        saveLogs(logs);

        lastAction = enable ? "✅ All logs enabled" : "❌ All logs disabled";

        // Update dropdown
        const updatedSelect = new StringSelectMenuBuilder()
          .setCustomId("logs_select")
          .setPlaceholder("Select a log to toggle")
          .addOptions(createOptions())
          .setMinValues(1)
          .setMaxValues(1);

        await i.update({
          embeds: [createEmbed()],
          components: [
            new ActionRowBuilder().addComponents(updatedSelect),
            row2,
          ],
        });
      }
    });
  },
};
