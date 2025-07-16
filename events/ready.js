const { Initialization, execute } = require("../database/database");
const { Events } = require("discord.js");
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    Initialization();
    console.log("[✅] Bot is ready to be used on discord.");
  },
};
