const { createCanvas, loadImage } = require("canvas");
const { AttachmentBuilder, SlashCommandBuilder } = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("richest")
    .setDescription("Show the richest Budz™ holders")
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setDescription("Page number (1 = first page)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const page = interaction.options.getInteger("page") || 1;
    const pageSize = 10;
    const offset = (page - 1) * pageSize;

    // Get economy data (fetch more than needed to filter invalid users)
    const rawData = await execute(
      `SELECT * FROM economy ORDER BY coins DESC LIMIT ${
        pageSize * 2
      } OFFSET ${offset}`
    );

    // Filter invalid members
    const filteredData = (
      await Promise.all(
        rawData.map(async (user) => {
          try {
            const member = await interaction.guild.members.fetch(user.user_id);
            if (!member || !member.user?.username) return null;
            return { ...user, member };
          } catch {
            return null;
          }
        })
      )
    )
      .filter(Boolean)
      .slice(0, pageSize);

    if (!filteredData.length) {
      return interaction.reply({
        content: `❌ No valid users found on page ${page}.`,
        ephemeral: true,
      });
    }

    // Canvas setup
    const entryHeight = 120;
    const canvasWidth = 1000;
    const canvasHeight = entryHeight * filteredData.length + 40;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load emoji once (💰) as PNG from Twemoji
    const emoji = await loadImage(
      "https://twemoji.maxcdn.com/v/latest/72x72/1f4b0.png"
    );

    for (let i = 0; i < filteredData.length; i++) {
      const user = filteredData[i];
      const member = user.member;
      const y = i * entryHeight + 35;
      const rank = offset + i + 1;
      const coins = user.coins || 0;

      // Load avatar
      let avatarURL = "https://cdn.discordapp.com/embed/avatars/0.png";
      try {
        avatarURL = member.user.displayAvatarURL({
          extension: "png",
          size: 128,
        });
      } catch {}
      const avatar = await loadImage(avatarURL);

      // Rank
      ctx.font = "bold 36px Sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`#${rank}`, 30, y + 60);

      // Circular avatar
      const avatarX = 120;
      const avatarY = y + 10;
      const avatarRadius = 50;
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarRadius,
        avatarY + avatarRadius,
        avatarRadius,
        0,
        Math.PI * 2
      );
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        avatar,
        avatarX,
        avatarY,
        avatarRadius * 2,
        avatarRadius * 2
      );
      ctx.restore();

      // Username
      ctx.font = "bold 28px Sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(member.user.username, 240, y + 45);

      // Draw emoji as PNG
      const emojiSize = 24;
      const emojiX = 240;
      const emojiY = y + 60;
      ctx.drawImage(emoji, emojiX, emojiY, emojiSize, emojiSize);

      // Draw coins text
      ctx.font = "22px Sans-serif";
      ctx.fillStyle = "#FFD700";
      ctx.fillText(
        `${coins.toLocaleString()} Budz™`,
        emojiX + emojiSize + 8,
        y + 80
      );
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "richest.png",
    });

    await interaction.reply({ files: [attachment], ephemeral: false });
  },
};
