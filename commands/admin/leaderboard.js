const { createCanvas, loadImage } = require("canvas");
const { AttachmentBuilder, SlashCommandBuilder } = require("discord.js");
const { execute } = require("../../database/database");
const { getXpFromLevel } = require("../../calculator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top 10 leaderboard")
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

    const rawData = await execute(
      `SELECT * FROM users ORDER BY xp DESC LIMIT ${
        pageSize * 2
      } OFFSET ${offset}` // fetch more to account for possible filtering
    );

    // Proper async filtering: exclude users without valid usernames
    const filteredData = (
      await Promise.all(
        rawData.map(async (user) => {
          try {
            const member = await interaction.guild.members.fetch(
              user.member_id
            );
            if (!member || !member.user?.username) return null;
            return { ...user, member };
          } catch (err) {
            return null;
          }
        })
      )
    )
      .filter(Boolean)
      .slice(0, pageSize); // limit to 10 after filtering

    if (!filteredData.length) {
      return interaction.reply({
        content: `❌ No valid users found on page ${page}.`,
        ephemeral: true,
      });
    }

    const entryHeight = 120;
    const canvasWidth = 1000;
    const canvasHeight = entryHeight * filteredData.length + 40;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < filteredData.length; i++) {
      const user = filteredData[i];
      const member = user.member;
      const y = i * entryHeight + 35;

      const rank = offset + i + 1;
      const level = user.current_level || 0;
      const xp = user.xp || 0;
      const xpNeededForNextLevel = getXpFromLevel(level + 1);
      const xpCurrentGained = xp;

      let avatarURL = "https://cdn.discordapp.com/embed/avatars/0.png";
      try {
        avatarURL = member.user.displayAvatarURL({
          extension: "png",
          size: 128,
        });
      } catch (err) {
        console.log(`Avatar fetch failed for ID ${user.member_id}`);
      }

      const avatar = await loadImage(avatarURL);

      // Draw rank number
      ctx.font = "bold 36px Sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`#${rank}`, 30, y + 60);

      // Circular avatar
      const avatarX = 120;
      const avatarY = y + 10;
      const avatarRadius = 50;

      const percent = Math.max(
        Math.min(xpCurrentGained / xpNeededForNextLevel, 1),
        0
      );
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + 2 * Math.PI * percent;

      ctx.beginPath();
      ctx.arc(
        avatarX + avatarRadius,
        avatarY + avatarRadius,
        avatarRadius + 5,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = "#1a1a1a";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        avatarX + avatarRadius,
        avatarY + avatarRadius,
        avatarRadius + 5,
        startAngle,
        endAngle
      );
      ctx.strokeStyle = "#00bfff";
      ctx.lineWidth = 6;
      ctx.stroke();

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

      // Level
      ctx.font = "22px Sans-serif";
      ctx.fillStyle = "#00bfff";
      ctx.fillText(`LEVEL ${level}`, 240, y + 75);

      // XP
      ctx.font = "20px Sans-serif";
      ctx.fillStyle = "#b9bbbe";
      ctx.fillText(
        `${xpCurrentGained}/${xpNeededForNextLevel} XP`,
        240,
        y + 100
      );

      // Messages and voice time
      ctx.font = "18px Sans-serif";
      ctx.fillStyle = "#b9bbbe";
      ctx.textAlign = "right";
      ctx.fillText(`${user.messages || 0} MESSAGES`, canvasWidth - 30, y + 60);
      ctx.fillText(
        `${user.voice || 0} VOICE MINUTES`,
        canvasWidth - 30,
        y + 90
      );
      ctx.textAlign = "start";
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "leaderboard.png",
    });

    await interaction.reply({ files: [attachment], ephemeral: false });
  },
};
