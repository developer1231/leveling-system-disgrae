const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("database.db");

function makeid(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function getCurrentDateTime() {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${day}-${month}-${year}, ${hours}:${minutes}`;
}

function getCurrentTimestamp() {
  const timestamp = new Date().getTime();
  return timestamp;
}
function execute(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, function (err, rows) {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

async function Initialization() {
  try {
    await run(`CREATE TABLE IF NOT EXISTS shop (
      id TEXT PRIMARY KEY,
      price INTEGER,
      item TEXT, 
      type TEXT,
      gain INTEGER,
      role_id TEXT
      );`);
    await run(`CREATE TABLE IF NOT EXISTS increments (
      role_id TEXT PRIMARY KEY, 
      increment INTEGER
      );`);
    await run(`create table if not exists users (
      member_id TEXT PRIMARY KEY, 
      xp INTEGER, 
      current_level INTEGER,
      voice INTEGER,
      messages INTEGER
      );`);
    await run(`create table if not exists blacklist (
        channel_id TEXT PRIMARY KEY
        );`);
    await run(`create table if not exists roles (
        level INTEGER PRIMARY KEY,
        role_id TEXT
        );`);

    await run(
      `create table if not exists economy (user_id TEXT PRIMARY KEY, coins INTEGER, items TEXT, daily BIGINT, weekly BIGINT, work BIGINT, gift_cap INTEGER)`
    );
    await run(`CREATE TABLE IF NOT EXISTS drop_settings (
      id TEXT PRIMARY KEY,
  guild_id TEXT
  enabled INTEGER DEFAULT 1,
  title TEXT,
  message TEXT,
  color TEXT,
  image_url TEXT,
  drop_channel TEXT,
  ping_roles TEXT,
  xp_amount INTEGER DEFAULT 0,
  budz_amount INTEGER DEFAULT 0,
  store_items TEXT,
  msg_requirement INTEGER DEFAULT 0,
  blacklisted_channels TEXT);`);
    await run(`CREATE TABLE IF NOT EXISTS active_drops (
     id TEXT PRIMARY KEY,
      guild_id TEXT,
  message_id TEXT,
  channel_id TEXT,
  xp_amount INTEGER,
  budz_amount INTEGER,
  store_items TEXT,
  claimed_by TEXT,
  expires_at INTEGER
);
`);
    console.log("created table users");
  } catch (err) {
    console.error("Initialization error:", err);
  }
}

module.exports = {
  makeid,
  execute,
  run,
  Initialization,
  getCurrentDateTime,
  getCurrentTimestamp,
};
