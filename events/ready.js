const { Initialization, execute } = require("../database/database");
const { Events } = require("discord.js");
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    Initialization();
    // await execute(`update users set xp = 99 WHERE member_id = ?`, [
    //   "345138133429649408",
    // ]);
    console.log("[✅] Bot is ready to be used on discord.");
  },
};
