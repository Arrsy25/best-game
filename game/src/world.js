// The arena and its rules: waves, spawning, movement, bolts, the light
// economy, combos, damage and the win/lose conditions. It knows nothing
// about the keyboard, the canvas or sound — step() takes a plain input
// object and returns an event bitmask the caller turns into feedback.

import {
  BOSS_BURST_EVERY, BOSS_MINION_EVERY, BOSS_HP, COLORS, COMBO_KILLS_PER_STEP,
  COMBO_WINDOW, HIT_LIGHT, MAX_MULTIPLIER, PLAYER, STEP, TOTAL_WAVES,
  VIEW_H, VIEW_W, WAVE_COUNT, WAVE_HP_MUL, WAVE_INTERVAL, WAVE_SPEED_MUL,
} from './config.js';
import { SHADE_TYPES, burst, createEmber, createFloatText, createPlayer, createShade } from './entities.js';
import { applyUpgrade as applyUpgradeToState, rollChoices } from './upgrades.js';

export const EVENT_SHOT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_HIT = 4;
export const EVENT_KILL = 8;
export const EVENT_DASH = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_WAVE_START = 64;
export const EVENT_OVER = 128;
export const EVENT_WIN = 256;
export const EVENT_BOSS = 512;

const TAU = Math.PI * 2;

function defaultMods() {
  return {
    maxLight: PLAYER.maxLight,
    lightRadius: 0,
    fireRateMul: 1,
    boltSpeedMul: 1,
    boltDamage: PLAYER.boltDamage,
    projectiles: PLAYER.projectiles,
    pickupRadius: PLAYER.pickupRadius,
    drainMul: 1,
    dashCdMul: 1,
    comboWindow: COMBO_WINDOW,
    scoreMul: 1,
  };
}

export function createWorld(rng) {
  const state = {
    rng,
    time: 0,
    wave: 1,
    waveState: 'fight',
    spawnQueue: [],
    spawnClock: 0,
    player: createPlayer(VIEW_W / 2, VIEW_H / 2),
    mods: defaultMods(),
    taken: {},
    enemies: [],
    bolts: [],
    ebolts: [],
    embers: [],
    particles: [],
    texts: [],
    score: 0,
    combo: 0,
    comboTimer: 0,
    mult: 1,
    kills: 0,
    shake: 0,
    flash: 0,
    choices: null,
    decor: { stars: [], runes: [] },
  };

  function lightRadius() {
    return PLAYER.lightRadiusBase + state.player.light * PLAYER.lightRadiusPer + state.mods.lightRadius;
  }

  function spawnPoint() {
    for (let tries = 0; tries < 8; tries += 1) {
      const edge = rng.int(0, 3);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = rng.range(30, VIEW_W - 30); y = 30; }
      else if (edge === 1) { x = rng.range(30, VIEW_W - 30); y = VIEW_H - 30; }
      else if (edge === 2) { x = 30; y = rng.range(30, VIEW_H - 30); }
      else { x = VIEW_W - 30; y = rng.range(30, VIEW_H - 30); }
      const dx = x - state.player.x;
      const dy = y - state.player.y;
      if (dx * dx + dy * dy > 260 * 260) return { x, y };
    }
    return { x: 40, y: 40 };
  }

  function pickType(n) {
    const roll = rng.next();
    if (n >= 6 && roll < 0.14) return 'spitter';
    if (n >= 4 && roll < 0.34) return 'brute';
    if (n >= 2 && roll < 0.62) return 'skitterer';
    return 'drifter';
  }

  function startWave(n) {
    state.wave = n;
    state.waveState = 'fight';
    state.spawnQueue = [];
    state.spawnClock = 0;
    state.choices = null;
    let events = EVENT_WAVE_START;
    if (n >= TOTAL_WAVES) {
      const boss = createShade('boss', VIEW_W / 2, 80, 1, 1, rng);
      boss.hp = BOSS_HP;
      boss.maxHp = BOSS_HP;
      state.enemies.push(boss);
      for (let i = 0; i < 8; i += 1) {
        state.spawnQueue.push({ type: 'drifter', at: 3 + i * 2.2 });
      }
      events |= EVENT_BOSS;
      return events;
    }
    const count = WAVE_COUNT(n);
    const interval = WAVE_INTERVAL(n);
    for (let i = 0; i < count; i += 1) {
      state.spawnQueue.push({ type: pickType(n), at: 0.6 + i * interval + rng.range(0, 0.4) });
    }
    return events;
  }

  function reset() {
    state.time = 0;
    state.wave = 1;
    state.waveState = 'fight';
    state.player = createPlayer(VIEW_W / 2, VIEW_H / 2);
    state.mods = defaultMods();
    state.taken = {};
    state.enemies = [];
    state.bolts = [];
    state.ebolts = [];
    state.embers = [];
    state.particles = [];
    state.texts = [];
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.mult = 1;
    state.kills = 0;
    state.shake = 0;
    state.flash = 0;
    state.choices = null;
    state.decor.stars = [];
    state.decor.runes = [];
    for (let i = 0; i < 90; i += 1) {
      state.decor.stars.push({ x: rng.range(0, VIEW_W), y: rng.range(0, VIEW_H), r: rng.range(0.6, 1.8), tw: rng.range(0, TAU) });
    }
    for (let i = 0; i < 6; i += 1) {
      state.decor.runes.push({ x: rng.range(90, VIEW_W - 90), y: rng.range(90, VIEW_H - 90), r: rng.range(26, 60) });
    }
    startWave(1);
  }

  function damagePlayer(amount) {
    const p = state.player;
    p.light = Math.max(0, p.light - amount);
    p.invuln = PLAYER.invulnTime;
    state.combo = 0;
    state.comboTimer = 0;
    state.mult = 1;
    state.shake = Math.max(state.shake, 11);
    state.flash = 0.4;
    burst(state.particles, p.x, p.y, COLORS.hurt, 12, 200, 0.5, 3);
  }

  function killShade(index) {
    const shade = state.enemies[index];
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = state.mods.comboWindow;
    state.mult = Math.min(MAX_MULTIPLIER, 1 + Math.floor(state.combo / COMBO_KILLS_PER_STEP));
    const gained = Math.round(shade.score * state.mult * state.mods.scoreMul);
    state.score += gained;
    state.texts.push(createFloatText(shade.x, shade.y - shade.radius, `+${gained}`, state.mult > 1 ? COLORS.gold : COLORS.text, shade.type === 'boss'));
    for (let i = 0; i < shade.embers; i += 1) state.embers.push(createEmber(shade.x, shade.y, rng));
    burst(state.particles, shade.x, shade.y, shade.color, shade.type === 'boss' ? 60 : 16, 240, 0.7, 3.5);
    burst(state.particles, shade.x, shade.y, COLORS.ember, shade.type === 'boss' ? 30 : 6, 180, 0.5, 2.5);
    state.shake = Math.max(state.shake, shade.type === 'boss' ? 14 : 2.5);
    if (shade.type === 'boss') {
      state.texts.push(createFloatText(VIEW_W / 2, VIEW_H / 2 - 90, 'THE NIGHT LORD FALLS', COLORS.gold, true));
    }
    return EVENT_KILL;
  }

  function updateAmbient(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.life -= dt;
      t.y -= 26 * dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    for (let i = state.embers.length - 1; i >= 0; i -= 1) {
      const e = state.embers[i];
      e.life -= dt;
      e.bob += dt * 3;
      if (e.life <= 0) state.embers.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 30);
    state.flash = Math.max(0, state.flash - dt * 1.6);
  }

  function step(dt, input) {
    updateAmbient(dt);
    if (state.waveState !== 'fight') return 0;
    let events = 0;
    const p = state.player;
    const mods = state.mods;
    state.time += dt;

    // --- Light always drains: standing still is a slow death.
    p.light -= PLAYER.drain * mods.drainMul * dt;
    if (p.light <= 0) {
      p.light = 0;
      state.waveState = 'dead';
      burst(state.particles, p.x, p.y, COLORS.ember, 50, 260, 1.1, 4);
      state.shake = 16;
      return EVENT_OVER;
    }

    // --- Movement and dash.
    const mx = input ? input.mx : 0;
    const my = input ? input.my : 0;
    p.moving = mx !== 0 || my !== 0;
    if (p.moving) p.walkPhase += dt * 10;
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (input && input.dash && p.dashCd <= 0 && p.dashTimer <= 0) {
      let dx = mx;
      let dy = my;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(p.angle);
        dy = Math.sin(p.angle);
      }
      const len = Math.hypot(dx, dy) || 1;
      p.dashDirX = dx / len;
      p.dashDirY = dy / len;
      p.dashTimer = PLAYER.dashTime;
      p.dashCd = PLAYER.dashCooldown * mods.dashCdMul;
      p.invuln = Math.max(p.invuln, 0.32);
      events |= EVENT_DASH;
      burst(state.particles, p.x, p.y, COLORS.cyan, 8, 140, 0.35, 2.5);
    }
    let speed = PLAYER.speed;
    let vx = mx * speed;
    let vy = my * speed;
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      vx = p.dashDirX * PLAYER.dashSpeed;
      vy = p.dashDirY * PLAYER.dashSpeed;
    }
    p.x = Math.max(24, Math.min(VIEW_W - 24, p.x + vx * dt));
    p.y = Math.max(24, Math.min(VIEW_H - 24, p.y + vy * dt));
    if (input) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);

    // --- Shooting: each shot costs a little light.
    p.fireTimer -= dt;
    if (input && input.fire && p.fireTimer <= 0 && p.light > PLAYER.shotCost + 1) {
      p.light -= PLAYER.shotCost;
      p.fireTimer = 1 / (PLAYER.fireRate * mods.fireRateMul);
      const n = mods.projectiles;
      for (let i = 0; i < n; i += 1) {
        const spread = (i - (n - 1) / 2) * 0.14;
        const a = p.angle + spread;
        state.bolts.push({
          x: p.x + Math.cos(a) * 22,
          y: p.y + Math.sin(a) * 22,
          vx: Math.cos(a) * PLAYER.boltSpeed * mods.boltSpeedMul,
          vy: Math.sin(a) * PLAYER.boltSpeed * mods.boltSpeedMul,
          life: 1.1,
          dmg: mods.boltDamage,
        });
      }
      events |= EVENT_SHOT;
    }

    // --- Spawning.
    state.spawnClock += dt;
    while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.spawnClock) {
      const next = state.spawnQueue.shift();
      const pos = spawnPoint();
      const shade = createShade(next.type, pos.x, pos.y, WAVE_HP_MUL(state.wave), WAVE_SPEED_MUL(state.wave), rng);
      state.enemies.push(shade);
    }

    // --- Shades: drift, skitter, hold ground and spit, or rule the night.
    for (let i = 0; i < state.enemies.length; i += 1) {
      const s = state.enemies[i];
      s.wobble += dt * 3;
      s.flash = Math.max(0, s.flash - dt * 6);
      s.touchCd = Math.max(0, s.touchCd - dt);
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      let mvx = nx;
      let mvy = ny;
      if (s.type === 'skitterer') {
        const wob = Math.sin(s.wobble * 2.2) * 0.9;
        mvx = nx - ny * wob;
        mvy = ny + nx * wob;
      } else if (s.type === 'spitter') {
        if (dist > 300) { mvx = nx; mvy = ny; }
        else if (dist < 200) { mvx = -nx; mvy = -ny; }
        else { mvx = -ny * 0.4; mvy = nx * 0.4; }
        s.fireTimer -= dt;
        if (s.fireTimer <= 0 && dist < 460) {
          s.fireTimer = 2.4;
          state.ebolts.push({ x: s.x, y: s.y, vx: nx * 150, vy: ny * 150, life: 4 });
        }
      } else if (s.type === 'boss') {
        s.minionTimer -= dt;
        if (s.minionTimer <= 0) {
          s.minionTimer = BOSS_MINION_EVERY;
          for (let k = 0; k < 2; k += 1) {
            const pos = { x: s.x + rng.range(-70, 70), y: s.y + rng.range(-70, 70) };
            state.enemies.push(createShade('drifter', pos.x, pos.y, 1, 1, rng));
          }
        }
        s.burstTimer -= dt;
        if (s.burstTimer <= 0) {
          s.burstTimer = BOSS_BURST_EVERY;
          for (let k = 0; k < 10; k += 1) {
            const a = (k / 10) * TAU + s.wobble;
            state.ebolts.push({ x: s.x, y: s.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, life: 5 });
          }
        }
      }
      const mlen = Math.hypot(mvx, mvy) || 1;
      s.x += (mvx / mlen) * s.speed * dt;
      s.y += (mvy / mlen) * s.speed * dt;
      s.x = Math.max(20, Math.min(VIEW_W - 20, s.x));
      s.y = Math.max(20, Math.min(VIEW_H - 20, s.y));

      // Touching the keeper steals light.
      if (p.invuln <= 0 && s.touchCd <= 0 && dist < s.radius + PLAYER.radius - 2) {
        s.touchCd = 0.6;
        damagePlayer(HIT_LIGHT[s.type]);
        events |= EVENT_HIT;
        const push = 70;
        s.x -= nx * push * 0.4;
        s.y -= ny * push * 0.4;
        if (p.light <= 0) {
          state.waveState = 'dead';
          return events | EVENT_OVER;
        }
      }
    }

    // --- Player bolts.
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const b = state.bolts[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > VIEW_W || b.y < 0 || b.y > VIEW_H;
      if (!dead) {
        for (let j = 0; j < state.enemies.length; j += 1) {
          const s = state.enemies[j];
          const dx = b.x - s.x;
          const dy = b.y - s.y;
          if (dx * dx + dy * dy < (s.radius + 5) * (s.radius + 5)) {
            s.hp -= b.dmg;
            s.flash = 0.14;
            burst(state.particles, b.x, b.y, COLORS.emberHot, 4, 140, 0.3, 2);
            dead = true;
            if (s.hp <= 0) events |= killShade(j);
            break;
          }
        }
      }
      if (dead) state.bolts.splice(i, 1);
    }

    // --- Shade bolts.
    for (let i = state.ebolts.length - 1; i >= 0; i -= 1) {
      const b = state.ebolts[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > VIEW_W + 20 || b.y < -20 || b.y > VIEW_H + 20;
      if (!dead && p.invuln <= 0) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (dx * dx + dy * dy < (PLAYER.radius + 6) * (PLAYER.radius + 6)) {
          damagePlayer(HIT_LIGHT.ebolt);
          events |= EVENT_HIT;
          dead = true;
          if (p.light <= 0) {
            state.waveState = 'dead';
            return events | EVENT_OVER;
          }
        }
      }
      if (dead) state.ebolts.splice(i, 1);
    }

    // --- Embers: drift, get magnetised, get collected.
    for (let i = state.embers.length - 1; i >= 0; i -= 1) {
      const e = state.embers[i];
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < mods.pickupRadius) {
        const pull = 520 * (1 - dist / (mods.pickupRadius + 60));
        e.vx += (dx / dist) * pull * dt * 4;
        e.vy += (dy / dist) * pull * dt * 4;
      }
      e.vx *= 0.94;
      e.vy *= 0.94;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (dist < 24) {
        state.embers.splice(i, 1);
        p.light = Math.min(p.maxLight, p.light + PLAYER.emberLight);
        state.score += Math.round(PLAYER.emberScore * state.mult);
        burst(state.particles, e.x, e.y, COLORS.cyan, 5, 120, 0.35, 2);
        events |= EVENT_PICKUP;
      }
    }

    // --- Combo window.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.mult = 1;
      }
    }

    // --- Wave clear: queue empty and arena empty.
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.wave >= TOTAL_WAVES) {
        state.waveState = 'won';
        return events | EVENT_WIN;
      }
      state.waveState = 'between';
      state.choices = rollChoices(rng, state.taken, 3);
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  return {
    state,
    reset,
    step,
    startWave,
    lightRadius,
    enemiesRemaining() {
      return state.enemies.length + state.spawnQueue.length;
    },
    applyUpgrade(id) {
      applyUpgradeToState(state, id);
    },
    chooseAndAdvance(id) {
      applyUpgradeToState(state, id);
      return startWave(state.wave + 1);
    },
  };
}
