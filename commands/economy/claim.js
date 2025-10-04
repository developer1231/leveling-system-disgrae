const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const { execute } = require("../../database/database");
const { getLevelFromXP } = require("../../calculator");

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

  // Assign all qualifying roles the user doesn't already have
  for (const roleRow of qualifyingRoles) {
    const roleToGive = await guildMember.guild.roles.fetch(roleRow.role_id);
    if (roleToGive && !guildMember.roles.cache.has(roleToGive.id)) {
      await guildMember.roles.add(roleToGive);
    }
  }

  // Update level & notify if level changed
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
        `INSERT OR IGNORE INTO economy (user_id, coins, items, daily, weekly, work, gift_cap) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, 420, "[]", -1, -1, -1, 0]
      );
    }

    await execute(
      `UPDATE economy SET coins = coins + ${config.level_up_points} WHERE user_id = ?`,
      [userId]
    );

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim all active crates."),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

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

    // fetch all active drops
    const drops = await execute(
      `SELECT * FROM active_drops WHERE guild_id = ?`,
      [guildId]
    );

    console.log(drops, drops.length);
    if (!drops || drops.length === 0) {
      return interaction.reply({
        ephemeral: false,
        embeds: [
          errorEmbed(
            "There are no active crates to claim or all have been claimed already."
          ),
        ],
      });
    }

    let totalBudz = 0;
    let totalXP = 0;
    let itemRewards = [];

    for (const crate of drops) {
      if (crate.claimed_by || Date.now() > crate.expires_at) continue;

      // mark claimed
      await execute(
        `UPDATE active_drops SET claimed_by = ? WHERE guild_id = ? AND id = ?`,
        [userId, guildId, crate.id]
      );

      // reward user
      totalBudz += crate.budz_amount || 0;
      totalXP += crate.xp_amount || 0;

      await execute(`UPDATE economy SET coins = coins + ? WHERE user_id = ?`, [
        crate.budz_amount || 0,
        userId,
      ]);

      await execute(`UPDATE users SET xp = xp + ? WHERE member_id = ?`, [
        crate.xp_amount || 0,
        userId,
      ]);

      // handle items
      const itemsArray = await execute(
        `SELECT * FROM economy WHERE user_id = ?`,
        [userId]
      );
      const shopArray = await execute(`SELECT * FROM shop WHERE id = ?`, [
        crate.store_items,
      ]);

      const items = JSON.parse(itemsArray[0].items);
      const alreadyOwns = items.some((i) => i.id === crate.store_items);

      if (!alreadyOwns && shopArray.length > 0) {
        if (shopArray[0].role_id !== null) {
          let role = await interaction.guild.roles.fetch(shopArray[0].role_id);
          if (role) interaction.member.roles.add(role.id);
        }
        items.push({
          id: shopArray[0].id,
          item: shopArray[0].item,
          type: shopArray[0].type,
          price: shopArray[0].price,
          gain: shopArray[0].gain,
          role_id: shopArray[0].role_id,
          boughtAt: Date.now(),
        });
        await execute(`UPDATE economy SET items = ? WHERE user_id = ?`, [
          JSON.stringify(items),
          userId,
        ]);

        itemRewards.push(shopArray[0].item);
      }
    }

    // update user levels/roles
    await updateUserAndNotify(null, interaction.member);

    if (totalBudz === 0 && totalXP === 0 && itemRewards.length === 0) {
      return interaction.reply({
        ephemeral: false,
        embeds: [
          errorEmbed(
            "No active crates available to claim or all have been claimed already."
          ),
        ],
      });
    }

    const rewards = [];
    if (totalBudz > 0) rewards.push(`💰 **${totalBudz} Budz™**`);
    if (totalXP > 0) rewards.push(`⚡ **${totalXP} XP**`);
    if (itemRewards.length > 0)
      rewards.push(...itemRewards.map((i) => `🎁 **${i}**`));

    const rewardText = rewards.join("\n> - ");

    const successEmbed = new EmbedBuilder()
      .setTitle("🎁 Crates Claimed!")
      .setDescription(
        `> ${interaction.member} claimed all available crates!\n\n> **They have won:**\n> - ${rewardText}\n\n### Commands\n> - Use */inventory* to check your items\n> - Use */stats* to check your Budz & XP`
      )
      .setColor("Green")
      .setAuthor({
        name: `${interaction.client.user.username}`,
        iconURL: `${interaction.client.user.displayAvatarURL()}`,
      })
      .setFooter({ text: `🍃 HighBot` })
      .setTimestamp();

    await interaction.reply({
      embeds: [successEmbed],
      components: [],
    });
  },
};
