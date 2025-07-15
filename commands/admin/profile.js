const { createCanvas, loadImage } = require("canvas");
const { AttachmentBuilder, SlashCommandBuilder } = require("discord.js");
const { execute } = require("../../database/database");
const { getXpFromLevel } = require("../../calculator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your profile card"),
  async execute(interaction) {
    const member = interaction.member;

  
    const userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
      member.id,
    ]);
    const allData = await execute(`SELECT * FROM users`, []);

    const level = userData[0]?.current_level || 0;
    const xp = userData[0]?.xp || 0;
    const xpNeededForNextLevel = getXpFromLevel(level + 1);
    const xpNeededForCurrentLevel = getXpFromLevel(level);
    const xpCurrentGained = xp - xpNeededForCurrentLevel;


    const sortedData = allData.sort((a, b) => b.xp - a.xp);
    const rankIndex = sortedData.findIndex((u) => u.member_id === member.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : allData.length;


    const canvas = createCanvas(900, 300);
    const ctx = canvas.getContext("2d");


    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

  
    const cardX = 20;
    const cardY = 20;
    const cardWidth = 860;
    const cardHeight = 260;
    const cardRadius = 20;

    function roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height
      );
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = "#000000";
    roundRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
    ctx.fill();

    ctx.shadowColor = "transparent";

   
    const avatarX = 150;
    const avatarY = 150;
    const avatarRadius = 100;

    ctx.save();
    ctx.shadowColor = "#00bfff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius + 5, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 191, 255, 0.2)";
    ctx.fill();
    ctx.restore();

    const avatarURL = member.user.displayAvatarURL({
      extension: "png",
      size: 256,
    });
    const avatar = await loadImage(avatarURL);

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      avatar,
      avatarX - avatarRadius,
      avatarY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
    ctx.restore();

   
    ctx.font = "bold 36px Sans-serif"; 
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 4;
    ctx.fillText(member.user.username, 280, 100);
    ctx.shadowColor = "transparent";

    ctx.font = "28px Sans-serif";
    ctx.fillStyle = "#00bfff";
    ctx.fillText(`Level ${level}`, 280, 160);


    const barWidth = 500;
    const barHeight = 30;
    const barX = 280;
    const barY = 180;
    const barRadius = barHeight / 2;

    roundRect(ctx, barX, barY, barWidth, barHeight, barRadius);
    ctx.fillStyle = "#484b4e";
    ctx.fill();

    const percent = Math.max(
      Math.min(xpCurrentGained / xpNeededForNextLevel, 1),
      0
    );
    const fillWidth = barWidth * percent;

    if (fillWidth > 0) {
      const fillGradient = ctx.createLinearGradient(
        barX,
        barY,
        barX + fillWidth,
        barY
      );
      fillGradient.addColorStop(0, "#00bfff");
      fillGradient.addColorStop(1, "#005f99");

      roundRect(ctx, barX, barY, fillWidth, barHeight, barRadius);
      ctx.fillStyle = fillGradient;
      ctx.fill();
    }


    ctx.font = "26px Sans-serif";
    ctx.fillStyle = "#b9bbbe";
    ctx.fillText(`${xpCurrentGained} / ${xpNeededForNextLevel} XP`, 280, 240);

   
    let rankColor = "#b9bbbe";
    if (rank === 1) rankColor = "#ffd700"; 
    else if (rank === 2) rankColor = "#c0c0c0"; 
    else if (rank === 3) rankColor = "#cd7f32"; 

    ctx.font = "bold 32px Sans-serif";
    ctx.fillStyle = rankColor;
    ctx.textAlign = "right";
    ctx.fillText(`#${rank}`, cardX + cardWidth - 20, cardY + 50);
    ctx.textAlign = "start"; 

   
    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
      name: "profile.png",
    });
    await interaction.reply({ files: [attachment], ephemeral: true });
  },
};
