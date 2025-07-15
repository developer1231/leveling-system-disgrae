const { createCanvas, loadImage } = require("canvas");
const { AttachmentBuilder, SlashCommandBuilder } = require("discord.js");
const { execute } = require("../../database/database");
const { getXpFromLevel } = require("../../calculator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top 10 leaderboard"),
  async execute(interaction) {
    // Fetch top 10 users sorted by XP
    const allData = await execute(
      `SELECT * FROM users ORDER BY xp DESC LIMIT 10`
    );

    const entryHeight = 120;
    const canvasWidth = 1000;
    const canvasHeight = entryHeight * allData.length + 40;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < allData.length; i++) {
      const user = allData[i];
      const y = i * entryHeight + 35;

      const rank = i + 1;
      const level = user.current_level || 0;
      const xp = user.xp || 0;
      const xpNeededForNextLevel = getXpFromLevel(level + 1);
      const xpNeededForCurrentLevel = getXpFromLevel(level);
      const xpCurrentGained = xp - xpNeededForCurrentLevel;

      // Member fetching (if needed for avatars)
      let avatarURL = "https://cdn.discordapp.com/embed/avatars/0.png"; // fallback avatar
      try {
        const guildMember = await interaction.guild.members.fetch(
          user.member_id
        );
        avatarURL = guildMember.user.displayAvatarURL({
          extension: "png",
          size: 128,
        });
      } catch (err) {
        console.log(`Could not fetch member for ID ${user.member_id}`);
      }
      const avatar = await loadImage(avatarURL);

      // Rank number
      ctx.font = "bold 36px Sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`#${rank}`, 30, y + 60);

      // Avatar with border
      const avatarX = 120;
      const avatarY = y + 10;
      const avatarRadius = 50;

      // Progress border
      const percent = Math.max(
        Math.min(xpCurrentGained / xpNeededForNextLevel, 1),
        0
      );
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + 2 * Math.PI * percent;

      // Border circle
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

      // Progress arc
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

      // Avatar circle
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
      ctx.fillText(user.username || `User`, 240, y + 45);

      // Level text
      ctx.font = "22px Sans-serif";
      ctx.fillStyle = "#00bfff";
      ctx.fillText(`LEVEL ${level}`, 240, y + 75);

      // XP progress text
      ctx.font = "20px Sans-serif";
      ctx.fillStyle = "#b9bbbe";
      ctx.fillText(
        `${xpCurrentGained}/${xpNeededForNextLevel} XP`,
        240,
        y + 100
      );

      // Messages and voice minutes (fake placeholders, replace with real DB fields if available)
      ctx.font = "18px Sans-serif";
      ctx.fillStyle = "#b9bbbe";
      ctx.textAlign = "right";
      ctx.fillText(`${user.messages || 0} MESSAGES`, canvasWidth - 30, y + 60);
      ctx.fillText(
        `${user.voice_minutes || 0} VOICE MINUTES`,
        canvasWidth - 30,
        y + 90
      );
      ctx.textAlign = "start";
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "leaderboard.png",
    });

    await interaction.reply({ files: [attachment], ephemeral: true });
  },
};
