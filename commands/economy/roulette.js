const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription(
      "Play Roulette! Bet on a number (0-36) or color (red/black)."
    )
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("Amount to bet").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("bet")
        .setDescription("Your bet (number 0-36 or color 'red'/'black')")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.member.id;
    const amount = interaction.options.getInteger("amount");
    const bet = interaction.options.getString("bet").toLowerCase();

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

    const redNumbers = [
      1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
    ];

    // Initial spinning message
    let spinEmbed = new EmbedBuilder()
      .setTitle("🎰 Roulette Spinning...")
      .setDescription("> Spinning the wheel...")
      .setColor("#00b7ff")
      .setThumbnail(
        "https://assets.nintendo.com/image/upload/c_fill,w_1200/q_auto:best/f_auto/dpr_2.0/ncom/software/switch/70010000030448/ceb2b9555219d76671d0cbe14ce2152df16df0677dd1d4d86772654e649f87b2"
      )
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    const message = await interaction.reply({
      embeds: [spinEmbed],
      ephemeral: false,
    });

    // Spin animation - show 10 random numbers/colors
    for (let i = 0; i < 10; i++) {
      const randomNum = Math.floor(Math.random() * 37);
      const randomColor = redNumbers.includes(randomNum)
        ? "red"
        : randomNum === 0
        ? "green"
        : "black";

      spinEmbed.setDescription(
        `> Spinning...\n> **${randomNum}** (${randomColor})`
      );
      await new Promise((res) => setTimeout(res, 500)); // wait 0.5s per spin
      await interaction.editReply({ embeds: [spinEmbed] });
    }

    // Determine final result
    const finalNumber = Math.floor(Math.random() * 37);
    const finalColor = redNumbers.includes(finalNumber)
      ? "red"
      : finalNumber === 0
      ? "green"
      : "black";

    let winnings = 0;
    if (!isNaN(bet)) {
      const numberBet = parseInt(bet);
      if (numberBet === finalNumber) winnings = amount * 35;
    } else if (bet === "red" || bet === "black") {
      if (bet === finalColor) winnings = amount * 2;
    }

    if (winnings > 0) {
      await execute(`UPDATE economy SET coins = coins + ? WHERE user_id = ?`, [
        winnings,
        userId,
      ]);
    } else {
      await execute(`UPDATE economy SET coins = coins - ? WHERE user_id = ?`, [
        amount,
        userId,
      ]);
    }

    spinEmbed
      .setTitle("🎰 Roulette Result")
      .setDescription(
        `> **Spun Number:** ${finalNumber} (${finalColor})\n> **Your chosen bet:** ${bet}\n> You ${
          winnings ? "won" : "lost"
        } ${
          winnings || amount
        } **Budz™**!\n### Commands\n> - Use */stats* to view your profile.\n> - Use */richest* to view the economy leaderboard.`
      )
      .setColor(winnings ? "Green" : "Red")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setThumbnail(
        "https://assets.nintendo.com/image/upload/c_fill,w_1200/q_auto:best/f_auto/dpr_2.0/ncom/software/switch/70010000030448/ceb2b9555219d76671d0cbe14ce2152df16df0677dd1d4d86772654e649f87b2"
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [spinEmbed], ephemeral: false });
  },
};
