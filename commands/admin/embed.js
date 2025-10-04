require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const embedsPath = path.join(__dirname, "../../embeds.json");

// JSON helpers
function loadEmbeds() {
  if (!fs.existsSync(embedsPath)) return {};
  return JSON.parse(fs.readFileSync(embedsPath, "utf8"));
}
function saveEmbeds(data) {
  fs.writeFileSync(embedsPath, JSON.stringify(data, null, 2));
}
function makeId(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Post a custom embed in any channel")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel to post in")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Hex color (e.g. #00b7ff)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName("image").setDescription("Image URL").setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("thumbnail")
        .setDescription("Thumbnail URL")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName("footer").setDescription("Footer text").setRequired(false)
    ),
  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: "> ❌ Only admins can use this command.",
      });
    }

    const channel = interaction.options.getChannel("channel");
    const color = interaction.options.getString("color") || "#00b7ff";
    const image = interaction.options.getString("image") || "";
    const thumbnail = interaction.options.getString("thumbnail") || "";
    const footer = interaction.options.getString("footer") || "";

    // modal for title/description
    const modal = new ModalBuilder()
      .setCustomId(`createEmbedModal_${interaction.id}`)
      .setTitle("Create Embed");

    const titleInput = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Embed Title")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Embed Description (Markdown supported)")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    await interaction.showModal(modal);

    const submitted = await interaction
      .awaitModalSubmit({
        time: 1000 * 60,
        filter: (i) => i.customId === `createEmbedModal_${interaction.id}`,
      })
      .catch(() => null);

    if (!submitted) return;

    const title = submitted.fields.getTextInputValue("title");
    const description = submitted.fields.getTextInputValue("description");

    // generate ID
    const embedId = makeId();

    const customEmbed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    if (image) customEmbed.setImage(image);
    if (thumbnail) customEmbed.setThumbnail(thumbnail);
    if (footer) customEmbed.setFooter({ text: footer });

    const sentMessage = await channel.send({
      embeds: [customEmbed],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`revealId_${embedId}`)
            .setLabel("Reveal ID")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("🆔")
        ),
      ],
    });

    // save embed
    const allEmbeds = loadEmbeds();
    allEmbeds[embedId] = {
      channelId: channel.id,
      messageId: sentMessage.id,
      title,
      description,
      color,
      image,
      thumbnail,
      footer,
      fields: [],
    };
    saveEmbeds(allEmbeds);

    await submitted.reply({
      ephemeral: true,
      content: `> ✅ Embed posted successfully in ${channel}!\n> To edit the embed, click on **Reveal ID** and use **/edit-embed (id)**.`,
    });

    // Listen for "Reveal ID"
    const collector = sentMessage.createMessageComponentCollector({
      time: 1000 * 60 * 10,
    });

    collector.on("collect", async (i) => {
      if (i.customId === `revealId_${embedId}`) {
        if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return i.reply({
            ephemeral: true,
            content: "> ❌ Only admins can reveal the ID.",
          });
        }
        await i.reply({
          ephemeral: true,
          content: `> 🔑 Embed ID: **${embedId}**\n> Use **/edit-embed (id)** to edit the embed!`,
        });
      }
    });
  },
};
