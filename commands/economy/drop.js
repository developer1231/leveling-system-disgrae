const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { execute, makeid } = require("../../database/database");
const { sendDrop } = require("../../helpers/drops");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("drop")
    .setDescription("📦 Manage crate drops")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // ADD
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View a drop's settings")
        .addStringOption((opt) =>
          opt
            .setName("drop_id")
            .setDescription("ID of the drop to view")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new drop")
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Embed title").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Embed description")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("color").setDescription("Embed color (hex)")
        )
        .addStringOption((opt) =>
          opt.setName("image_url").setDescription("Embed image URL")
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Drop channel")
        )
        .addRoleOption((opt) =>
          opt.setName("ping_role").setDescription("Role to ping")
        )
        .addIntegerOption((opt) =>
          opt.setName("xp").setDescription("XP reward")
        )
        .addIntegerOption((opt) =>
          opt.setName("budz").setDescription("Budz reward")
        )
        .addStringOption((opt) =>
          opt
            .setName("items")
            .setDescription("Store item to drop")
            .setAutocomplete(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("requirement")
            .setDescription("Messages required before drop")
        )
        .addStringOption((opt) =>
          opt
            .setName("blacklist")
            .setDescription("Channel IDs to blacklist, comma separated")
        )
    )
    // EDIT
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing drop")
        .addStringOption((opt) =>
          opt
            .setName("drop_id")
            .setDescription("Which drop?")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Embed title")
        )
        .addStringOption((opt) =>
          opt.setName("message").setDescription("Embed description")
        )
        .addStringOption((opt) =>
          opt.setName("color").setDescription("Embed color (hex)")
        )
        .addStringOption((opt) =>
          opt.setName("image_url").setDescription("Embed image URL")
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Drop channel")
        )
        .addRoleOption((opt) =>
          opt.setName("ping_role").setDescription("Role to ping")
        )
        .addIntegerOption((opt) =>
          opt.setName("xp").setDescription("XP reward")
        )
        .addIntegerOption((opt) =>
          opt.setName("budz").setDescription("Budz reward")
        )
        .addStringOption((opt) =>
          opt
            .setName("items")
            .setDescription("Store item to drop")
            .setAutocomplete(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("requirement")
            .setDescription("Messages required before drop")
        )
        .addStringOption((opt) =>
          opt
            .setName("blacklist")
            .setDescription("Channel IDs to blacklist, comma separated")
        )
    )
    // DELETE
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a drop")
        .addStringOption((opt) =>
          opt
            .setName("drop_id")
            .setDescription("Which drop?")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    // SEND
    .addSubcommand((sub) =>
      sub
        .setName("send")
        .setDescription("Send a drop manually or make a one-time drop")
        .addStringOption((opt) =>
          opt
            .setName("drop_id")
            .setDescription("Existing drop ID")
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Embed title (one-time drop)")
        )
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription("Embed description (one-time drop)")
        )
        .addStringOption((opt) =>
          opt.setName("color").setDescription("Embed color (hex)")
        )
        .addStringOption((opt) =>
          opt.setName("image_url").setDescription("Embed image URL")
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Drop channel")
        )
        .addRoleOption((opt) =>
          opt.setName("ping_role").setDescription("Role to ping")
        )
        .addIntegerOption((opt) =>
          opt.setName("xp").setDescription("XP reward")
        )
        .addIntegerOption((opt) =>
          opt.setName("budz").setDescription("Budz reward")
        )
        .addStringOption((opt) =>
          opt
            .setName("items")
            .setDescription("Store item to drop")
            .setAutocomplete(true)
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: `> :x: Only **Admins** can use this command!`,
      });
    }
    if (sub === "view") {
      const dropId = interaction.options.getString("drop_id");

      const drops = await execute(
        `SELECT * FROM drop_settings WHERE id = ? AND guild_id = ?`,
        [dropId, interaction.guild.id]
      );

      if (!drops.length) {
        return interaction.reply({
          content: ">  ⚠️ Drop not found.",
          ephemeral: true,
        });
      }

      const drop = drops[0];

      let storeItemName = "None";
      if (drop.store_items) {
        const items = await execute(`SELECT * FROM shop WHERE id = ?`, [
          drop.store_items,
        ]);
        if (items.length) storeItemName = items[0].item;
      }

      const embed = new EmbedBuilder()
        .setTitle(drop.title || "📦 Crate Drop Settings")
        .setColor(drop.color || "#00b7ff")
        .setDescription(drop.message || "No message set.")
        .addFields(
          { name: "💰 Budz", value: drop.budz_amount.toString(), inline: true },
          { name: "⚡ XP", value: drop.xp_amount.toString(), inline: true },
          { name: "🎁 Store Item", value: storeItemName, inline: true },
          {
            name: "📬 Channel ID",
            value: drop.drop_channel || "None",
            inline: true,
          },
          {
            name: "Ping Roles",
            value: drop.ping_roles ? `<@&${drop.ping_roles}>` : "None",
            inline: true,
          },
          {
            name: "Message Requirement",
            value: drop.msg_requirement.toString(),
            inline: true,
          }
        )
        .setImage(drop.image_url || null)
        .setFooter({ text: `Drop ID: ${drop.id}` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ADD DROP
    if (sub === "add") {
      const args = {
        title: interaction.options.getString("title"),
        message: interaction.options.getString("message"),
        color: interaction.options.getString("color"),
        image_url: interaction.options.getString("image_url"),
        channel: interaction.options.getChannel("channel"),
        ping_role: interaction.options.getRole("ping_role"),
        xp: interaction.options.getInteger("xp"),
        budz: interaction.options.getInteger("budz"),
        items: interaction.options.getString("items"),
        msg_requirement: interaction.options.getInteger("requirement"),
        blacklist: interaction.options.getString("blacklist"),
      };

      // --- Ensure at least one reward exists ---
      if (!args.xp && !args.budz && !args.items) {
        return interaction.reply({
          content:
            "> ❌ You must provide at least one reward (XP, Budz, or Items) for this drop.",
          ephemeral: true,
        });
      }

      // --- Validate items exist in shop ---
      let itemId = null;
      if (args.items) {
        const data = await execute(`SELECT * FROM shop WHERE item = ?`, [
          args.items,
        ]);
        if (data.length === 0) {
          return interaction.reply({
            content: `> ❌ The item **${args.items}** does not exist in the shop.`,
            ephemeral: true,
          });
        }
        itemId = data[0].id;
      }

      // --- Insert drop ---
      await execute(
        `INSERT INTO drop_settings
    (id, guild_id, title, message, color, image_url, drop_channel, ping_roles, xp_amount, budz_amount, store_items, msg_requirement, blacklisted_channels)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          makeid(10),
          guildId,
          args.title,
          args.message,
          args.color,
          args.image_url,
          args.channel?.id || null,
          args.ping_role?.id || null,
          args.xp || 0,
          args.budz || 0,
          itemId,
          args.msg_requirement || 0,
          args.blacklist || null,
        ]
      );

      return interaction.reply({
        content: `> ✅ Drop **${args.title}** added!`,
        ephemeral: true,
      });
    }

    // EDIT DROP
    if (sub === "edit") {
      const dropId = interaction.options.getString("drop_id");
      const args = {
        title: interaction.options.getString("title"),
        message: interaction.options.getString("message"),
        color: interaction.options.getString("color"),
        image_url: interaction.options.getString("image_url"),
        channel: interaction.options.getChannel("channel"),
        ping_role: interaction.options.getRole("ping_role"),
        xp: interaction.options.getInteger("xp"),
        budz: interaction.options.getInteger("budz"),
        items: interaction.options.getString("items"),
        msg_requirement: interaction.options.getInteger("requirement"),
        blacklist: interaction.options.getString("blacklist"),
      };

      const updates = [];
      const values = [];

      for (const [key, val] of Object.entries(args)) {
        if (val !== null) {
          if (key === "channel") {
            updates.push("drop_channel = ?");
            values.push(val.id);
          } else if (key === "ping_role") {
            updates.push("ping_roles = ?");
            values.push(val.id);
          } else if (key === "items") {
            if (val) {
              const data = await execute(`SELECT * FROM shop WHERE item = ?`, [
                val,
              ]);
              if (data.length === 0) {
                return interaction.reply({
                  content: `> ❌ The item **${val}** does not exist in the shop.`,
                  ephemeral: true,
                });
              }
              updates.push("store_items = ?");
              values.push(data[0].id);
            } else {
              updates.push("store_items = ?");
              values.push(null);
            }
          } else if (key === "xp") {
            updates.push("xp_amount = ?");
            values.push(val || 0);
          } else if (key === "budz") {
            updates.push("budz_amount = ?");
            values.push(val || 0);
          } else if (key === "msg_requirement") {
            updates.push("msg_requirement = ?");
            values.push(val || 0);
          } else {
            updates.push(`${key} = ?`);
            values.push(val);
          }
        }
      }

      if (updates.length === 0) {
        return interaction.reply({
          content: "> ⚠️ Nothing to update.",
          ephemeral: true,
        });
      }

      // --- Optional: check if at least one reward exists after edit ---
      const existingDrop = await execute(
        `SELECT xp_amount, budz_amount, store_items FROM drop_settings WHERE id = ? AND guild_id = ?`,
        [dropId, guildId]
      );

      if (existingDrop.length > 0) {
        const newXP = args.xp ?? existingDrop[0].xp_amount;
        const newBudz = args.budz ?? existingDrop[0].budz_amount;
        const newItem = args.items
          ? values[updates.indexOf("store_items = ?")]
          : existingDrop[0].store_items;

        if (!newXP && !newBudz && !newItem) {
          return interaction.reply({
            content:
              "> ❌ A drop must have at least one reward (XP, Budz, or Item).",
            ephemeral: true,
          });
        }
      }

      values.push(dropId, guildId);

      await execute(
        `UPDATE drop_settings SET ${updates.join(
          ", "
        )} WHERE id = ? AND guild_id = ?`,
        values
      );

      return interaction.reply({
        content: `> ✅ Drop **#${dropId}** updated!`,
        ephemeral: true,
      });
    }

    // DELETE DROP
    if (sub === "delete") {
      const dropId = interaction.options.getString("drop_id");
      await execute(`DELETE FROM drop_settings WHERE id = ? AND guild_id = ?`, [
        dropId,
        guildId,
      ]);
      return interaction.reply({
        content: `> 🗑️ Drop **#${dropId}** deleted!`,
        ephemeral: true,
      });
    }

    // SEND DROP
    if (sub === "send") {
      const dropId = interaction.options.getString("drop_id");
      console.log(dropId);
      let dropData = null;

      if (dropId) {
        const rows = await execute(
          `SELECT * FROM drop_settings WHERE id = ? AND guild_id = ?`,
          [dropId, guildId]
        );
        if (!rows.length) {
          return interaction.reply({
            content: "> ⚠️ Drop not found.",
            ephemeral: true,
          });
        }
        dropData = rows[0];
      } else {
        // One-time ad-hoc drop
        let itemId = null;
        const items = interaction.options.getString("items");
        console.log(items);
        if (items) {
          const data = await execute(`SELECT * FROM shop WHERE item = ?`, [
            items,
          ]);
          console.log(items, data);
          if (data.length > 0) itemId = data[0].id;
        }
        console.log(itemId);
        dropData = {
          id: makeid(10),
          title: interaction.options.getString("title"),
          message: interaction.options.getString("message"),
          color: interaction.options.getString("color") || "#2b2d31",
          image_url: interaction.options.getString("image_url"),
          drop_channel:
            interaction.options.getChannel("channel")?.id ||
            interaction.channel.id,
          ping_roles: interaction.options.getRole("ping_role")?.id,
          xp_amount: interaction.options.getInteger("xp") || 0,
          budz_amount: interaction.options.getInteger("budz") || 0,
          store_items: itemId,
          msg_requirement: 0,
          blacklisted_channels: null,
        };

        if (!dropData.title || !dropData.message) {
          return interaction.reply({
            ephemeral: true,
            content:
              "> ⚠️ One-time drops need at least a **title** and **message**.",
          });
        }
      }

      await sendDrop(interaction, guildId, true, dropData);
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === "items") {
      const rows = await execute(`SELECT item FROM shop`);
      const results = rows
        .map((r) => r.item)
        .filter((i) => i.toLowerCase().includes(focused.value.toLowerCase()));

      return interaction.respond(
        results.slice(0, 25).map((i) => ({ name: i, value: i }))
      );
    }

    if (focused.name === "drop_id") {
      const rows = await execute(
        `SELECT id, title FROM drop_settings WHERE guild_id = ?`,
        [interaction.guild.id]
      );
      console.log(rows);
      const results = rows.map((r) => ({
        name: `#${r.id} - ${r.title}`,
        value: r.id,
      }));
      return interaction.respond(results.slice(0, 25));
    }
  },
};
