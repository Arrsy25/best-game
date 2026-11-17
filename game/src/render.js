// Every pixel of Emberkeeper: the night arena, the lantern's glow and the
// darkness beyond it, the keeper, the shades, the embers, the HUD, and the
// title / upgrade / pause / game-over / victory screens. The darkness is a
// second canvas painted over the world with a hole punched where the light
// is, so shades outside the lantern's glow are dimmed and half-hidden.

import { COLORS, PLAYER, TOTAL_WAVES, VIEW_H, VIEW_W } from './config.js';
import { SHADE_TYPES } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2);
    ctx.fill();
  }
}

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = VIEW_W;
  dark.height = VIEW_H;
  const dctx = dark.getContext('2d');

  function drawBackground(state) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, COLORS.nightTop);
    g.addColorStop(1, COLORS.nightBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Stars, twinkling slowly.
    for (const s of state.decor.stars) {
      const a = 0.25 + 0.2 * Math.sin(state.time * 0.8 + s.tw);
      ctx.globalAlpha = Math.max(0.05, a);
      ctx.fillStyle = '#cdd6ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    // Faint rune circles on the floor.
    ctx.strokeStyle = COLORS.arenaLine;
    ctx.lineWidth = 2;
    for (const r of state.decor.runes) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * 0.55, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Arena border.
    ctx.strokeStyle = '#2c3a6e';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, VIEW_W - 12, VIEW_H - 12);
  }

  function drawEmber(ctx2, e) {
    const bob = Math.sin(e.bob) * 2;
    const r = 5 + Math.sin(e.bob * 1.7) * 1;
    ctx2.save();
    ctx2.shadowColor = COLORS.cyan;
    ctx2.shadowBlur = 10;
    ctx2.fillStyle = COLORS.cyan;
    ctx2.beginPath();
    ctx2.arc(e.x, e.y + bob, r, 0, TAU);
    ctx2.fill();
    ctx2.shadowBlur = 0;
    ctx2.fillStyle = '#eafcff';
    ctx2.beginPath();
    ctx2.arc(e.x - 1, e.y + bob - 1, r * 0.45, 0, TAU);
    ctx2.fill();
    ctx2.restore();
  }

  function drawShade(ctx2, s) {
    const def = SHADE_TYPES[s.type];
    const wob = Math.sin(s.wobble) * 2;
    ctx2.save();
    ctx2.translate(s.x, s.y + wob * 0.4);
    // Wobbly violet body.
    ctx2.fillStyle = s.flash > 0 ? '#f5e9ff' : s.dark;
    ctx2.beginPath();
    for (let i = 0; i <= 10; i += 1) {
      const a = (i / 10) * TAU;
      const rr = s.radius * (1 + 0.12 * Math.sin(a * 3 + s.wobble));
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr * 0.92;
      if (i === 0) ctx2.moveTo(px, py);
      else ctx2.lineTo(px, py);
    }
    ctx2.closePath();
    ctx2.fill();
    ctx2.strokeStyle = s.color;
    ctx2.lineWidth = 2;
    ctx2.stroke();
    // Spikes for brutes and the boss.
    if (s.type === 'brute' || s.type === 'boss') {
      ctx2.fillStyle = s.color;
      const spikes = s.type === 'boss' ? 8 : 5;
      for (let i = 0; i < spikes; i += 1) {
        const a = (i / spikes) * TAU + s.wobble * 0.3;
        ctx2.beginPath();
        ctx2.moveTo(Math.cos(a) * s.radius * 0.8, Math.sin(a) * s.radius * 0.8);
        ctx2.lineTo(Math.cos(a + 0.22) * s.radius * 0.8, Math.sin(a + 0.22) * s.radius * 0.8);
        ctx2.lineTo(Math.cos(a + 0.11) * s.radius * 1.35, Math.sin(a + 0.11) * s.radius * 1.35);
        ctx2.closePath();
        ctx2.fill();
      }
    }
    // Glowing eyes, looking at the keeper.
    const look = Math.atan2(statePlayerY - s.y, statePlayerX - s.x);
    const ex = Math.cos(look) * 3;
    const ey = Math.sin(look) * 3;
    ctx2.fillStyle = s.type === 'boss' ? COLORS.emberHot : COLORS.shadeEye;
    ctx2.shadowColor = ctx2.fillStyle;
    ctx2.shadowBlur = 6;
    const eyeGap = s.radius * 0.38;
    const eyeR = s.type === 'boss' ? 5 : 3.2;
    ctx2.beginPath();
    ctx2.arc(-eyeGap + ex, -s.radius * 0.18 + ey, eyeR, 0, TAU);
    ctx2.arc(eyeGap + ex, -s.radius * 0.18 + ey, eyeR, 0, TAU);
    ctx2.fill();
    ctx2.shadowBlur = 0;
    // Spitter mouth.
    if (s.type === 'spitter') {
      ctx2.fillStyle = '#0b0e1e';
      ctx2.beginPath();
      ctx2.arc(ex, s.radius * 0.32 + ey, 5, 0, TAU);
      ctx2.fill();
    }
    // Boss health bar.
    if (s.type === 'boss' && s.hp < s.maxHp) {
      ctx2.fillStyle = 'rgba(0,0,0,0.55)';
      ctx2.fillRect(-34, -s.radius - 16, 68, 7);
      ctx2.fillStyle = COLORS.boss;
      ctx2.fillRect(-33, -s.radius - 15, 66 * (s.hp / s.maxHp), 5);
    }
    // Small health ticks on hurt tough shades.
    if (s.type !== 'boss' && s.maxHp > 2 && s.hp < s.maxHp) {
      ctx2.fillStyle = 'rgba(0,0,0,0.55)';
      ctx2.fillRect(-16, -s.radius - 10, 32, 4);
      ctx2.fillStyle = s.color;
      ctx2.fillRect(-15, -s.radius - 9, 30 * (s.hp / s.maxHp), 2);
    }
    ctx2.restore();
    void def;
  }

  // The player's position, kept for the shades' gaze. Set in draw().
  let statePlayerX = VIEW_W / 2;
  let statePlayerY = VIEW_H / 2;

  function drawPlayer(ctx2, p, lightFrac) {
    ctx2.save();
    ctx2.translate(p.x, p.y);
    const bob = p.moving ? Math.sin(p.walkPhase) * 1.5 : Math.sin(performance.now() / 500) * 1;
    ctx2.translate(0, bob * 0.5);
    // Blink while invulnerable after a hit.
    if (p.invuln > 0 && Math.floor(performance.now() / 90) % 2 === 0) ctx2.globalAlpha = 0.45;
    // Cloak: a hooded triangle with a soft hem.
    ctx2.fillStyle = '#232a4d';
    ctx2.strokeStyle = '#3a4470';
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.moveTo(0, -PLAYER.radius - 4);
    ctx2.quadraticCurveTo(PLAYER.radius + 2, -2, PLAYER.radius - 1, PLAYER.radius + 2);
    ctx2.quadraticCurveTo(0, PLAYER.radius + 6, -PLAYER.radius + 1, PLAYER.radius + 2);
    ctx2.quadraticCurveTo(-PLAYER.radius - 2, -2, 0, -PLAYER.radius - 4);
    ctx2.closePath();
    ctx2.fill();
    ctx2.stroke();
    // Hood shadow and pale face.
    ctx2.fillStyle = '#0d1024';
    ctx2.beginPath();
    ctx2.arc(0, -4, 7.5, 0, TAU);
    ctx2.fill();
    ctx2.fillStyle = '#ffe9c4';
    ctx2.beginPath();
    ctx2.arc(0, -4, 4.2, 0, TAU);
    ctx2.fill();
    ctx2.fillStyle = '#1a2038';
    ctx2.beginPath();
    ctx2.arc(-1.6, -4.5, 1.1, 0, TAU);
    ctx2.arc(1.6, -4.5, 1.1, 0, TAU);
    ctx2.fill();
    // The lantern, held toward the aim: the source of all light.
    const lx = Math.cos(p.angle) * 20;
    const ly = Math.sin(p.angle) * 20;
    ctx2.save();
    ctx2.shadowColor = COLORS.ember;
    ctx2.shadowBlur = 18 + lightFrac * 14;
    ctx2.fillStyle = COLORS.ember;
    ctx2.beginPath();
    ctx2.arc(lx, ly, 5.5, 0, TAU);
    ctx2.fill();
    ctx2.shadowBlur = 0;
    ctx2.fillStyle = '#fff3d6';
    ctx2.beginPath();
    ctx2.arc(lx, ly, 2.6, 0, TAU);
    ctx2.fill();
    ctx2.strokeStyle = '#7a5a28';
    ctx2.lineWidth = 1.5;
    ctx2.beginPath();
    ctx2.arc(lx, ly, 7.5, 0, TAU);
    ctx2.stroke();
    ctx2.restore();
    ctx2.restore();
  }

  function drawDarkness(state, radius) {
    dctx.clearRect(0, 0, VIEW_W, VIEW_H);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = 'rgba(4, 6, 16, 0.86)';
    dctx.fillRect(0, 0, VIEW_W, VIEW_H);
    dctx.globalCompositeOperation = 'destination-out';
    // The lantern's glow: a soft hole in the dark.
    const p = state.player;
    let g = dctx.createRadialGradient(p.x, p.y, radius * 0.12, p.x, p.y, radius);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(p.x, p.y, radius, 0, TAU);
    dctx.fill();
    // Shades out in the dark are dim, not invisible: a faint hole each, so
    // their violet bodies and glowing eyes read at a distance.
    for (const s of state.enemies) {
      const r = s.radius * 2.4;
      g = dctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(s.x, s.y, r, 0, TAU);
      dctx.fill();
    }
    // Embers and bolts glimmer faintly through the dark.
    for (const e of state.embers) {
      g = dctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 26);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(e.x, e.y, 26, 0, TAU);
      dctx.fill();
    }
    for (const b of state.bolts) {
      g = dctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 18);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(b.x, b.y, 18, 0, TAU);
      dctx.fill();
    }
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0);
  }

  function drawHud(state, best, lightRadius) {
    const p = state.player;
    const frac = p.light / p.maxLight;
    // Light meter, big and top-left: light is life, ammo and vision.
    ctx.fillStyle = 'rgba(5, 8, 20, 0.55)';
    roundRect(ctx, 18, 16, 320, 52, 10);
    ctx.fill();
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('LIGHT', 32, 36);
    const grad = ctx.createLinearGradient(32, 0, 318, 0);
    grad.addColorStop(0, COLORS.emberHot);
    grad.addColorStop(1, COLORS.ember);
    bar(ctx, 32, 42, 286, 12, frac, grad, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(p.light)}`, 32, 66 - 14 + 14);
    // Wave, score, combo, enemies.
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 22px Georgia, serif';
    ctx.fillText(`WAVE ${state.wave} / ${TOTAL_WAVES}`, VIEW_W / 2, 40);
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`SCORE ${state.score}`, VIEW_W / 2, 62);
    if (state.mult > 1) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.fillText(`×${state.mult} COMBO`, VIEW_W / 2, 88);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(`SHADES LEFT ${state.enemies.length + state.spawnQueue.length}`, VIEW_W - 24, 36);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillText(`BEST ${best}`, VIEW_W - 24, 58);
    // Dash cooldown, bottom-left.
    const dashFrac = p.dashCd <= 0 ? 1 : 1 - p.dashCd / (PLAYER.dashCooldown * state.mods.dashCdMul);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(p.dashCd <= 0 ? 'DASH READY  [SPACE]' : 'DASH…', 24, VIEW_H - 44);
    bar(ctx, 24, VIEW_H - 36, 120, 8, dashFrac, COLORS.cyan, 'rgba(255,255,255,0.12)');
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 12px system-ui, sans-serif';
    ctx.fillText('P pause · M mute', VIEW_W - 24, VIEW_H - 24);
    void lightRadius;
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || COLORS.ember;
    ctx.font = '800 54px Georgia, serif';
    ctx.fillText(title, VIEW_W / 2, 250);
    ctx.fillStyle = COLORS.text;
    ctx.font = '400 18px system-ui, sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 300 + i * 30));
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = COLORS.ember;
    ctx.shadowBlur = 26;
    ctx.fillStyle = COLORS.ember;
    ctx.font = '800 74px Georgia, serif';
    ctx.fillText('EMBERKEEPER', VIEW_W / 2, 210);
    ctx.restore();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'italic 400 24px Georgia, serif';
    ctx.fillText('defend the last lantern', VIEW_W / 2, 252);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 17px system-ui, sans-serif';
    const lines = [
      'Your light is your life, your ammo and your vision. It drains as you stand.',
      'Slay the shades, gather their embers, and keep the flame alive through 10 waves.',
      'WASD / arrows — move      Mouse — aim      Hold click — fling an ember bolt (costs light)',
      'SPACE — dash (briefly untouchable)      P — pause      M — mute',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 316 + i * 28));
    ctx.fillStyle = COLORS.gold;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(best > 0 ? `BEST SCORE ${best} — press ENTER or click to begin` : 'Press ENTER or click to begin', VIEW_W / 2, 470);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillText('Survive wave 10 and the Night Lord, and dawn breaks.', VIEW_W / 2, 510);
  }

  function drawUpgrade(state, ui) {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ember;
    ctx.font = '800 44px Georgia, serif';
    ctx.fillText(`WAVE ${state.wave} CLEARED`, VIEW_W / 2, 130);
    ctx.fillStyle = COLORS.text;
    ctx.font = '400 19px system-ui, sans-serif';
    ctx.fillText('The flame grows. Choose one blessing:', VIEW_W / 2, 170);
    const choices = state.choices || [];
    const cardW = 300;
    const cardH = 230;
    const gap = 28;
    const total = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (VIEW_W - total) / 2;
    const y = 215;
    choices.forEach((c, i) => {
      const x = startX + i * (cardW + gap);
      const hover = ui && ui.x >= x && ui.x <= x + cardW && ui.y >= y && ui.y <= y + cardH;
      ctx.fillStyle = hover ? 'rgba(255, 179, 71, 0.16)' : 'rgba(20, 26, 54, 0.9)';
      roundRect(ctx, x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = hover ? COLORS.ember : '#3a4470';
      ctx.lineWidth = hover ? 3 : 2;
      roundRect(ctx, x, y, cardW, cardH, 12);
      ctx.stroke();
      ctx.fillStyle = COLORS.ember;
      ctx.font = '400 40px Georgia, serif';
      ctx.fillText(c.icon, x + cardW / 2, y + 62);
      ctx.fillStyle = COLORS.text;
      ctx.font = '700 20px Georgia, serif';
      ctx.fillText(c.name, x + cardW / 2, y + 108);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = '400 15px system-ui, sans-serif';
      const words = c.desc.split(' ');
      const lines = [''];
      for (const w of words) {
        if ((lines[lines.length - 1] + ' ' + w).trim().length > 30) lines.push(w);
        else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim();
      }
      lines.forEach((line, li) => ctx.fillText(line, x + cardW / 2, y + 142 + li * 22));
      ctx.fillStyle = COLORS.gold;
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText(`press ${i + 1} or click`, x + cardW / 2, y + cardH - 18);
    });
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 14px system-ui, sans-serif';
    ctx.fillText(`Score ${state.score} · next: wave ${Math.min(TOTAL_WAVES, state.wave + 1)}`, VIEW_W / 2, 500);
  }

  function drawOver(state, best) {
    overlay('THE LIGHT HAS GONE OUT', [
      `The shades close in over wave ${state.wave}.`,
      `Score ${state.score}   ·   Best ${Math.max(best, state.score)}   ·   ${state.kills} shades banished`,
      '',
      'Press R or click to kindle the flame again',
    ], COLORS.hurt);
  }

  function drawVictory(state, best) {
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    const timeText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    overlay('DAWN BREAKS', [
      'The Night Lord is undone. The lantern burns on.',
      `Score ${state.score}   ·   Best ${Math.max(best, state.score)}   ·   Time ${timeText}`,
      `All ${TOTAL_WAVES} waves survived — ${state.kills} shades banished.`,
      '',
      'Press R or click to play again',
    ], COLORS.gold);
  }

  function drawPaused() {
    overlay('PAUSED', ['The flame waits for you.', '', 'P or click to resume'], COLORS.cyan);
  }

  return {
    draw(state, screen, best, ui, lightRadius) {
      statePlayerX = state.player.x;
      statePlayerY = state.player.y;
      ctx.save();
      if (state.shake > 0.3) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawBackground(state);
      for (const e of state.embers) drawEmber(ctx, e);
      for (const s of state.enemies) drawShade(ctx, s);
      // Shade bolts: violet orbs.
      for (const b of state.ebolts) {
        ctx.save();
        ctx.shadowColor = COLORS.boss;
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#d98cff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 6, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      // Player bolts: bright ember sparks.
      for (const b of state.bolts) {
        ctx.save();
        ctx.shadowColor = COLORS.emberHot;
        ctx.shadowBlur = 10;
        ctx.fillStyle = COLORS.ember;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.2, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      if (state.waveState !== 'dead') drawPlayer(ctx, state.player, state.player.light / state.player.maxLight);
      // Particles.
      for (const p of state.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawDarkness(state, lightRadius);
      // Floating score text, above the dark so it always reads.
      for (const t of state.texts) {
        ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
        ctx.fillStyle = t.color;
        ctx.font = t.big ? '800 30px Georgia, serif' : '700 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      // A red flash on a hit.
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 40, 60, ${state.flash * 0.22})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      ctx.restore();
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best, lightRadius);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_UPGRADE) drawUpgrade(state, ui);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_VICTORY) drawVictory(state, best);
    },
  };
}
