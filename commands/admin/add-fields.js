const fs = require("fs");
const path = require("path");
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
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
    .setName("add-field")
    .setDescription("Add a field to an embed by ID")
    .addStringOption((o) =>
      o.setName("id").setDescription("Embed ID").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("name").setDescription("Field name").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("value").setDescription("Field value").setRequired(true)
    )
    .addBooleanOption((o) =>
      o.setName("inline").setDescription("Show inline?").setRequired(false)
    ),
  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: "> ❌ Only admins can use this.",
      });
    }

    const id = interaction.options.getString("id");
    const name = interaction.options.getString("name");
    const value = interaction.options.getString("value");
    const inline = interaction.options.getBoolean("inline") || false;

    const embeds = loadEmbeds();
    if (!embeds[id])
      return interaction.reply({
        ephemeral: true,
        content: "> ❌ Invalid embed ID. Please click on **Reveal ID**.",
      });

    embeds[id].fields.push({ name, value, inline });

    const channel = await interaction.guild.channels.fetch(
      embeds[id].channelId
    );
    const msg = await channel.messages.fetch(embeds[id].messageId);

    const updatedEmbed = new EmbedBuilder()
      .setTitle(embeds[id].title)
      .setDescription(embeds[id].description)
      .setColor(embeds[id].color)
      .setTimestamp()
      .addFields(embeds[id].fields);

    if (embeds[id].image) updatedEmbed.setImage(embeds[id].image);
    if (embeds[id].thumbnail) updatedEmbed.setThumbnail(embeds[id].thumbnail);
    if (embeds[id].footer) updatedEmbed.setFooter({ text: embeds[id].footer });

    await msg.edit({ embeds: [updatedEmbed] });
    saveEmbeds(embeds);

    return interaction.reply({
      ephemeral: true,
      content: `> ✅ Field added to embed **${id}**.`,
    });
  },
};
