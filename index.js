// all we need:
// admin command to add shit
// fix desings of all

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
  execute,
  getCurrentDateTime,
  getCurrentTimestamp,
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
} = require("discord.js");
const {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  Collection,
  EmbedBuilder,
} = require("discord.js");
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
const voiceJoinTimestamps = new Map();

async function updateUserAndNotify(message, member) {
  const config = JSON.parse(fs.readFileSync("./settings.json", "utf8"));

  let newUserData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
    message ? message.member.id : member.id,
  ]);

  const xp = newUserData[0].xp;
  const userLevel = newUserData[0].current_level;
  console.log(userLevel);
  const newLevel = getLevelFromXP(xp);
  console.log(newLevel);
  if (userLevel !== newLevel) {
    await execute(`UPDATE users SET current_level = ? WHERE member_id = ?`, [
      newLevel,
      message ? message.member.id : member.id,
    ]);

    const guildMember = message
      ? message.member
      : await member.guild.members.fetch(member.id);

    const roleName = `Level ${newLevel}`;

    let role = guildMember.guild.roles.cache.find((r) => r.name === roleName);

    if (!role) {
      role = await guildMember.guild.roles.create({
        name: roleName,
        color: "Random",
        reason: `Auto-created for level ${newLevel}`,
      });
    }

    if (!guildMember.roles.cache.has(role.id)) {
      await guildMember.roles.add(role);
    }
    if (config.level_up) {
      const channel = await (message
        ? message.guild.channels.fetch(config.channel_id)
        : member.guild.channels.fetch(config.channel_id));

      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff99)
          .setTitle("🎉 | Level Up!")
          .setDescription(
            `${guildMember} leveled up to **Level ${newLevel}** and received the **${role}** role!`
          )
          .setAuthor({
            name: guildMember.user.username,
            iconURL: guildMember.user.displayAvatarURL({ dynamic: true }),
          })
          .setThumbnail(guildMember.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp()
          .setFooter({ text: `Keep going! 💪` });
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

  // Cap at max_increment
  if (totalIncrement > maxIncrement) {
    totalIncrement = maxIncrement;
  }

  return totalIncrement || 1;
}
client.on("voiceStateUpdate", async (oldState, newState) => {
  let blacklist = await execute(
    `SELECT * FROM blacklist WHERE channel_id = ?`,
    [oldState.channelId]
  );
  if (blacklist.length > 0) return;
  if (newState.member.user.bot) return;

  const memberId = newState.member.id;

  if (!oldState.channelId && newState.channelId) {
    voiceJoinTimestamps.set(memberId, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    const joinTime = voiceJoinTimestamps.get(memberId);
    if (!joinTime) return;

    const leaveTime = Date.now();
    const durationMs = leaveTime - joinTime;
    const minutesInVoice = Math.floor(durationMs / 60000);

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
          `INSERT INTO users (member_id, xp, current_level, voice, messages) VALUES (?, ?, ?, ?, ?)`,
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
  }
});

client.on(Events.MessageCreate, async (message) => {
  let blacklist = await execute(
    `SELECT * FROM blacklist WHERE channel_id = ?`,
    [message.channel.id]
  );
  if (blacklist.length > 0) return;
  if (message.member.user.bot) return;

  let userData = await execute(`SELECT * FROM users WHERE member_id = ?`, [
    message.member.id,
  ]);
  if (userData.length === 0) {
    await execute(
      `INSERT INTO users (member_id, xp, current_level, voice, messages) VALUES (?, ?, ?, ?, ?)`,
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
});

client.login(process.env.BOT_TOKEN);
