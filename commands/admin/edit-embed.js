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
} = require("discord.js");

const embedsPath = path.join(__dirname, "../../embeds.json");

function loadEmbeds() {
  if (!fs.existsSync(embedsPath)) return {};
  return JSON.parse(fs.readFileSync(embedsPath, "utf8"));
}
function saveEmbeds(data) {
  fs.writeFileSync(embedsPath, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("edit-embed")
    .setDescription("Edit a stored embed by ID")
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("The embed ID to edit")
        .setRequired(true)
    ),
  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: "> ❌ Only admins can edit embeds.",
      });
    }

    const embedId = interaction.options.getString("id");
    const allEmbeds = loadEmbeds();

    if (!allEmbeds[embedId]) {
      return interaction.reply({
        ephemeral: true,
        content: `> ❌ No embed found with ID: **${embedId}**`,
      });
    }

    const data = allEmbeds[embedId];

    // modal for editing
    const modal = new ModalBuilder()
      .setCustomId(`editEmbedModal_${embedId}`)
      .setTitle(`Edit Embed ${embedId}`);

    const titleInput = new TextInputBuilder()
      .setCustomId("title")
      .setLabel("Embed Title")
      .setStyle(TextInputStyle.Short)
      .setValue(data.title);

    const descInput = new TextInputBuilder()
      .setCustomId("description")
      .setLabel("Embed Description")
      .setStyle(TextInputStyle.Paragraph)
      .setValue(data.description);

    const footerInput = new TextInputBuilder()
      .setCustomId("footer")
      .setLabel("Footer Text")
      .setStyle(TextInputStyle.Short)
      .setValue(data.footer || "");

    const colorInput = new TextInputBuilder()
      .setCustomId("color")
      .setLabel("Embed Color (#hex)")
      .setStyle(TextInputStyle.Short)
      .setValue(data.color || "#00b7ff");

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(footerInput),
      new ActionRowBuilder().addComponents(colorInput)
    );

    await interaction.showModal(modal);

    const submitted = await interaction
      .awaitModalSubmit({
        time: 1000 * 60,
        filter: (i) => i.customId === `editEmbedModal_${embedId}`,
      })
      .catch(() => null);

    if (!submitted) return;

    const newTitle = submitted.fields.getTextInputValue("title");
    const newDesc = submitted.fields.getTextInputValue("description");
    const newFooter = submitted.fields.getTextInputValue("footer");
    const newColor = submitted.fields.getTextInputValue("color");

    const updatedEmbed = new EmbedBuilder()
      .setTitle(newTitle)
      .setDescription(newDesc + `\n\n*ID: ${embedId}*`)
      .setColor(newColor)
      .setTimestamp();

    if (data.image) updatedEmbed.setImage(data.image);
    if (data.thumbnail) updatedEmbed.setThumbnail(data.thumbnail);
    if (newFooter) updatedEmbed.setFooter({ text: newFooter });

    // edit existing message
    const channel = await interaction.guild.channels.fetch(data.channelId);
    const msg = await channel.messages.fetch(data.messageId);
    await msg.edit({ embeds: [updatedEmbed] });

    // save changes
    allEmbeds[embedId] = {
      ...data,
      title: newTitle,
      description: newDesc,
      color: newColor,
      footer: newFooter,
    };
    saveEmbeds(allEmbeds);

    await submitted.reply({
      ephemeral: true,
      content: `> ✅ Embed **${embedId}** updated!`,
    });
  },
};
