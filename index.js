require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const cache = require("./cache");
const { createCanvas, loadImage } = require("canvas");
const {
  execute,
  getCurrentDateTime,
  getCurrentTimestamp,
  makeid,
} = require("./database/database");
const { getLevelFromXP } = require("./calculator");
const {
  REST,
  Routes,
  ChannelType,
  ButtonStyle,
  ButtonBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  Embed,
  ActionRowBuilder,
  AuditLogEvent,
} = require("discord.js");
const {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  Collection,
  EmbedBuilder,
} = require("discord.js");
const { sendDrop } = require("./helpers/drops");
const { exec } = require("node:child_process");
const client = new Client({
  intents: Object.keys(GatewayIntentBits).map((a) => {
    return GatewayIntentBits[a];
  }),
});

const commands = [];
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);
client.commands = new Collection();
for (const folder of commandFolders) {
  if (fs.lstatSync("./commands/" + folder).isDirectory()) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }
}

const rest = new REST().setToken(process.env.BOT_TOKEN);
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );
    const data = await rest.put(
      Routes.applicationCommands(process.env.BOT_CLIENT_ID),
      {
        body: commands,
      }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

const talkedMap = new Map();

async function updateUserAndNotify(message, member) {
  const config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));

  const userId = message ? message.member.id : member.id;

  let newUserData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
    userId,
  ]);

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
    await execute(`UPDATE users SET current_level = ? WHERE member_id = ?`, [
      newLevel,
      userId,
    ]);
    let userData = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      userId,
    ]);
    if (userData.length == 0) {
      await execute(
        `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ? ,?, ?, ?, ? ,?)`,
        [userId, 420, "[]", -1, -1, -1, 0]
      );
    }
    await execute(
      `UPDATE economy SET coins = coins + ${config.level_up_points} WHERE user_id = ?`,
      [userId]
    );
    console.log("money given");
    const topRole =
      qualifyingRoles.length > 0
        ? await guildMember.guild.roles.fetch(qualifyingRoles.at(-1).role_id)
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
          .setThumbnail(guildMember.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: `🍃 HighBot | Keep going! 💪` });

        channel.send({ embeds: [embed] });
      }
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  let command = client.commands.get(interaction.commandName);
  if (interaction.isCommand()) {
    command.execute(interaction);
  }
  if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }
  const sessions = JSON.parse(fs.readFileSync("./sessions.json", "utf8"));
  const userId = interaction.user.id;
  if (interaction.isButton() && interaction.customId === "crash_cashout") {
    if (!sessions[userId] || !sessions[userId].data) {
      return interaction.reply({
        content: "> ❌ You have no active Crash game.",
        ephemeral: true,
      });
    }

    const session = sessions[userId].data;

    if (session.cashedOut) {
      return interaction.reply({
        content: "> ⚠️ You already cashed out!",
        ephemeral: true,
      });
    }

    // Stop the game
    session.cashedOut = true;
    fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

    const payout = Math.floor(
      session.amount * (session.currentMultiplier || 1)
    );

    // Give coins to the user
    await execute(`UPDATE economy SET coins = coins + ? WHERE user_id = ?`, [
      payout,
      userId,
    ]);

    const cashoutEmbed = new EmbedBuilder()
      .setTitle("💰 Cashout!")
      .setThumbnail(
        "https://cdn.dribbble.com/userupload/12335909/file/original-66185e72722001cc894b7ade7fc5e04a.png"
      )
      .setDescription(
        `> You cashed out at **${(session.currentMultiplier || 1).toFixed(
          2
        )}x**!\n> **Initial Bet**: ${Math.round(
          payout / session.currentMultiplier || 1
        )} **Budz™**\n> You won **${payout} Budz™**\n### Commands\n> - Use */stats* to view your profile.\n> - Use */richest* to view the economy leaderboard.`
      )
      .setColor("Green")
      .setFooter({ text: "🍃 HighBot" })
      .setTimestamp();
    console.log("yes");
    try {
      await interaction.message.delete();
    } catch (e) {}
    console.log("yes2");
    await interaction.reply({
      embeds: [cashoutEmbed],
      components: [],
      ephemeral: false,
    });

    return;
  }

  // handle tile clicks
  if (
    interaction.isButton() &&
    interaction.customId.startsWith("mines_") &&
    interaction.customId !== "mines_cashout"
  ) {
    const session = sessions[userId]?.data;
    const makeGrid = () => {
      const rows = [];
      for (let y = 0; y < 4; y++) {
        const row = new ActionRowBuilder();
        for (let x = 0; x < 4; x++) {
          const index = y * 4 + x;
          const revealed = session.revealed.includes(index);
          const isMine = session.mines.includes(index);
          const btn = new ButtonBuilder()
            .setCustomId(`mines_${index}`)
            .setLabel(revealed ? (isMine ? "💣" : "✅") : "⬜")
            .setStyle(
              revealed
                ? isMine
                  ? ButtonStyle.Danger
                  : ButtonStyle.Success
                : ButtonStyle.Secondary
            )
            .setDisabled(revealed || session.cashedOut);
          row.addComponents(btn);
        }
        rows.push(row);
      }
      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("⚡️ Cashout")
            .setCustomId("mines_cashout")
            .setStyle(ButtonStyle.Success)
        )
      );
      return rows;
    };
    const index = parseInt(interaction.customId.split("_")[1]);

    if (session.revealed.includes(index) || session.cashedOut) {
      return interaction.deferUpdate(); // ignore
    }

    if (session.mines.includes(index)) {
      // 💥 Mine hit
      session.revealed.push(index);
      fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

      const embed = new EmbedBuilder()
        .setTitle("💣 BOOM!")
        .setDescription(
          `> You hit a mine!\n> You lost **${session.amount} Budz™**.\n### Commands\n> - Use */stats* to view your statistics.\n> - Use */richest* to view the economy leaderboard.`
        )
        .setColor("Red")
        .setThumbnail(
          "https://storage.googleapis.com/kickthe/assets/images/games/mines-hacksawgaming/gb/gbp/tile_large.jpg"
        )
        .setFooter({ text: "🍃 HighBot" });

      await interaction.update({
        embeds: [embed],
        components: [],
      });

      delete sessions[userId]; // end game
      fs.writeFileSync("./sessions.json", JSON.stringify(sessions));
      return;
    } else {
      // ✅ Safe reveal
      session.revealed.push(index);
      fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

      const safeCount = session.revealed.length;
      const multiplier = 1 + safeCount * 0.25; // +0.25x per safe tile
      session.multiplier = multiplier;
      fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

      const embed = new EmbedBuilder()
        .setTitle("💣 Mines Game")
        .setDescription(
          `> **Bet**: ${
            session.amount
          } **Budz™**\n> **Multiplier:** **${multiplier.toFixed(
            2
          )}x**\n> **Revealed safe tiles:** ${safeCount}\n> Cashout anytime to secure your winnings!`
        )
        .setColor("#00b7ff")
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setFooter({ text: `🍃 HighBot` })
        .setThumbnail(
          "https://storage.googleapis.com/kickthe/assets/images/games/mines-hacksawgaming/gb/gbp/tile_large.jpg"
        )
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: makeGrid(),
      });
    }
  }

  // handle cashout
  if (interaction.isButton() && interaction.customId === "mines_cashout") {
    const session = sessions[userId]?.data;
    const makeGrid = () => {
      const rows = [];
      for (let y = 0; y < 4; y++) {
        const row = new ActionRowBuilder();
        for (let x = 0; x < 4; x++) {
          const index = y * 4 + x;
          const revealed = session.revealed.includes(index);
          const isMine = session.mines.includes(index);
          const btn = new ButtonBuilder()
            .setCustomId(`mines_${index}`)
            .setLabel(revealed ? (isMine ? "💣" : "✅") : "⬜")
            .setStyle(
              revealed
                ? isMine
                  ? ButtonStyle.Danger
                  : ButtonStyle.Success
                : ButtonStyle.Secondary
            )
            .setDisabled(revealed || session.cashedOut);
          row.addComponents(btn);
        }
        rows.push(row);
      }
      return rows;
    };
    if (session.cashedOut) return interaction.deferUpdate();

    session.cashedOut = true;
    const safeCount = session.revealed.length;
    const multiplier = session.multiplier || 1;
    const winnings = Math.floor(session.amount * multiplier);

    await execute(`UPDATE economy SET coins = coins + ? WHERE user_id = ?`, [
      winnings,
      userId,
    ]);

    const embed = new EmbedBuilder()
      .setTitle("💰 Cashed Out!")
      .setThumbnail(
        "https://storage.googleapis.com/kickthe/assets/images/games/mines-hacksawgaming/gb/gbp/tile_large.jpg"
      )
      .setDescription(
        `> \`\`Multiplier:\`\` **${multiplier.toFixed(
          2
        )}x**\n> You won **${winnings} Budz™**!\n### Instructions\n> - Use */stats* to view your amount of total **Budz™**\n> - Use */richest* to display the economy leaderboard`
      )
      .setColor("Green")
      .setFooter({ text: "🍃 HighBot" });

    await interaction.update({
      embeds: [embed],
      components: makeGrid(),
      ephemeral: false,
    });

    delete sessions[userId]; // end game
    fs.writeFileSync("./sessions.json", JSON.stringify(sessions));
  }

  if (interaction.isButton() && interaction.customId === "edit_level_message") {
    const modal = new ModalBuilder()
      .setCustomId("level_message_modal")
      .setTitle("Set Level Up Message");

    const input = new TextInputBuilder()
      .setCustomId("level_message_input")
      .setLabel("Enter the level-up message")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("HotKeys: {{member}}, {{level}}, {{lvlupbudz}}")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(input);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  // When modal is submitted
  if (
    interaction.isModalSubmit() &&
    interaction.customId === "level_message_modal"
  ) {
    const newMessage = interaction.fields.getTextInputValue(
      "level_message_input"
    );

    let config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
    config.levelup_message = newMessage;
    fs.writeFileSync("./settings.json", JSON.stringify(config, null, 2));

    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Level Up Message Updated")
          .setDescription(`> **New message:**\n\`\`\`${newMessage}\`\`\``)
          .setColor("Green"),
      ],
    });
  }
  if (interaction.isButton()) {
    let sessions = JSON.parse(fs.readFileSync("./sessions.json", "utf8"));
    const userId = interaction.user.id;

    // Only handle buttons from the highlow game
    if (
      interaction.customId === "highlow_higher" ||
      interaction.customId === "highlow_lower" ||
      interaction.customId === "highlow_cashout"
    ) {
      const session = sessions[userId]?.data;
      if (!session) {
        return interaction.reply({
          ephemeral: true,
          content:
            "> 🚫 You don’t have an active game yet.\n> Please use */highlow* to start a game.",
        });
      }

      if (interaction.customId === "highlow_cashout") {
        try {
          await interaction.message.delete();
        } catch (e) {}
        interaction.reply({
          ephemeral: false,
          content: `> **✅ Good job!**\n> You have cashed out **${session.balance} Budz™**.`,
        });
        delete sessions[userId];
        fs.writeFileSync("./sessions.json", JSON.stringify(sessions));
        await execute(
          `UPDATE economy SET coins = coins + ${session.balance} WHERE user_id = ?`,
          [userId]
        );
        return;
      }

      const next = Math.floor(Math.random() * 100) + 1;
      const guess =
        interaction.customId === "highlow_higher" ? "higher" : "lower";

      // Win logic with decreasing odds
      const baseWinChance = 0.5; // 50% chance at round 0
      const winChance = Math.max(baseWinChance - session.rounds * 0.1, 0.1); // decrease 10% per round, min 10%
      let win = false;
      if (
        (guess === "higher" && next > session.current) ||
        (guess === "lower" && next < session.current)
      ) {
        if (Math.random() <= winChance) win = true;
      }

      let result = "";
      if (win) {
        session.balance *= 1.25;
        result = `**✅ Correct!**\n> Next number was **${next}**.\n> Your bet doubled to **${session.balance} Budz™**.`;
      } else {
        result = `**❌ Wrong!**\n> Next number was **${next}**.\n> **You lost your bet.**`;
        delete sessions[userId];
        fs.writeFileSync("./sessions.json", JSON.stringify(sessions));
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎲 High or Low Game - Game Over")
              .setDescription(result)
              .setColor("Red")
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setFooter({ text: `🍃 HighBot` })
              .setTimestamp(),
          ],
          components: [],
        });
        return;
      }

      session.current = next;
      session.rounds++;
      fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

      if (session.rounds >= 5) {
        // End game, award Budz
        await execute(
          `UPDATE economy SET coins = coins + ? WHERE user_id = ?`,
          [session.balance, userId]
        );
        delete sessions[userId];
        fs.writeFileSync("./sessions.json", JSON.stringify(sessions));
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎲 High or Low Game - Finished")
              .setDescription(
                `> **🏆 You survived 5 rounds!**\n> You win **${session.balance} Budz™**!`
              )
              .setColor("Green")
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setFooter({ text: `🍃 HighBot` })
              .setTimestamp(),
          ],
          components: [],
        });
      } else {
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setTitle("🎲 High or Low Game")
              .setDescription(
                `> ${result}\n\n> **Round** ${session.rounds}/5\n> **Next number:** \`\`${next}\`\`\n\n> **Guess again by using the buttons below!**`
              )
              .setColor("#00b7ff")
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setFooter({ text: `🍃 HighBot` })
              .setTimestamp(),
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  label: "Higher 🔼",
                  style: 1,
                  custom_id: "highlow_higher",
                },
                {
                  type: 2,
                  label: "Cashout ⚡️",
                  style: 1,
                  custom_id: "highlow_cashout",
                },
                {
                  type: 2,
                  label: "Lower 🔽",
                  style: 1,
                  custom_id: "highlow_lower",
                },
              ],
            },
          ],
        });
      }
    }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  await updateUserAndNotify(null, member);
});

async function getUserIncrementMultiplier(member) {
  const config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
  const maxIncrement = config.max_increment || 1;

  const allIncrements = await execute(`SELECT * FROM increments`);
  let totalIncrement = 0;

  for (const row of allIncrements) {
    if (member.roles.cache.has(row.role_id)) {
      totalIncrement += row.increment;
    }
  }

  if (totalIncrement > maxIncrement) {
    totalIncrement = maxIncrement;
  }

  return totalIncrement || 1;
}
const voiceJoinTimestamps = new Map();
const activeVoiceDurations = new Map();

client.on("voiceStateUpdate", async (oldState, newState) => {
  console.log("yes");
  let blacklist = await execute(
    `SELECT * FROM blacklist WHERE channel_id = ?`,
    [oldState.channelId]
  );
  console.log(blacklist);
  if (blacklist.length > 0) return;
  if (newState.member.user.bot) return;

  const memberId = newState.member.id;

  // User joins a voice channel
  if (!oldState.channelId && newState.channelId) {
    voiceJoinTimestamps.set(memberId, Date.now());
    activeVoiceDurations.set(memberId, 0);
  }

  // User leaves a voice channel
  if (oldState.channelId && !newState.channelId) {
    if (!voiceJoinTimestamps.has(memberId)) return;

    // Add last active segment if unmuted
    if (!oldState.selfMute && !oldState.serverMute) {
      const lastJoinTime = voiceJoinTimestamps.get(memberId);
      const durationMs = Date.now() - lastJoinTime;
      activeVoiceDurations.set(
        memberId,
        activeVoiceDurations.get(memberId) + durationMs
      );
    }

    const totalActiveMs = activeVoiceDurations.get(memberId) || 0;
    console.log(totalActiveMs);
    const minutesInVoice = Math.floor(totalActiveMs / 60000);
    console.log(minutesInVoice);
    if (minutesInVoice >= 1) {
      let baseXpToGive = minutesInVoice * 4;

      const guildMember = newState.member;
      const multiplier = await getUserIncrementMultiplier(guildMember);
      const finalXpToGive = baseXpToGive * multiplier;

      let userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
        memberId,
      ]);
      if (userData.length == 0) {
        await execute(
          `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ? ,?, ?, ?, ? ,?)`,
          [memberId, 420, "[]", -1, -1, -1, 0]
        );
        await execute(
          `INSERT OR IGNORE INTO users (member_id, xp, current_level, voice, messages) VALUES (?, ?, ?, ?, ?)`,
          [
            memberId,
            finalXpToGive,
            Math.floor(getLevelFromXP(finalXpToGive)),
            minutesInVoice,
            0,
          ]
        );
      } else {
        await execute(
          `UPDATE users SET xp = xp + ?, voice = voice + ? WHERE member_id = ?`,
          [finalXpToGive, minutesInVoice, memberId]
        );
      }

      await updateUserAndNotify(null, guildMember);
    }

    voiceJoinTimestamps.delete(memberId);
    activeVoiceDurations.delete(memberId);
  }

  // User mutes or unmutes while in VC
  if (oldState.channelId && newState.channelId) {
    // User was unmuted and now mutes
    if (
      !oldState.selfMute &&
      !oldState.serverMute &&
      (newState.selfMute || newState.serverMute)
    ) {
      const lastJoinTime = voiceJoinTimestamps.get(memberId);
      const durationMs = Date.now() - lastJoinTime;

      activeVoiceDurations.set(
        memberId,
        activeVoiceDurations.get(memberId) + durationMs
      );
      voiceJoinTimestamps.delete(memberId);
    }

    // User was muted and now unmutes
    if (
      (oldState.selfMute || oldState.serverMute) &&
      !newState.selfMute &&
      !newState.serverMute
    ) {
      voiceJoinTimestamps.set(memberId, Date.now());
    }
  }
});
const counters = new Map();
client.on(Events.MessageCreate, async (message) => {
  if (!message?.member) return;
  if (message.member.user.bot) return;
  let blacklist = await execute(
    `SELECT * FROM blacklist WHERE channel_id = ?`,
    [message.channel.id]
  );
  if (blacklist.length > 0) return;
  let userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
    message.member.id,
  ]);
  if (userData.length === 0) {
    await execute(
      `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ? ,?, ?, ?, ? ,?)`,
      [message.member.id, 420, "[]", -1, -1, -1, 0]
    );
    await execute(
      `INSERT OR IGNORE INTO users (member_id, xp, current_level, voice, messages) VALUES (?, ?, ?, ?, ?)`,
      [message.member.id, 0, 0, 0, 0]
    );
  }

  const lastTalked = talkedMap.get(message.member.id);
  if (!lastTalked || Date.now() - lastTalked > 60000) {
    let baseXpToGive = 15;

    const guildMember = message.member;
    const multiplier = await getUserIncrementMultiplier(guildMember);
    const finalXpToGive = baseXpToGive * multiplier;

    await execute(
      `UPDATE users SET xp = xp + ?, messages = messages + 1 WHERE member_id = ?`,
      [finalXpToGive, guildMember.id]
    );

    talkedMap.set(guildMember.id, Date.now());
  }

  await updateUserAndNotify(message, null);
  const drops = await execute(
    `SELECT * FROM drop_settings WHERE guild_id = ?`,
    [message.guild.id]
  );
  if (!drops || drops.length === 0) return;

  for (const drop of drops) {
    const new_id = makeid(10);
    if (drop.blacklisted_channels?.split(",").includes(message.channel.id))
      continue;

    const key = `${message.guild.id}:${drop.id}`;
    const count = (counters.get(key) || 0) + 1;
    counters.set(key, count);

    if (count >= drop.msg_requirement && drop.msg_requirement > 0) {
      counters.set(key, 0);
      drop.id = new_id;
      await sendDrop(message, message.guild.id, false, drop); // pass drop explicitly
    }
  }
});

const logsPath = path.join(__dirname, "./logs.json");
function loadLogs() {
  if (!fs.existsSync(logsPath)) return {};
  return JSON.parse(fs.readFileSync(logsPath, "utf8"));
}

// Target moderation logs channel
const LOG_CHANNEL_ID = process.env.ADMIN_CHANNEL;

// Helper to send embed to mod log channel
async function sendModLog(embed) {
  const channel = await client.channels.fetch(LOG_CHANNEL_ID);
  if (channel) channel.send({ embeds: [embed] });
}

// ------------------------
// Voice State Update Logging
// ------------------------

client.on("voiceStateUpdate", async (oldState, newState) => {
  const logs = loadLogs();
  if (!logs.vcLogs) return;

  let action = null;
  let extraInfo = "";
  let moderator = "Self"; // Default to self

  // ---------------------
  // Detect server mute/unmute (mod-only)
  // ---------------------
  if (
    (!oldState.serverMute || !oldState.selfMute) &&
    (newState.serverMute || newState.selfMute)
  )
    action = "Server Mute";
  if (
    (oldState.serverMute || oldState.selfMute) &&
    (!newState.serverMute || !newState.selfMute)
  )
    action = "Unmute";

  // ---------------------
  // Detect server deafen/undeafen (mod-only)
  // ---------------------
  if (
    (!oldState.serverDeaf || !oldState.selfDeaf) &&
    (newState.selfDeaf || newState.serverDeaf)
  )
    action = "Server Deafen";
  if (
    (oldState.selfDeaf || oldState.serverDeaf) &&
    (!newState.selfDeaf || !newState.serverDeaf)
  )
    action = "Undeafen";

  // ---------------------
  // Detect VC join/leave/move
  // ---------------------
  if (!oldState.channelId && newState.channelId) action = "Joined VC";
  if (oldState.channelId && !newState.channelId) action = "Left VC";
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  )
    action = "Moved VC";

  if (!action) return;

  // ---------------------
  // Wait a bit to let audit logs populate
  // ---------------------
  await new Promise((res) => setTimeout(res, 3000));

  // ---------------------
  // Attempt to detect mod actions via audit logs
  // ---------------------
  try {
    const auditLogs = await newState.guild.fetchAuditLogs({
      type: 24, // MEMBER_UPDATE
      limit: 5,
    });

    const entry = auditLogs.entries.find(
      (e) =>
        e.targetId === newState.id && Date.now() - e.createdTimestamp < 10000
    );

    if (entry && entry.executorId !== newState.id) {
      moderator = `<@${entry.executorId}>`;
    }
  } catch (err) {
    console.error("Failed to fetch audit logs:", err);
  }

  // ---------------------
  // Extra info
  // ---------------------
  switch (action) {
    case "Moved VC":
      extraInfo = `From: <#${oldState.channelId}> → To: <#${
        newState.channelId
      }> (${moderator === "Self" ? "self" : `moved by ${moderator}`})`;
      break;
    case "Joined VC":
      extraInfo = `Channel: <#${newState.channelId}> (${
        moderator === "Self" ? "self" : `joined by ${moderator}`
      })`;
      break;
    case "Left VC":
      extraInfo = `Channel: <#${oldState.channelId}> (${
        moderator === "Self" ? "self" : `left by ${moderator}`
      })`;
      break;
    case "Server Mute":
    case "Unmute":
      extraInfo = `Member was ${
        action === "Server Mute" ? "muted" : "unmuted"
      } by ${moderator}`;
      break;
    case "Server Deafen":
    case "Undeafen":
      extraInfo = `Member was ${
        action === "Server Deafen" ? "deafened" : "undeafened"
      } by ${moderator}`;
      break;
  }

  // ---------------------
  // Send Embed
  // ---------------------
  const embed = new EmbedBuilder()
    .setTitle(`⚠️ Moderation Action: ${action}`)
    .setDescription(
      `> **A voice action occurred.** Please view the data below.`
    )
    .addFields(
      {
        name: "Member:",
        value: `${newState.member} (${newState.id})`,
        inline: true,
      },
      { name: "Moderator:", value: moderator, inline: true },
      { name: "Details:", value: extraInfo || "N/A", inline: false },
      {
        name: "Occurred At:",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      }
    )
    .setAuthor({
      name: client.user.username,
      iconURL: client.user.displayAvatarURL({ dynamic: true }),
    })
    .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
    .setColor("#ff0000")
    .setTimestamp()
    .setFooter({ text: "🍃 HighBot | Logging" });

  sendModLog(embed);
});

// ------------------------
// Audit Log Event Logging
// ------------------------
client.on("guildAuditLogEntryCreate", async (entry) => {
  const logs = loadLogs();

  let embed;

  if (entry.action === 12) {
    if (logs["channelDelete"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: Channel Delete`)
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Deleted Channel:",
            value: `#${entry?.target?.name} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },
          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Deleted At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: guildMember.user.username,
          iconURL: guildMember.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(guildMember.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 10) {
    if (logs["channelCreate"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: Channel Create`)
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Added Channel:",
            value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },

          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Added At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 11) {
    const changes = entry.changes.map(
      (x, i) => `${i}. \`\`${x.key}\`\`: ${x.old} -> ${x.new}`
    );
    if (logs["channelEdit"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: Channel Edit`)
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Edited Channel:",
            value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },
          {
            name: "Changes:",
            value: `${changes.join("\n> ")}` ?? "No Changes Found",
            inline: false,
          },

          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Edited At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 30) {
    if (logs["roleCreate"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: Role Created`)
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Created Role:",
            value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },

          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Created At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 31) {
    const changes = entry.changes
      .filter((x) => x.key !== "colors")
      .map((x, i) => `${i + 1}. \`\`${x.key}\`\`: ${x.old} -> ${x.new}`);
    if (logs["roleEdit"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: Role Edited`)
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Edited Role:",
            value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },
          {
            name: "Changes:",
            value: `> ${changes.join("\n> ")}` ?? "No Changes Found",
            inline: false,
          },

          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Edited At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 32) {
    if (logs["roleDelete"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: Role Deleted`)
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Deleted Role:",
            value: `<@${entry?.target?.id}> (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },

          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Deleted At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 25) {
    if (logs["roleUpdate"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: GuildMemberRoleChange`)
        .setDescription(
          `> **A role was ${
            entry.changes[0].key.includes("remove")
              ? "removed from"
              : "added to"
          } a member.** Please view the data below.`
        )
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Member",
            value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },
          {
            name: "Role:",
            value:
              `<@&${entry?.changes[0].new[0].id}> (${entry?.changes[0].new[0].id})` ??
              "N/A",
            inline: false,
          },

          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Occured At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 22) {
    if (logs["memberBan"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: MemberBan`)
        .setDescription(
          `> **A member was banned.** Please view the data below.`
        )
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Member",
            value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },
          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Banned At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 20) {
    if (logs["memberKick"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: MemberKick`)
        .setDescription(
          `> **A member was kicked.** Please view the data below.`
        )
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Member",
            value: `<@${entry?.targetId}> (${entry?.targetId})` ?? "N/A",
            inline: true,
          },
          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Kicked At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 23) {
    if (logs["memberUnban"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: MemberUnban`)
        .setDescription(
          `> **A member was unbanned.** Please view the data below.`
        )
        .addFields(
          {
            name: "Moderator:",
            value: `${entry?.executor ?? "N/A"}`,
            inline: true,
          },
          {
            name: "Member",
            value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
            inline: true,
          },
          {
            name: "Reason:",
            value: entry.reason ?? "No reason provided",
            inline: false,
          },
          {
            name: "Unbanned At:",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          }
        )
        .setAuthor({
          name: client.user.username,
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `🍃 HighBot | Logging` });
  }
  if (entry.action === 24) {
    if (!entry.changes[0].key.includes("disabled")) return;
    const date = new Date(entry?.changes[0].new);
    const formatted = date.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const isNow = date.getTime() === Date.now();
    if (logs["memberTimeout"])
      embed = new EmbedBuilder()
        .setTitle(`⚠️ Moderation Action: MemberTimeout`)
        .setDescription(
          `> **A member${
            isNow ? " has been timed out" : "`s time out has been removed"
          }.** Please view the data below.`
        );

    if (!isNow) {
      embed.addFields(
        {
          name: "Moderator:",
          value: `${entry?.executor ?? "N/A"}`,
          inline: true,
        },
        {
          name: "Member",
          value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
          inline: true,
        },
        {
          name: "Timed Out Till:",
          value: `${formatted}` ?? "N/A",
          inline: false,
        },
        {
          name: "Reason:",
          value: entry.reason ?? "No reason provided",
          inline: false,
        },
        {
          name: "Timed Out At:",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      );
    } else {
      embed.addFields(
        {
          name: "Moderator:",
          value: `${entry?.executor ?? "N/A"}`,
          inline: true,
        },
        {
          name: "Member",
          value: `${entry?.target} (${entry?.target?.id})` ?? "N/A",
          inline: true,
        },

        {
          name: "Reason:",
          value: entry.reason ?? "No reason provided",
          inline: false,
        },
        {
          name: "Unmuted At:",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        }
      );
    }
  }
  if (embed) sendModLog(embed);
});

// -----------------------------
// Message Delete Logging
// -----------------------------
// -----------------------------
// Message Delete Logging
// -----------------------------
client.on("messageDelete", async (message) => {
  if (message.author?.bot) return;
  const logs = loadLogs();
  if (!logs.messageDeletes || !message.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Message Deleted")
    .addFields(
      { name: "User", value: `${message.author}`, inline: true },
      { name: "Channel", value: `${message.channel}`, inline: true },
      {
        name: "Content",
        value: message.content ? `\`\`\`${message.content}\`\`\`` : "N/A",
        inline: false,
      },
      {
        name: "Attachments",
        value:
          message.attachments.size > 0
            ? message.attachments.map((a) => a.url).join("\n")
            : "None",
        inline: false,
      },
      {
        name: "Time",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      }
    )
    .setColor("#ff0000")
    .setTimestamp();

  await sendModLog(embed);
});

// -----------------------------
// Message Edit Logging
// -----------------------------
client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (newMessage.member?.user?.bot) return;
  const logs = loadLogs();
  if (!logs.messageEdits || !oldMessage.guild) return;
  if (oldMessage.author?.bot) return;

  // Ignore if content didn't change
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Message Edited")
    .addFields(
      { name: "User", value: `${oldMessage.author}`, inline: true },
      { name: "Channel", value: `${oldMessage.channel}`, inline: true },
      {
        name: "Changes::",
        value:
          `\`\`\`${oldMessage.content.trim()}\`\`\`\n->\n\`\`\`${newMessage.content.trim()}\`\`\`` ||
          "N/A",
        inline: false,
      },
      {
        name: "Attachments",
        value:
          newMessage.attachments.size > 0
            ? newMessage.attachments.map((a) => a.url).join("\n")
            : "None Found",
        inline: false,
      },
      {
        name: "Time",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: true,
      }
    )
    .setColor("#ffa500")
    .setTimestamp();

  await sendModLog(embed);
});

client.on("guildMemberAdd", async (member) => {
  if (member.user.bot) return;
  const logs = loadLogs();
  if (!logs.guildMemberAdd) return; // toggle check

  try {
    // --- Determine inviter safely ---
    let inviter = null;

    try {
      const newInvites = await member.guild.invites.fetch().catch(() => null);
      const cachedInvites = cache.getGuildInvites(member.guild.id) || new Map();

      if (newInvites) {
        newInvites.forEach((inv) => {
          const prevUses = cachedInvites.get(inv.code)?.uses || 0;
          if (inv.uses > prevUses) inviter = inv.inviter || null;
          cache.addItem(member.guild.id, inv.code, inv.inviter?.id, inv.uses);
        });
      }
    } catch {
      inviter = null;
    }

    // --- Calculate inviter invite count ---
    let inviteCount = 0;
    if (inviter) {
      const cachedInvites = cache.getGuildInvites(member.guild.id) || new Map();
      cachedInvites.forEach((data) => {
        if (data.inviterId === inviter.id) inviteCount += data.uses;
      });
    }

    // --- Canvas Setup ---
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext("2d");

    // Background gradient
    const bgGradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height
    );
    bgGradient.addColorStop(0, "#0f2027");
    bgGradient.addColorStop(1, "#203a43");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle shapes
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 30,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Welcome text
    ctx.font = "bold 60px Sans-serif";
    ctx.fillStyle = "#00e5ff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    let text = "Welcome!";
    let textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (canvas.width - textWidth) / 2, 60);

    // Member avatar
    const memberAvatar = await loadImage(
      member.user.displayAvatarURL({ extension: "png", size: 256 })
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(200, 200, 100, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(memberAvatar, 100, 100, 200, 200);
    ctx.restore();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(200, 200, 100, 0, Math.PI * 2);
    ctx.stroke();

    // Inviter avatar
    if (inviter) {
      const inviterAvatar = await loadImage(
        inviter.displayAvatarURL({ extension: "png", size: 256 })
      );
      ctx.save();
      ctx.beginPath();
      ctx.arc(600, 200, 100, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(inviterAvatar, 500, 100, 200, 200);
      ctx.restore();
      ctx.strokeStyle = "#ffb74d";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(600, 200, 100, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Username + inviter text
    ctx.font = "28px Sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 0;
    let displayText = inviter
      ? `${member.user.username} invited by ${inviter.username}`
      : member.user.username;
    textWidth = ctx.measureText(displayText).width;
    ctx.fillText(displayText, (canvas.width - textWidth) / 2, 350);

    // Canvas buffer
    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: "welcome.png" });

    // Embed
    const embed = new EmbedBuilder()
      .setTitle(`🎉 Welcome to the server, ${member.user.username}!`)
      .setDescription(
        inviter
          ? `> ${member} was invited by ${inviter}. They have **${inviteCount}** invites.`
          : `> ${member} joined the server!`
      )
      .setColor(inviter ? 0x00bfff : 0xff5555)
      .setImage("attachment://welcome.png")
      .setTimestamp()
      .setFooter({ text: `🍃 HighBot` });

    const channel = await member.guild.channels.fetch(process.env.VC_CHANNEL);
    if (channel) channel.send({ embeds: [embed], files: [attachment] });
  } catch (e) {
    console.error("Error sending welcome message:", e);
  }
});

client.on("guildMemberRemove", async (member) => {
  if (member.user.bot) return;
  const logs = loadLogs();
  console.log(logs.guildMemberRemove);
  if (!logs.guildMemberRemove) return; // toggle check

  try {
    // --- Calculate invites contributed ---
    const cachedInvites = cache.getGuildInvites(member.guild.id) || new Map();
    let inviteCount = 0;
    cachedInvites.forEach((data) => {
      if (data.inviterId === member.id) inviteCount += data.uses;
    });

    // --- Canvas Setup ---
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext("2d");

    // Background gradient
    const bgGradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height
    );
    bgGradient.addColorStop(0, "#3a1c1c");
    bgGradient.addColorStop(1, "#1f0f0f");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 25; i++) {
      ctx.beginPath();
      ctx.arc(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 25,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Goodbye text
    ctx.font = "bold 50px Sans-serif";
    ctx.fillStyle = "#ff5555";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    let text = "Goodbye!";
    let textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (canvas.width - textWidth) / 2, 70);

    // Username
    ctx.font = "36px Sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 0;
    text = member.user.username;
    textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (canvas.width - textWidth) / 2, 130);

    // Avatar
    const memberAvatar = await loadImage(
      member.user.displayAvatarURL({ extension: "png", size: 256 })
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(400, 250, 100, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(memberAvatar, 300, 150, 200, 200);
    ctx.restore();

    ctx.strokeStyle = "#ff5555";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(400, 250, 100, 0, Math.PI * 2);
    ctx.stroke();

    const buffer = canvas.toBuffer();
    const attachment = new AttachmentBuilder(buffer, { name: "goodbye.png" });

    const embed = new EmbedBuilder()
      .setTitle(`😢 ${member.user.username} left the server`)
      .setDescription(
        `> ${member} contributed **${inviteCount}** invite${
          inviteCount === 1 ? "" : "s"
        }`
      )
      .setColor(0xff5555)
      .setImage("attachment://goodbye.png")
      .setTimestamp()
      .setFooter({ text: `🍃 HighBot` });

    const channel = await member.guild.channels.fetch(process.env.VC_CHANNEL);
    if (channel) channel.send({ embeds: [embed], files: [attachment] });
  } catch (err) {
    console.error("Error sending goodbye message:", err);
  }
});

client.login(process.env.BOT_TOKEN);
