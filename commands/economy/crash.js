const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { execute } = require("../../database/database");
const fs = require("fs");
function renderGraph(multiplier) {
  const maxBars = 20;
  const filled = Math.min(Math.floor(multiplier * 2), maxBars); // scale
  return "📈 " + "▰".repeat(filled) + "▱".repeat(maxBars - filled);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("crash")
    .setDescription("Play Crash! Cash out before it crashes.")
    .addIntegerOption((option) =>
      option.setName("amount").setDescription("Amount to bet").setRequired(true)
    ),

  async execute(interaction) {
    let sessions = JSON.parse(fs.readFileSync("./sessions.json", "utf8"));
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
        embeds: [
          errorEmbed(
            "You're not registered yet.\n> Please use */stats* to create a profile."
          ),
        ],
      });

    if (user[0].coins < amount)
      return interaction.reply({
        ephemeral: true,
        embeds: [
          errorEmbed(
            "Not enough **Budz™**.\n> Please use */daily*, */weekly*, */work*, to quickly receive some coins."
          ),
        ],
      });

    await execute(`UPDATE economy SET coins = coins - ? WHERE user_id = ?`, [
      amount,
      userId,
    ]);

    // Determine crash point
    const crashMultiplier = (Math.random() * 5 + 1).toFixed(2); // Crash between 1x and 6x
    let session = { amount, crashMultiplier, cashedOut: false };
    sessions[userId] = { data: session };
    fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

    // Initial embed
    const now = Date.now();
    const startDate = new Date(now + 15000);
    const embed = new EmbedBuilder()
      .setTitle("💥 | Crash Game")
      .setThumbnail(
        "https://cdn.dribbble.com/userupload/12335909/file/original-66185e72722001cc894b7ade7fc5e04a.png"
      )
      .setDescription(
        `> \`\`Bet:\`\` **${amount} Budz™**\n> \`\`Rules:\`\`\n> - The multiplier keeps going up at random intervals.\n> - At some random multiplier, the game crashes. If you haven't cashed out by then, you have lost your prize.\n> - The **longer** you wait.. the more **risk**.. the more **reward**!\n\n> **Get ready.. game starting in <t:${Math.floor(
          startDate.getTime() / 1000
        )}:R>!**`
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
      ephemeral: false,
    });
    try {
      setTimeout(() => {
        // Animate multiplier
        let multiplier = 1.0;
        const interval = setInterval(async () => {
          sessions = JSON.parse(fs.readFileSync("./sessions.json", "utf8"));
          session = sessions[userId].data;
          multiplier += Math.random() * 0.3; // small random increment
          session.currentMultiplier = multiplier;
          fs.writeFileSync("./sessions.json", JSON.stringify(sessions));

          if (multiplier >= crashMultiplier) {
            // Crash

            clearInterval(interval);
            if (!session.cashedOut) {
              const crashEmbed = EmbedBuilder.from(embed)
                .setTitle("💥 | Crash!")
                .setDescription(
                  `> The game crashed at **${crashMultiplier}x**!\n> You haven't **Cashed Out** yet, and you therefore **lost ${amount} Budz™.**`
                )
                .setAuthor({
                  name: `${interaction.client.user.username}`,
                  iconURL: `${interaction.client.user.displayAvatarURL()}`,
                })
                .setFooter({ text: `🍃 HighBot` })
                .setTimestamp()
                .setColor("Red");
              await interaction.editReply({
                embeds: [crashEmbed],
                components: [],

                ephemeral: false,
              });
            }
          } else if (session.cashedOut) {
            clearInterval(interval); // stop animation if user cashed out
            console.log("yes");
          } else {
            console.log("what");
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("crash_cashout")
                .setLabel("Cashout")
                .setStyle(ButtonStyle.Secondary)
            );
            const liveEmbed = EmbedBuilder.from(embed)
              .setDescription(
                `> \`\`Bet:\`\` **${amount} Budz™**\n> \`\`Multiplier:\`\` **${multiplier.toFixed(
                  2
                )}x**\n> ${renderGraph(
                  multiplier
                )}\n\n> **Click cashout to secure your prize!**`
              )
              .setAuthor({
                name: `${interaction.client.user.username}`,
                iconURL: `${interaction.client.user.displayAvatarURL()}`,
              })
              .setFooter({ text: `🍃 HighBot` })
              .setTimestamp();
            await interaction.editReply({
              embeds: [liveEmbed],
              components: [row],

              ephemeral: false,
            });
          }
        }, 800);
      }, 15000);
    } catch (e) {}
  },
};
