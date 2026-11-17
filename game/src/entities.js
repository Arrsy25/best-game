// The things that live in the arena: the Emberkeeper, the shades, the
// embers they drop, the particles and floating score text. Factories only —
// the rules that move them live in world.js.

import { COLORS } from './config.js';

// Shade types: radius, base health, base speed, score, how many embers it
// drops, and the colour it is drawn in.
export const SHADE_TYPES = {
  drifter: { radius: 16, hp: 2, speed: 52, score: 20, embers: 2, color: COLORS.shade, dark: COLORS.shadeDark },
  skitterer: { radius: 12, hp: 1, speed: 128, score: 30, embers: 2, color: '#7a5fd0', dark: '#4a3585' },
  brute: { radius: 26, hp: 8, speed: 34, score: 60, embers: 4, color: COLORS.brute, dark: '#5b3a94' },
  spitter: { radius: 18, hp: 3, speed: 58, score: 50, embers: 3, color: COLORS.spitter, dark: '#2e6b5e' },
  boss: { radius: 46, hp: 110, speed: 46, score: 1000, embers: 16, color: COLORS.boss, dark: '#5e1f52' },
};

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    light: 100,
    maxLight: 100,
    fireTimer: 0,
    dashTimer: 0,
    dashCd: 0,
    invuln: 0,
    walkPhase: 0,
    moving: false,
  };
}

export function createShade(type, x, y, hpMul, speedMul, rng) {
  const def = SHADE_TYPES[type];
  return {
    kind: 'shade',
    type,
    x, y,
    vx: 0, vy: 0,
    radius: def.radius,
    hp: Math.max(1, Math.round(def.hp * hpMul)),
    maxHp: Math.max(1, Math.round(def.hp * hpMul)),
    speed: def.speed * speedMul * rng.range(0.9, 1.1),
    score: def.score,
    embers: def.embers,
    color: def.color,
    dark: def.dark,
    wobble: rng.range(0, Math.PI * 2),
    fireTimer: rng.range(1.5, 2.5),
    minionTimer: 8,
    burstTimer: 4,
    flash: 0,
    touchCd: 0,
  };
}

export function createEmber(x, y, rng) {
  const angle = rng.range(0, Math.PI * 2);
  const speed = rng.range(40, 130);
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 14,
    bob: rng.range(0, Math.PI * 2),
    value: 1,
  };
}

export function createParticle(x, y, color, speed, life, size) {
  const angle = Math.random() * Math.PI * 2;
  const v = speed * (0.4 + Math.random() * 0.8);
  return {
    x, y,
    vx: Math.cos(angle) * v,
    vy: Math.sin(angle) * v,
    color,
    life: life * (0.6 + Math.random() * 0.7),
    maxLife: life,
    size: size * (0.7 + Math.random() * 0.6),
  };
}

/** A burst of `n` particles of one colour. */
export function burst(list, x, y, color, n, speed, life, size) {
  for (let i = 0; i < n; i += 1) list.push(createParticle(x, y, color, speed, life, size));
}

export function createFloatText(x, y, text, color, big = false) {
  return { x, y, text, color, life: 1.1, maxLife: 1.1, big };
}
