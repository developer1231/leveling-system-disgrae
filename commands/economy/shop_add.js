require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { execute, makeid } = require("../../database/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop-add")
    .setDescription("Add an item to the Budz™ shop (Admin only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("The name of the item to add")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of item")
        .addChoices(
          { name: "Role", value: "roles" },
          { name: "XP Booster", value: "xp" },
          { name: "Cosmetic", value: "cosmetic" }
        )
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("price").setDescription("Price in Budz™").setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("gain")
        .setDescription("XP or other numeric gain (leave 0 if not applicable)")
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The Discord role to give (only if type = Role)")
        .setRequired(false)
    ),

  async execute(interaction) {
    // 🔒 Ensure admin
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        ephemeral: true,
        content: "> 🚫 Only **admins** can add shop items.",
      });
    }

    const itemName = interaction.options.getString("item");
    const type = interaction.options.getString("type");
    const price = interaction.options.getInteger("price");
    const gain = interaction.options.getInteger("gain") ?? 0;
    const role = interaction.options.getRole("role");

    // Ensure role is provided if type = "roles"
    if (type === "roles" && !role) {
      return interaction.reply({
        ephemeral: true,
        content: "> 🚫 You must select a role when adding a Role item.",
      });
    }

    const id = makeid(7);

    // Insert into shop table using new role_id column
    await execute(
      `INSERT INTO shop (id, price, item, type, gain, role_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, price, itemName, type, gain, type === "roles" ? role.id : null]
    );

    const embed = new EmbedBuilder()
      .setTitle("✅ Shop Item Added")
      .setColor("#00b7ff")
      .setDescription(
        `> **Item:** ${itemName}\n> **Type:** ${type}\n> **Price:** ${price} Budz™\n> **Gain:** ${
          type === "roles"
            ? `<@&${role.id}> (role)`
            : gain > 0
            ? `${gain} XP`
            : "N/A"
        }\n\n> *The item is now available in the shop.*`
      )
      .setFooter({ text: "🍃 HighBot" })
      .setTimestamp();

    await interaction.reply({ ephemeral: true, embeds: [embed] });
  },
};
