const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { execute } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop-edit")
    .setDescription("Manage the shop")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing shop item")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Select an item to edit")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("name").setDescription("New name for the item")
        )
        .addIntegerOption((opt) =>
          opt.setName("price").setDescription("New price for the item")
        )
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("New type for the item")
            .addChoices(
              { name: "Role", value: "roles" },
              { name: "XP Boost", value: "xp" },
              { name: "Cosmetic", value: "cosmetic" }
            )
        )
        .addIntegerOption((opt) =>
          opt.setName("gain").setDescription("XP gain value (for XP type)")
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Discord role (for role type)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete an existing shop item")
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription("Select an item to delete")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    if (interaction.commandName !== "shop-edit") return;
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: "> 🚫 Only **admins** can add shop items.",
      });
    }
    const focusedValue = interaction.options.getFocused();
    const rows = await execute(`SELECT * FROM shop`);
    const choices = rows.map((row) => ({
      name: `${row.item} (${row.type}) [${row.id}]`,
      value: row.id.toString(),
    }));

    const filtered = choices.filter((choice) =>
      choice.name.toLowerCase().includes(focusedValue.toLowerCase())
    );

    await interaction.respond(filtered.slice(0, 25));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "delete") {
      const itemId = interaction.options.getString("item");
      const [shopItem] = await execute(`SELECT * FROM shop WHERE id = ?`, [
        itemId,
      ]);

      if (!shopItem) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle("❌ Item Not Found")
          .setDescription(
            "> That item does not exist in the shop.\n> Please use */shop* to view all items."
          )
          .setColor("Red")
          .setFooter({ text: "🍃 HighBot" })
          .setTimestamp();
        return interaction.reply({ ephemeral: true, embeds: [notFoundEmbed] });
      }

      // Remove from shop
      await execute(`DELETE FROM shop WHERE id = ?`, [itemId]);

      // Remove from all user inventories
      const users = await execute(
        `SELECT user_id, items FROM economy WHERE items LIKE ?`,
        [`%${itemId}%`]
      );

      for (const user of users) {
        let userItems = [];
        try {
          userItems = JSON.parse(user.items);
        } catch {}
        userItems = userItems.filter((itm) => itm.id !== itemId);
        await execute(`UPDATE economy SET items = ? WHERE user_id = ?`, [
          JSON.stringify(userItems),
          user.user_id,
        ]);
      }

      const deletedEmbed = new EmbedBuilder()
        .setTitle("🗑️ Item Deleted")
        .setDescription(
          `> Deleted **${shopItem.item}** from the shop and all user inventories have been updated accordingly.`
        )
        .setColor("#00b7ff")
        .setFooter({ text: "🍃 HighBot" })
        .setTimestamp();
      return interaction.reply({ ephemeral: true, embeds: [deletedEmbed] });
    }

    if (sub === "edit") {
      const itemId = interaction.options.getString("item");
      const [shopItem] = await execute(`SELECT * FROM shop WHERE id = ?`, [
        itemId,
      ]);

      if (!shopItem) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle("❌ Item Not Found")
          .setDescription(
            "> That item does not exist in the shop.\n> Please use */shop* to view all items."
          )
          .setColor("Red")
          .setFooter({ text: "🍃 HighBot" })
          .setTimestamp();
        return interaction.reply({ ephemeral: true, embeds: [notFoundEmbed] });
      }

      const newName = interaction.options.getString("name") || shopItem.item;
      const newPrice =
        interaction.options.getInteger("price") ?? shopItem.price;
      const newType = interaction.options.getString("type") || shopItem.type;
      const newGain = interaction.options.getInteger("gain") ?? shopItem.gain;
      const newRole =
        interaction.options.getRole("role")?.id || shopItem.role_id;

      // Update shop table
      await execute(
        `UPDATE shop SET item = ?, price = ?, type = ?, gain = ?, role_id = ? WHERE id = ?`,
        [newName, newPrice, newType, newGain, newRole, itemId]
      );

      // Update all user inventories
      const users = await execute(
        `SELECT user_id, items FROM economy WHERE items LIKE ?`,
        [`%${itemId}%`]
      );

      for (const user of users) {
        let userItems = [];
        try {
          userItems = JSON.parse(user.items);
        } catch {}

        let changed = false;
        userItems = userItems.map((itm) => {
          if (itm.id === itemId) {
            changed = true;
            return {
              ...itm,
              name: newName,
              price: newPrice,
              type: newType,
              gain: newGain,
              role_id: newRole,
            };
          }
          return itm;
        });

        if (changed) {
          await execute(`UPDATE economy SET items = ? WHERE user_id = ?`, [
            JSON.stringify(userItems),
            user.user_id,
          ]);
        }
      }

      const updatedEmbed = new EmbedBuilder()
        .setTitle("✅ Item Updated")
        .setDescription(
          `> **${shopItem.item}** → **${newName}**\n` +
            `> **💰 Price:** ${newPrice}\n> **📂 Type:** ${newType}\n` +
            `> **⭐ Gain:** ${newGain}\n> **🎭 Role:** ${
              newRole ? `<@&${newRole}>` : "None"
            }\n` +
            `> All user inventories have been updated.`
        )
        .setColor("#00b7ff")
        .setFooter({ text: "🍃 HighBot" })
        .setTimestamp();
      return interaction.reply({ ephemeral: true, embeds: [updatedEmbed] });
    }
  },
};
