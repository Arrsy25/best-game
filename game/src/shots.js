// The screenshot scenes behind ?shot=start|play|upgrade|end. Each one plays
// the real rules forward from a fresh seeded world, steered by a simple
// autopilot (keep distance from the nearest shade, chase the nearest ember,
// shoot the nearest shade, dash out when cornered), so every frame is what a
// real game looks like and the same seed always gives the same frame.
// Between waves the pilot takes the strongest blessing on offer, so the end
// scene can genuinely reach wave 10 and win.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const UPGRADE_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;
const SAMPLE = STEP;

// Blessing preference for the autopilot: damage first, then more bolts.
const PICK_ORDER = ['focus', 'twin', 'swift', 'magnet', 'lantern', 'wick', 'combo', 'quickstep'];

function nearest(list, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const item of list) {
    const dx = item.x - x;
    const dy = item.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best === null ? null : { item: best, dist: Math.sqrt(bestD) };
}

/** The pilot's input for one step: kite, collect, shoot, dash out of trouble. */
function autopilot(state) {
  const p = state.player;
  const shade = nearest(state.enemies, p.x, p.y);
  const ember = nearest(state.embers, p.x, p.y);
  let mx = 0;
  let my = 0;
  let dash = false;
  if (shade) {
    const dx = p.x - shade.item.x;
    const dy = p.y - shade.item.y;
    const d = shade.dist || 1;
    if (d < 110) {
      // Too close: run away, and dash if it is ready.
      mx = dx / d;
      my = dy / d;
      if (d < 70 && p.dashCd <= 0) dash = true;
    } else if (d > 260) {
      // Too far to hit reliably: close in a little.
      mx = -dx / d;
      my = -dy / d;
    } else if (ember && ember.dist < 200) {
      // In the pocket: drift toward the nearest ember.
      mx = (ember.item.x - p.x) / ember.dist;
      my = (ember.item.y - p.y) / ember.dist;
    } else {
      // Hold the pocket and strafe.
      mx = (-dy / d) * 0.5;
      my = (dx / d) * 0.5;
    }
  } else if (ember) {
    mx = (ember.item.x - p.x) / ember.dist;
    my = (ember.item.y - p.y) / ember.dist;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const aim = shade ? { x: shade.item.x, y: shade.item.y } : { x: p.x, y: p.y - 100 };
  return { mx, my, aimX: aim.x, aimY: aim.y, fire: shade !== null && shade.dist < 520, dash };
}

function pickBestUpgrade(world) {
  const choices = world.state.choices || [];
  for (const id of PICK_ORDER) {
    if (choices.some((c) => c.id === id)) return id;
  }
  return choices.length > 0 ? choices[0].id : null;
}

/** Step the world with the pilot until `done(state)` or the second cap. */
function runUntil(world, done, limitSeconds) {
  const steps = Math.floor(limitSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    // Check the goal first: a 'between' state must be seen before the
    // pilot spends it on the next wave's blessing.
    if (done(state)) return true;
    if (state.waveState === 'between') {
      const pick = pickBestUpgrade(world);
      if (pick) world.chooseAndAdvance(pick);
      continue;
    }
    if (state.waveState === 'won' || state.waveState === 'dead') return done(state);
    world.step(STEP, autopilot(state));
  }
  return done(world.state);
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Stop mid-wave, with shades on screen, not at a wave boundary.
    runUntil(world, (s) => s.time >= PLAY_SECONDS && s.enemies.length >= 4, PLAY_SECONDS + 60);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    runUntil(world, (s) => s.waveState === 'between', UPGRADE_LIMIT_SECONDS);
    return { screen: SCREEN_UPGRADE, best: world.state.score };
  }
  if (name === 'end') {
    runUntil(world, (s) => s.waveState === 'won' || s.waveState === 'dead', END_LIMIT_SECONDS);
    const won = world.state.waveState === 'won';
    return { screen: won ? SCREEN_VICTORY : SCREEN_OVER, best: world.state.score };
  }
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilot(world.state));
    if (world.state.waveState !== 'fight') break;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
