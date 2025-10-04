function getXpFromLevel(level) {
  const base = 35;
  const exp = 2.618;

  return Math.floor(base * Math.pow(level, exp));
}

function getLevelFromXP(xp) {
  let level = 0;

  while (getXpFromLevel(level + 1) <= xp) {
    level++;
  }

  return level;
}

module.exports = { getLevelFromXP, getXpFromLevel };
