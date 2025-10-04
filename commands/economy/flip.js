const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("flip")
    .setDescription("Flip a coin and double your Budz™ if you guess right!")
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("Amount to bet").setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("choice")
        .setDescription("Heads or Tails")
        .setRequired(true)
        .addChoices(
          { name: "Heads", value: "Heads" },
          { name: "Tails", value: "Tails" }
        )
    ),

  async execute(interaction) {
    const userId = interaction.member.id;
    const amount = interaction.options.getInteger("amount");
    const choice = interaction.options.getString("choice");

    // helper for error embeds
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

    // send initial "flipping" embed
    const message = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🪙 Flipping Coin...")
          .setDescription("> Tossing the coin high up in the sky...")
          .setColor("#00b7ff")
          .setAuthor({
            name: `${interaction.client.user.username}`,
            iconURL: `${interaction.client.user.displayAvatarURL()}`,
          })
          .setFooter({ text: `🍃 HighBot` })
          .setTimestamp(),
      ],
      fetchReply: true,

      ephemeral: false,
    });

    // Animation cycle
    const flips = [
      {
        name: "Heads",
        img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT8W8Euyg3VAe-X2vBRSAUTtyYQaCVFJYH6ohNoYJ2VPE6tf0bKQh_aWi90RbVnouBv1cM&usqp=CAU",
      },
      {
        name: "Tails",
        img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRrvTbyRNUno8Yv7fTAOJog5o8t6Y-Cx9j-U1X9Ync4eUVyBzLcR_UMtJliJk-T-op_IMw&usqp=CAU",
      },
    ];

    let i = 0;
    const interval = setInterval(async () => {
      if (i >= 5) {
        clearInterval(interval);

        // actual result
        const result = Math.random() < 0.5 ? "Heads" : "Tails";
        const won = result === choice;

        // Update coins
        if (won) {
          await execute(
            `UPDATE economy SET coins = coins + ? WHERE user_id = ?`,
            [amount, userId]
          );
        } else {
          await execute(
            `UPDATE economy SET coins = coins - ? WHERE user_id = ?`,
            [amount, userId]
          );
        }

        const embed = new EmbedBuilder()
          .setTitle("🪙 Coin Flip Result")
          .setDescription(
            `> **You guessed:** \`\`${choice}\`\`\n> **It landed on:** \`\`${result}\`\`\n> ${
              won
                ? `🎉 You won **${amount} Budz™**!`
                : `😢 You lost **${amount} Budz™**.`
            }\n### Commands\n> - Use */stats* to view your profile.\n> - Use */richest* to view the economy leaderboard.`
          )
          .setColor(won ? "Green" : "Red")
          .setAuthor({
            name: `${interaction.client.user.username}`,
            iconURL: `${interaction.client.user.displayAvatarURL()}`,
          })
          .setFooter({ text: `🍃 HighBot` })
          .setTimestamp()
          .setImage(result === "Heads" ? flips[0].img : flips[1].img);

        return interaction.editReply({ embeds: [embed], ephemeral: false });
      } else {
        const flip = flips[i % 2];
        const embed = new EmbedBuilder()
          .setTitle("🪙 Flipping Coin...")
          .setDescription(`> **${flip.name}**`)
          .setColor("#00b7ff")
          .setAuthor({
            name: `${interaction.client.user.username}`,
            iconURL: `${interaction.client.user.displayAvatarURL()}`,
          })
          .setFooter({ text: `🍃 HighBot` })
          .setTimestamp()
          .setImage(flip.img);

        interaction.editReply({ embeds: [embed], ephemeral: false });
        i++;
      }
    }, 800); // update every ~0.8s
  },
};
