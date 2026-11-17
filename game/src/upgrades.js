// The between-wave blessings: one of three random upgrades, a real choice
// that changes how the next waves play. Each entry names what it does, how
// far it can stack, and applies itself to the world's mods.

export const UPGRADES = [
  {
    id: 'lantern',
    name: 'Brighter Lantern',
    icon: '☀',
    desc: '+30 max light and a wider glow. See further, live longer.',
    max: 5,
    apply(mods) {
      mods.maxLight += 30;
      mods.lightRadius += 22;
    },
  },
  {
    id: 'swift',
    name: 'Swift Embers',
    icon: '≫',
    desc: '+25% bolt speed and +20% fire rate. More sparks, faster.',
    max: 5,
    apply(mods) {
      mods.fireRateMul *= 1.2;
      mods.boltSpeedMul *= 1.25;
    },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    icon: '◎',
    desc: '+80 pickup radius. Embers fly to you from far away.',
    max: 4,
    apply(mods) {
      mods.pickupRadius += 80;
    },
  },
  {
    id: 'twin',
    name: 'Twin Flame',
    icon: '✦✦',
    desc: '+1 ember bolt per shot. Costs no extra light.',
    max: 3,
    apply(mods) {
      mods.projectiles += 1;
    },
  },
  {
    id: 'wick',
    name: 'Sturdy Wick',
    icon: '🕯',
    desc: '+30 max light and the flame drains 20% slower.',
    max: 4,
    apply(mods) {
      mods.maxLight += 30;
      mods.drainMul *= 0.8;
    },
  },
  {
    id: 'quickstep',
    name: 'Quickstep',
    icon: '»',
    desc: 'Dash recharges 35% faster. Slip away more often.',
    max: 4,
    apply(mods) {
      mods.dashCdMul *= 0.65;
    },
  },
  {
    id: 'focus',
    name: 'Sharp Focus',
    icon: '◆',
    desc: '+1 damage per bolt. Shades fall that much sooner.',
    max: 5,
    apply(mods) {
      mods.boltDamage += 1;
    },
  },
  {
    id: 'combo',
    name: 'Combo Charm',
    icon: '✧',
    desc: '+1.5 s combo window and +25% score from every kill.',
    max: 4,
    apply(mods) {
      mods.comboWindow += 1.5;
      mods.scoreMul *= 1.25;
    },
  },
];

export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id);
}

/** Roll `count` distinct upgrades the player has not maxed out yet. */
export function rollChoices(rng, taken, count = 3) {
  const pool = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
  const choices = [];
  while (choices.length < count && pool.length > 0) {
    const index = Math.floor(rng.next() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  // If everything is maxed (a long run), offer the weakest three again.
  while (choices.length < count) choices.push(UPGRADES[choices.length % UPGRADES.length]);
  return choices;
}

/** Apply an upgrade to the world's mods and refill the player's light. */
export function applyUpgrade(state, id) {
  const upgrade = upgradeById(id);
  if (!upgrade) return;
  upgrade.apply(state.mods);
  state.taken[id] = (state.taken[id] || 0) + 1;
  state.player.maxLight = state.mods.maxLight;
  state.player.light = Math.min(state.player.maxLight, state.player.light + 25);
}
