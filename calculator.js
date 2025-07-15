function f(level) {
  if (level === 0) return 0;

  let t = level - 1;
  return 100 + 0.04 * t ** 3 + 0.8 * t ** 2 + 2 * t + 0.5;
}

function getXpFromLevel(level) {
  return f(level);
}

function getLevelFromXP(xp, tolerance = 1e-4) {
  if (xp < f(1)) return 0; // Shortcut for below level 1

  let low = 1;
  let high = 999;

  while (high - low > tolerance) {
    let mid = (low + high) / 2;
    let xpAtMid = f(mid);

    if (xpAtMid < xp) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.floor((low + high) / 2);
}

module.exports = { getLevelFromXP, getXpFromLevel };
