const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { execute } = require("../database/database");

async function sendDrop(ctx, guildId, manual = false, customDrop = null) {
  // Use customDrop if provided, otherwise fetch from database
  const settings = customDrop
    ? [customDrop]
    : await execute(`SELECT * FROM drop_settings WHERE guild_id = ?`, [
        guildId,
      ]);

  if (!settings || settings.length === 0) return;

  const s = settings[0]; // now this is either your DB row or the custom drop
  const channel = ctx.guild.channels.cache.get(s.drop_channel) || ctx.channel;
  console.log(settings);
  let data = [];
  if (s.store_items) {
    data = await execute(`SELECT * FROM shop WHERE id = ?`, [s.store_items]);
  }
  const title = `> ${
    s.message.replaceAll("\n", "\n> ") || "First to claim gets the reward!"
  }\n\n**✨ Rewards:**\n> ${
    s.budz_amount > 0 ? `- 💰 **${s.budz_amount} Budz™**\n> ` : ""
  }${s.xp_amount > 0 ? `- ⚡ **${s.xp_amount} XP**\n> ` : ""}${
    s.store_items && data.length > 0 ? `- 🎁 **${data[0].item}**\n> ` : ""
  }`;
  const embed = new EmbedBuilder()
    .setTitle(s.title || "📦 Crate Drop!")
    .setDescription(
      `${title.substring(0, title.length - 3)}\n\n> Use \`\`/claim\`\` to claim this drop.`
    )
    .setAuthor({
      name: `${ctx.client.user.username}`,
      iconURL: `${ctx.client.user.displayAvatarURL()}`,
    })
    .setColor(s.color || "#ffaa00")
    .setImage(s.image_url || null)
    .setFooter({ text: "🍃 HighBot | Claim within 2 minutes!" })
    .setTimestamp();

  // const button = new ButtonBuilder()
  //   .setCustomId("claim_crate")
  //   .setLabel("🎁 Claim Crate")
  //   .setStyle(ButtonStyle.Success);

  const dropMsg = await channel.send({
    content: s.ping_roles ? `<@&${s.ping_roles}>` : "",
    embeds: [embed],
  });

  await execute(
    `INSERT INTO active_drops 
     (id, guild_id, message_id, channel_id, xp_amount, budz_amount, store_items, claimed_by, expires_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id,
      guildId,
      dropMsg.id,
      channel.id,
      s.xp_amount,
      s.budz_amount,
      s.store_items,
      null,
      Date.now() + 2 * 60 * 1000,
    ]
  );

  if (manual && ctx.reply) {
    await ctx.reply({
      content: `> 📦 Drop sent in ${channel}`,
      ephemeral: true,
    });
  }

  setTimeout(async () => {
    let data = await execute(
      `SELECT * FROM active_drops WHERE message_id = ?`,
      [dropMsg.id]
    );
    const claimed_by = data[0]?.claimed_by;
    if (!claimed_by) {
      const embed = EmbedBuilder.from(dropMsg.embeds[0]).setDescription(
        `> This crate hasn't been claimed in the given **2 minutes**, therefore the crate has expired and is not claimable anymore.\n\n> Please wait for other crates to appear.`
      );
      dropMsg.edit({ embeds: [embed], components: [] });
    }
  }, 120000);
}

module.exports = { sendDrop };
