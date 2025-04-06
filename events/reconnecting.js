const { Events } = require("discord.js");
module.exports = {
  name: Events.ShardReconnecting,
  once: false,
  execute(client) {
    var ToD = new Date();
    function amPm() {
      if (ToD.getHours() >= 11) {
        return "PM";
      } else return "AM";
    }
    console.log("Client reconnect occured");
  },
};
