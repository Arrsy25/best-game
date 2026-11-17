// Emberkeeper — every tuning constant lives here, so the whole game can be
// rebalanced from this one file. All distances are in logical pixels on a
// 1280x720 arena; all times are in seconds.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const STEP = 1 / 60;
export const BEST_KEY = 'emberkeeper-best';

// The palette: deep indigo night, ember orange and gold, pale cyan embers,
// violet shades. The scene has to read at a glance when shrunk.
export const COLORS = {
  nightTop: '#0b0e1e',
  nightBottom: '#151b36',
  arenaLine: '#232c52',
  ember: '#ffb347',
  emberHot: '#ff7a18',
  emberPale: '#ffd9a0',
  cyan: '#9be8ff',
  cyanDim: '#5fb8d9',
  shade: '#6b4fae',
  shadeDark: '#3d2b6e',
  shadeEye: '#e8d5ff',
  brute: '#8a5fd0',
  spitter: '#4fae9b',
  boss: '#a03d8f',
  hurt: '#ff4d5e',
  text: '#f2ead8',
  textDim: '#9aa3c7',
  gold: '#ffd166',
};

export const PLAYER = {
  radius: 14,
  speed: 235,
  maxLight: 100,
  // Light drains slowly even when the player does nothing: standing still
  // is a slow death, so the player must keep killing and collecting.
  drain: 0.85,
  shotCost: 1.1,
  fireRate: 3.6,
  boltSpeed: 540,
  boltDamage: 1,
  projectiles: 1,
  pickupRadius: 52,
  dashSpeed: 720,
  dashTime: 0.18,
  dashCooldown: 2.2,
  invulnTime: 0.9,
  lightRadiusBase: 95,
  lightRadiusPer: 1.55,
  emberLight: 5,
  emberScore: 5,
};

export const COMBO_WINDOW = 2.5;
export const COMBO_KILLS_PER_STEP = 3;
export const MAX_MULTIPLIER = 8;

// Contact damage (light stolen) per shade type.
export const HIT_LIGHT = { drifter: 13, skitterer: 10, brute: 20, spitter: 12, boss: 26, ebolt: 10 };

// How many shades a wave brings, and how fast they arrive.
export const WAVE_COUNT = (n) => 6 + n * 3;
export const WAVE_INTERVAL = (n) => Math.max(0.35, 1.15 - n * 0.07);
export const WAVE_HP_MUL = (n) => 1 + (n - 1) * 0.15;
export const WAVE_SPEED_MUL = (n) => 1 + (n - 1) * 0.05;
export const TOTAL_WAVES = 10;
export const BOSS_HP = 110;
export const BOSS_MINION_EVERY = 12;
export const BOSS_BURST_EVERY = 5;
