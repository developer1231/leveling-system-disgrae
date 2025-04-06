require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
console.log(process.env.BOT_TOKEN);
const { execute, getCurrentDateTime } = require("./database/database");

const {
  REST,
  Routes,
  ChannelType,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  Embed,
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

client.on(Events.MessageCreate, async (message) => {
  let Address = "";
  if (
    message.channel.id === process.env.SOLANA_SMART_ALERTS ||
    message.channel.id === process.env.BNB_SMART_ALERTS
  ) {
    let incomingChannel = message.guild.channels.cache.find(
      (c) =>
        c.id ===
        (message.channel.id === process.env.SOLANA_SMART_ALERTS
          ? process.env.SOLANA_SMART_ALERTS
          : process.env.BNB_SMART_ALERTS)
    );
    console.log("Through");
    console.log(message);
    if (message.embeds.length > 0) {
      const time = new Date().getTime();
      const embed = message.embeds[0];
      const body = embed.data.description;
      console.log(body);
      const matches = [
        ...body.matchAll(
          /sent [\d,.]+ \[([^\]]+)\]\(https?:\/\/[^\)]*tokenAddress=([^&\)]+)[^\)]*\) \(\$([\d,]+\.\d+)\)/g
        ),
      ];

      // Convert to array of [coin, amount, token address] while removing commas
      const coinNames = matches.map((match) => [
        match[1], // Coin name (including emoji)
        parseFloat(match[3].replace(/,/g, "")), // Amount as float
        match[2], // Token address (whatever value is after tokenAddress=)
      ]);

      console.log(coinNames);
      const chain =
        message.channel.id === process.env.SOLANA_SMART_ALERTS
          ? "Solana"
          : "BNB";
      for (let i = 0; i < coinNames.length; i++) {
        let exists = await execute(
          `SELECT * FROM coins WHERE ca =? AND message_id = ?`,
          [coinNames[i][0], message.id]
        );

        if (exists.length === 0) {
          await execute(
            `INSERT INTO coins (message_id, ca, timestamp, chain, amount, sent, usd, address) VALUES (?,?,?,?,?,?, ?, ?)`,
            [
              message.id,
              coinNames[i][0],
              time,
              chain,
              1,
              "false",
              coinNames[i][1],
              coinNames[i][2],
            ]
          );
        } else {
          console.log(coinNames[i][1]);
          await execute(
            `UPDATE coins SET amount = amount+1, usd = usd + ? WHERE ca =? AND timestamp = ?`,
            [coinNames[i][1], exists[0].ca, time]
          );
        }
      }

      // HOT REPEATS ALERT
      for (let i = 0; i < coinNames.length; i++) {
        let sent = false;
        let all = await execute(
          `SELECT * FROM coins WHERE ca =? AND sent = ?`,
          [coinNames[i][0], "false"]
        );

        const totalAmount = all.reduce(
          (sum, item) => sum + (Number(item.amount) || 0),
          0
        );
        const totalUsd = all.reduce(
          (sum, item) => sum + (Number(item.usd) || 0),
          0
        );
        console.log(chain);

        const hasFalse = all.some((item) => item.sent === "false");

        if (totalAmount >= 3 && hasFalse) {
          const hotRepeatsChannel = message.guild.channels.cache.find(
            (c) =>
              c.id ===
              (chain === "Solana"
                ? process.env.SOL_HOT_REPEATS
                : process.env.BNB_HOT_REPEATS)
          );
          console.log(hotRepeatsChannel);
          let notifications = "";
          console.log("incomingChannel", incomingChannel.id);
          for (const key in all) {
            const message = await incomingChannel.messages.fetch(
              all[key].message_id
            );
            if (!message) return;
            console.log(message);

            notifications += `> 🔗 ${message.url} | <t:${Number(
              all[key].timestamp / 1000
            ).toFixed(0)}:R> - ${all[key].amount}x\n`;
          }
          const hotRepeatsEmbed = new EmbedBuilder()
            .setTitle(`🔁 ${coinNames[i][0]}`)
            .setAuthor({
              name: `${client.user.username}`,
              iconURL: client.user.avatarURL(),
            })
            .setColor("Blue")
            .setThumbnail(client.user.avatarURL())

            .setDescription(
              `> **Chain:** ${chain}\n> **Amount:** $${totalUsd.toFixed(
                2
              )}\n\`\`\`${coinNames[i][2]} | ${
                coinNames[i][0]
              }\`\`\`\nMultiple mentions in the last few messages:\n\n> **Mentions**\n${notifications}\n\n> **Tools**\n> [Axiom Pro](https://axiom.trade/@leahfarns) | [Nova Bot](https://t.me/TradeonNovaBot?start=r-LeahFarnsworth) | [Bloom Bot](https://t.me/BloomSolana_bot?start=ref_leahfarns) | [GMGN SOL](https://gmgn.ai/?ref=8djYlQbM&chain=sol) | [GMGN BNB](https://gmgn.ai/?ref=8djYlQbM&chain=bsc)`
            )
            .setFooter({
              text: `SmartTrades | 🔥 Hot Repeat Alert`,
            });
          if (chain == "BNB" || chain == "Solana") {
            hotRepeatsEmbed.setImage(
              `${
                chain == "BNB"
                  ? "https://www.cointribune.com/app/uploads/2021/02/12706B4A-F4A6-4225-AD4B-C8AED0ACCFDB.jpeg"
                  : "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT3YkHVTXNG5ok4RxPCpLNmEUbZct2ekk07EQ&s"
              }`
            );
          }
          await hotRepeatsChannel.send({
            embeds: [hotRepeatsEmbed],
          });
          await execute(`UPDATE coins SET sent =? WHERE ca =?`, [
            "true",
            coinNames[i][0],
          ]);
          let dailyData = await execute(`SELECT * FROM free WHERE id = ?`, [
            "base",
          ]);
          // DAILY DATA
          if (dailyData[0].amount < 3 && chain === "Solana") {
            sent = true;
            await execute(`UPDATE free SET amount = amount + 1 WHERE id = ?`, [
              "base",
            ]);
            let freeChannel = message.guild.channels.cache.find(
              (c) => c.id === process.env.FREE_CHANNEL_ID
            );
            sad;

            const newEmbed = EmbedBuilder.from(hotRepeatsEmbed)
              .setAuthor({
                name: `${client.user.username}`,
                iconURL: client.user.avatarURL(),
              })
              .setColor("Blue")
              .setTitle(`${embed.data.title}`)
              .setFooter({
                text: `SmartTrades | 💰 Free Hot Alert`,
              })
              .setThumbnail(client.user.avatarURL());
            await freeChannel.send({
              embeds: [newEmbed],
            });
          }
        }
      }
    }
  }
});

client.login(process.env.BOT_TOKEN);
