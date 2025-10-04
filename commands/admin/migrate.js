const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const { execute } = require("../../database/database");
const { getLevelFromXP, getXpFromLevel } = require("../../calculator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("migrate")
    .setDescription("Create or update a user's stats in the database.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to update")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("xp").setDescription("XP to set").setRequired(false)
    )
    .addIntegerOption((option) =>
      option.setName("budz").setDescription("Budz to set").setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("voice")
        .setDescription("Voice minutes to set")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("messages")
        .setDescription("Messages to set")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("level")
        .setDescription("Target level (overrides XP if provided)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    async function updateUserAndNotify(message, member) {
      const config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));

      const userId = message ? message.member.id : member.id;

      let newUserData = await execute(
        `SELECT * FROM users WHERE member_id = ?`,
        [userId]
      );

      if (!newUserData || newUserData.length === 0) return;

      const xp = newUserData[0].xp;
      const userLevel = newUserData[0].current_level;
      const newLevel = getLevelFromXP(xp);

      const guildMember = message
        ? message.member
        : await member.guild.members.fetch(member.id);

      // Always fetch qualifying roles
      const qualifyingRoles = await execute(
        `SELECT * FROM roles WHERE level <= ? ORDER BY level ASC`,
        [newLevel]
      );

      // Always assign all qualifying roles the user doesn't already have
      for (const roleRow of qualifyingRoles) {
        const roleToGive = await guildMember.guild.roles.fetch(roleRow.role_id);
        if (roleToGive && !guildMember.roles.cache.has(roleToGive.id)) {
          await guildMember.roles.add(roleToGive);
        }
      }

      // Only update level & notify if level changed
      if (userLevel !== newLevel) {
        console.log("level updated");

        await execute(
          `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ? ,?, ?, ?, ? ,?)`,
          [userId, 420, "[]", -1, -1, -1, 0]
        );
        await execute(
          `UPDATE economy SET coins = coins + ${config.level_up_points} WHERE user_id = ?`,
          [userId]
        );
        await execute(
          `UPDATE users SET current_level = ? WHERE member_id = ?`,
          [newLevel, userId]
        );

        const topRole =
          qualifyingRoles.length > 0
            ? await guildMember.guild.roles.fetch(
                qualifyingRoles.at(-1).role_id
              )
            : null;

        if (config.level_up) {
          const channel = await (message
            ? message.guild.channels.fetch(config.channel_id)
            : member.guild.channels.fetch(config.channel_id));

          if (channel && channel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setColor(0x00ff99)
              .setTitle("🎉 | Level Up!")
              .setDescription(
                `${config.levelup_message
                  .replaceAll("{{member}}", `${guildMember}`)
                  .replaceAll("{{level}}", `${newLevel}`)
                  .replaceAll("{{lvlupbudz}}", `${config.level_up_points}`)
                  .replaceAll(
                    "{{role}}",
                    `${topRole ? topRole : "**❌ No roles setup**"}`
                  )}`
              )
              .setAuthor({
                name: guildMember.user.username,
                iconURL: guildMember.user.displayAvatarURL({ dynamic: true }),
              })
              .setThumbnail(
                guildMember.user.displayAvatarURL({ dynamic: true })
              )
              .setTimestamp()
              .setFooter({ text: `🍃 HighBot | Keep going! 💪` });

            channel.send({ embeds: [embed] });
          }
        }
      }
    }

    const user = interaction.options.getUser("user");
    const member = interaction.options.getMember("user");
    const levelInput = interaction.options.getInteger("level");

    // Fetch existing user data (if any)
    let userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
      user.id,
    ]);
    let economyData = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      user.id,
    ]);

    // Extract inputs or fallback to existing data or zero
    const xpInput = interaction.options.getInteger("xp");
    const voiceInput = interaction.options.getInteger("voice");
    const messagesInput = interaction.options.getInteger("messages");
    const budz = interaction.options.getInteger("budz");
    let xpToAdd, voiceToAdd, messagesToAdd;

    if (userData.length === 0) {
      // New user defaults if not provided
      xpToAdd = levelInput ? getXpFromLevel(levelInput) : xpInput || 0;
      voiceToAdd = voiceInput || 0;
      messagesToAdd = messagesInput || 0;
    } else {
      // Existing user — fallback to current DB values if input missing
      const existing = userData[0];
      xpToAdd = levelInput
        ? getXpFromLevel(levelInput)
        : xpInput !== null && xpInput !== undefined
        ? xpInput
        : existing.xp;
      voiceToAdd =
        voiceInput !== null && voiceInput !== undefined
          ? voiceInput
          : existing.voice;
      messagesToAdd =
        messagesInput !== null && messagesInput !== undefined
          ? messagesInput
          : existing.messages;
    }

    const level = levelInput ?? getLevelFromXP(xpToAdd);

    // create table if not exists economy (user_id TEXT PRIMARY KEY, coins INTEGER, items TEXT, daily BIGINT, weekly BIGINT, work BIGINT, gift_cap INTEGER)
    if (userData.length === 0) {
      await execute(
        `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ? ,?, ?, ?, ? ,?)`,
        [user.id, budz ?? 420, "[]", -1, -1, -1, 0]
      );
      // Insert new user
      await execute(
        `INSERT INTO users (member_id, xp, current_level, voice, messages) VALUES (?, ?, ?, ?, ?)`,
        [user.id, xpToAdd, level, voiceToAdd, messagesToAdd]
      );

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ User Created")
            .setDescription(
              `> **Created new entry for ${user}.**\n\n> **XP:** ${xpToAdd}\n> **Level:** ${level}\n> **Voice Minutes:** ${voiceToAdd}\n> **Messages:** ${messagesToAdd}\n> **Budz:** ${
                budz ?? 420
              }`
            )
            .setColor("Green")
            .setTimestamp(),
        ],
      });
      await updateUserAndNotify(null, member);
      console.log("yes");
    } else {
      // Update existing user
      await execute(
        `UPDATE users SET xp = ?, current_level = ?, voice = ?, messages = ? WHERE member_id = ?`,
        [xpToAdd, level, voiceToAdd, messagesToAdd, user.id]
      );
      if (budz !== null)
        await execute(`UPDATE economy SET coins = ? WHERE user_id = ?`, [
          budz ?? 0,
          user.id,
        ]);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ User Updated")
            .setDescription(
              `> **Updated stats for ${user}**.\n\n> **XP:** ${xpToAdd}\n> **Level:** ${level}\n> **Voice Minutes:** ${voiceToAdd}\n> **Messages:** ${messagesToAdd}\n> **Budz:** ${
                budz ?? economyData[0].coins
              }`
            )
            .setColor("Blue")
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      console.log("yes");
      await updateUserAndNotify(null, member);
    }
  },
};
