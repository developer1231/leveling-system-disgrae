require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const {
  execute,
  getCurrentDateTime,
  getCurrentTimestamp,
} = require("./database/database");

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

client.on(Events.InteractionCreate, async (interaction) => {
  let command = client.commands.get(interaction.commandName);
  if (interaction.isCommand()) {
    command.execute(interaction);
  }
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "reason-modal") {
      let userData = await execute(`SELECT * FROM status WHERE member_id = ?`, [
        interaction.member.id,
      ]);
      let reason = interaction.fields.getTextInputValue("reason");
      let duration = interaction.fields.getTextInputValue("duration");
      if (isNaN(Number(duration))) {
        return interaction.reply({
          ephemeral: true,
          content: `> :x: You must provide an actual duration in days.\n> Example: 12, or 15.`,
        });
      }
      const adminChannel = await interaction.guild.channels.fetch(
        process.env.ADMIN_CHANNEL
      );
      const toAdmin = new EmbedBuilder()
        .setTitle("⚠️ | Leave Requested")
        .setThumbnail(interaction.member.user.displayAvatarURL())
        .setDescription(
          `> Dear admins, a member has planned a leave and requested to change their status. Please view the details down below:\n\n> **User:** ${
            interaction.member
          }\n> **Current Status:** ${
            userData[0].status
          }\n> **Requested Status:** ${
            userData[0].approved
          }\n> **Duration of Leave:** ${duration}d\n> **Reason for the leave**: ${reason}\n> **Previous Update Occured At:** <t:${Math.round(
            userData[0].timestamp / 1000
          )}:R>\n\n> Please use the buttons below to either **Deny** or **Accept** this request.`
        )
        .setTimestamp()
        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setColor("White");
      const action = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Success)
          .setLabel("Accept")
          .setCustomId("accept"),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Danger)
          .setLabel("Deny")
          .setCustomId("deny")
      );
      let k = await adminChannel.send({
        embeds: [toAdmin],
        components: [action],
      });
      await execute(
        `INSERT INTO messages (message_id, member_id) VALUES (?, ?)`,
        [k.id, interaction.member.id]
      );
      await interaction.reply({
        ephemeral: true,
        content: `> :white_check_mark: You have successfully requested your leave. Please wait up to 1-2 days for the admins to process your request. Whether your leave has been accepted or denied will be communicated over through your DM.\n> **Make sure that your DM is open so that we can send you a message**.`,
      });
    }
  }
  if (interaction.isButton()) {
    if (interaction.customId === "deny") {
      let messageData = await execute(
        `SELECT * FROM messages WHERE message_id = ?`,
        [interaction.message.id]
      );
      let userData = await execute(`SELECT * FROM status WHERE member_id = ?`, [
        messageData[0].member_id,
      ]);
      const toUser = await interaction.guild.members.fetch(
        userData[0].member_id
      );
      const actionrows = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel("Accept")
          .setDisabled(true)
          .setCustomId("accept"),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Danger)
          .setLabel("Deny")
          .setDisabled(true)
          .setCustomId("deny")
      );
      let newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor("DarkRed")
        .setTitle(`❌ | Leave Request Denied`)
        .setDescription(
          `> **This request has been denied by ${
            interaction.member
          } at ${getCurrentDateTime()}**\n` +
            interaction.message.embeds[0].data.description
        );
      interaction.message.edit({
        embeds: [newEmbed],
        components: [actionrows],
      });
      await execute(`DELETE FROM messages WHERE message_id = ?`, [
        interaction.message.id,
      ]);
      try {
        let toUserEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("DarkRed")
          .setTitle(`❌ | Leave Request Denied`)
          .setDescription(
            `> Dear ${toUser}, you recently requested a leave. The request has been processed. Please view the verdict below:\n\n> **This request has been denied by ${
              interaction.member
            } at ${getCurrentDateTime()}**\n> Would you like to appeal? That is possible. Please contact ${
              interaction.member
            } for their reasoning and for more negotiation.`
          );
        await toUser.send({ embeds: [toUserEmbed] });
      } catch (e) {}
      await interaction.reply({
        ephemeral: true,
        content: `> :white_check_mark: You have successfully denied this request.`,
      });
    }
    if (interaction.customId === "accept") {
      let messageData = await execute(
        `SELECT * FROM messages WHERE message_id = ?`,
        [interaction.message.id]
      );
      let userData = await execute(`SELECT * FROM status WHERE member_id = ?`, [
        messageData[0].member_id,
      ]);
      const toUser = await interaction.guild.members.fetch(
        userData[0].member_id
      );
      const actionrows = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel("Accept")
          .setDisabled(true)
          .setCustomId("accept"),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Danger)
          .setLabel("Deny")
          .setDisabled(true)
          .setCustomId("deny")
      );
      let newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor("DarkRed")
        .setTitle(`✅ | Leave Request Accepted`)
        .setDescription(
          `> **This request has been accepted by ${
            interaction.member
          } at ${getCurrentDateTime()}**\n` +
            interaction.message.embeds[0].data.description
        );
      interaction.message.edit({
        embeds: [newEmbed],
        components: [actionrows],
      });
      await execute(
        `UPDATE status SET status = ?, timestamp = ? WHERE member_id = ?`,
        [userData[0].approved, getCurrentTimestamp(), toUser.id]
      );
      await execute(`DELETE FROM messages WHERE message_id = ?`, [
        interaction.message.id,
      ]);
      try {
        let toUserEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor("DarkGreen")
          .setTitle(`✅ | Leave Request Accepted`)
          .setDescription(
            `> Dear ${toUser}, you recently requested a leave. The request has been processed. Please view the verdict below:\n\n> **This request has been accepted by ${
              interaction.member
            } at ${getCurrentDateTime()}**\n> Your status has automatically been changed to ${
              userData[0].approved
            }.`
          );
        await toUser.send({ embeds: [toUserEmbed] });
      } catch (e) {}
      await interaction.reply({
        ephemeral: true,
        content: `> :white_check_mark: You have successfully accepted this request.`,
      });
    }
  }
});

client.login(process.env.BOT_TOKEN);
