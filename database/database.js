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
