const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { execute } = require("../../database/database");
const fs = require("fs");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("highlow")
    .setDescription(
      "Play High or Low! Guess if the next number is higher or lower."
    )
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

    // Start session
    const session = {
      balance: amount,
      rounds: 0,
      current: Math.floor(Math.random() * 100) + 1,
    };

    sessions[userId] = { data: session };
    fs.writeFileSync("./sessions.json", JSON.stringify(sessions), (err) => {
      if (err) console.log(err);
    });

    await execute(`UPDATE economy SET coins = coins - ? WHERE user_id = ?`, [
      amount,
      userId,
    ]);

    const gameEmbed = new EmbedBuilder()
      .setTitle("🎲 Higher or Lower Game")
      .setDescription(
        `> \`\`First number:\`\` **${session.current}**\n> - Guess if the next number is **higher** or **lower**.\n> - The game chooses numbers between 1 - 100.\n\n> ** Click a button below to play.**`
      )
      .setColor("#00b7ff")
      .setFooter({ text: "Max 5 rounds. Each time you guess right = +25% Budz!" })
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [gameEmbed],
      ephemeral: false,
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
              label: "⚡️ Cashout",
              style: 3,
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
  },
};
