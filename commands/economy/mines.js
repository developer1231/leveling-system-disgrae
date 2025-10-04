const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { execute } = require("../../database/database");
const fs = require("fs");

const GRID_SIZE = 4;
const TOTAL_MINES = 3;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mines")
    .setDescription("Play Mines! Reveal tiles, avoid the bombs.")
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("Amount to bet").setRequired(true)
    ),

  async execute(interaction) {
    const sessions = JSON.parse(fs.readFileSync("./sessions.json", "utf8"));
    const userId = interaction.member.id;
    const amount = interaction.options.getInteger("amount");

    const errorEmbed = (msg) =>
      new EmbedBuilder()
        .setTitle("🚫 | Error")
        .setDescription(`> ${msg}`)
        .setColor("Red")

        .setAuthor({
          name: `${interaction.client.user.username}`,
          iconURL: `${interaction.client.user.displayAvatarURL()}`,
        })
        .setFooter({ text: `🍃 HighBot` })
        .setTimestamp();

    if (amount <= 0)
      return interaction.reply({
        ephemeral: true,
        embeds: [errorEmbed("Invalid bet amount.")],
      });

    const user = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      userId,
    ]);
    if (!user.length)
      return interaction.reply({
        ephemeral: true,
        embeds: [errorEmbed("You're not registered yet.")],
      });

    if (user[0].coins < amount)
      return interaction.reply({
        ephemeral: true,
        embeds: [errorEmbed("Not enough **Budz™**.")],
      });

    await execute(`UPDATE economy SET coins = coins - ? WHERE user_id = ?`, [
      amount,
      userId,
    ]);

    // Place mines randomly
    const minePositions = new Set();
    while (minePositions.size < TOTAL_MINES) {
      const pos = Math.floor(Math.random() * GRID_SIZE * GRID_SIZE);
      minePositions.add(pos);
    }

    // Create session
    const session = {
      game: "mines",
      amount,
      revealed: [],
      mines: [...minePositions],
      cashedOut: false,
    };
    sessions[userId] = { data: session };
    fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

    // Create buttons grid
    const makeGrid = () => {
      const rows = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        const row = new ActionRowBuilder();
        for (let x = 0; x < GRID_SIZE; x++) {
          const index = y * GRID_SIZE + x;
          const revealed = session.revealed.includes(index);
          const btn = new ButtonBuilder()
            .setCustomId(`mines_${index}`)
            .setLabel(revealed ? "✅" : "⬜")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(revealed || session.cashedOut);
          row.addComponents(btn);
        }
        rows.push(row);
        console.log(rows.length);
      }
      // Cashout row
      const cashoutRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("mines_cashout")
          .setLabel("💰 Cashout")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(session.cashedOut)
      );
      rows.push(cashoutRow);
      return rows;
    };

    const embed = new EmbedBuilder()
      .setTitle("💣 Mines Game")
      .setThumbnail(
        "https://storage.googleapis.com/kickthe/assets/images/games/mines-hacksawgaming/gb/gbp/tile_large.jpg"
      )
      .setDescription(
        `> Bet: **${amount} Budz™**\n### Instructions\n> - Reveal safe tiles to increase multiplier!\n> - There are 3 bombs in the game. Hitting a bomb means you will lose your initial bet and ANY money you've made so far.\n> - Cashout anytime to secure winnings.`
      )
      .setColor("#00b7ff")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      components: makeGrid(),
      ephemeral: false,
    });
  },
};
