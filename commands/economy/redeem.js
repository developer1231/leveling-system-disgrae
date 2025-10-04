const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { execute } = require("../../database/database");
const { getLevelFromXP } = require("../../calculator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("redeem")
    .setDescription("Use/open XP crates")
    .addStringOption((option) =>
      option
        .setName("id")
        .setDescription("The ID of the item to redeem")
        .setRequired(true)
    ),

  async execute(interaction) {
    const itemId = interaction.options.getString("id");

    // Ensure user exists in users table
    await execute(
      `INSERT OR IGNORE INTO users (member_id, xp, current_level, voice, messages) VALUES (?, ?, ?, ?, ?)`,
      [interaction.member.id, 0, 0, 0, 0]
    );

    // Fetch user
    let [userData] = await execute(`SELECT * FROM users WHERE member_id = ?`, [
      interaction.member.id,
    ]);

    let [user] = await execute(`SELECT * FROM economy WHERE user_id = ?`, [
      interaction.member.id,
    ]);

    if (!user) {
      const noInventoryEmbed = new EmbedBuilder()
        .setTitle("❌ Inventory Missing")
        .setDescription(
          "> You don't have any inventory yet. Please use */shop* and buy items first."
        )
        .setColor("Red")
        .setFooter({ text: "🍃 HighBot" })
        .setTimestamp();
      return interaction.reply({ ephemeral: true, embeds: [noInventoryEmbed] });
    }

    let items;
    try {
      items = JSON.parse(user.items || "[]");
    } catch {
      items = [];
    }

    // Find the item by ID
    const itemIndex = items.findIndex((x) => x.id === itemId);
    if (itemIndex === -1) {
      const notFoundEmbed = new EmbedBuilder()
        .setTitle("❌ Item Not Found")
        .setDescription(
          "> That item could not be found in your inventory.\n> Please use */inventory* to view your inventory."
        )
        .setColor("Red")
        .setFooter({ text: "🍃 HighBot" })
        .setTimestamp();
      return interaction.reply({ ephemeral: true, embeds: [notFoundEmbed] });
    }

    const item = items[itemIndex];

    // Check if it is an XP item
    if (item.type !== "xp") {
      const notXpEmbed = new EmbedBuilder()
        .setTitle("❌ Invalid Item")
        .setDescription("> Only **XP items** can be redeemed.")
        .setColor("Red")
        .setFooter({ text: "🍃 HighBot" })
        .setTimestamp();
      return interaction.reply({ ephemeral: true, embeds: [notXpEmbed] });
    }

    // Add XP and remove item from inventory
    const newXp = (userData.xp || 0) + (item.gain || 0);
    items.splice(itemIndex, 1);

    await execute(`UPDATE economy SET items = ? WHERE user_id = ?`, [
      JSON.stringify(items),
      interaction.member.id,
    ]);

    await execute(
      `UPDATE users SET xp = ?, current_level = ? WHERE member_id = ?`,
      [newXp, getLevelFromXP(newXp), interaction.member.id]
    );

    const successEmbed = new EmbedBuilder()
      .setTitle("✨ XP Redeemed")
      .setDescription(
        `> You used **${item.item}** and gained **${
          item.gain
        } XP**!\n> Your **total XP** is now **${newXp}**, and you are **level** **${getLevelFromXP(
          newXp
        )}**.\n> The item has been removed from your inventory.`
      )
      .setColor("#00b7ff")
      .setFooter({ text: "🍃 HighBot" })
      .setTimestamp();

    return interaction.reply({ ephemeral: false, embeds: [successEmbed] });
  },
};
