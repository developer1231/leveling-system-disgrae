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
    .setName("remove-field")
    .setDescription("Remove a field from an embed by ID")
    .addStringOption((o) =>
      o.setName("id").setDescription("Embed ID").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("index")
        .setDescription("Field index (starting from 1)")
        .setRequired(true)
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
    const index = interaction.options.getInteger("index") - 1;

    const embeds = loadEmbeds();
    if (!embeds[id])
      return interaction.reply({
        ephemeral: true,
        content: "❌ Invalid embed ID.",
      });
    if (index < 0 || index >= embeds[id].fields.length)
      return interaction.reply({
        ephemeral: true,
        content: "❌ Invalid field index.",
      });

    embeds[id].fields.splice(index, 1);

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
      content: `> ✅ Field removed from embed **${id}**.`,
    });
  },
};
