const { Initialization, execute } = require("../database/database");
const { Events } = require("discord.js");
const cache = require("../cache");
const cron = require("node-cron");
module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // await execute(`DROP TABLE IF EXISTS drop_settings;`);
    // await execute(`DROP TABLE IF EXISTS active_drops;`);
    Initialization();

    // await execute(
    //   `update users set current_level = 0 WHERE member_id = 345138133429649408`
    // );
    console.log("[✅] Bot is ready to be used on discord.");
    // cron job everyday to reset gifting cap.
    client.guilds.cache.forEach(async (guild) => {
      try {
        const invites = await guild.invites.fetch();
        invites.forEach((invite) => {
          cache.addItem(guild.id, invite.code, invite.uses);
        });
        console.log(`Cached invites for guild: ${guild.name}`);
      } catch (err) {
        console.warn(`Could not fetch invites for ${guild.name}: ${err}`);
      }
    });
    cron.schedule("0 0 * * *", async () => {
      console.log("reset gift caps.");
      await execute(`UPDATE economy SET gift_cap = 0`);

      // You can also log or send Discord messages here
    });
  },
};
