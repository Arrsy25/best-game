// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens:
// title, play, upgrade, paused, game over and victory.
//
// ?seed=N fixes the waves. ?shot=start|play|upgrade|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BOSS, EVENT_DASH, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP,
  EVENT_SHOT, EVENT_WAVE_CLEAR, EVENT_WAVE_START, EVENT_WIN, createWorld,
} from './world.js';
import {
  ACTION_1, ACTION_2, ACTION_3, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE,
  ACTION_RESTART, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE,
  SCREEN_VICTORY, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
// The upgrade cards' geometry, shared with render.js so a click picks a card.
const CARD_W = 300;
const CARD_H = 230;
const CARD_GAP = 28;
const CARD_Y = 215;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { x: 640, y: 360 }, world.lightRadius());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function playEvents(events) {
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_HIT) audio.hurt();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_WAVE_START) audio.horn();
    if (events & EVENT_BOSS) audio.bossRoar();
    if (events & EVENT_OVER) audio.death();
    if (events & EVENT_WIN) audio.victory();
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.horn();
    announce('Playing. Keep the light alive through 10 waves.');
  }

  function finishRun(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = won ? SCREEN_VICTORY : SCREEN_OVER;
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over on wave ${world.state.wave}. Score ${world.state.score}. Best ${best}.`);
  }

  function chooseUpgrade(index) {
    const choices = world.state.choices || [];
    if (index < 0 || index >= choices.length) return;
    audio.unlock();
    audio.click();
    const events = world.chooseAndAdvance(choices[index].id);
    playEvents(events);
    screen = SCREEN_PLAY;
    announce(`Wave ${world.state.wave}. ${choices[index].name} chosen.`);
  }

  function clickedCard() {
    const mouse = input.mouse();
    const choices = world.state.choices || [];
    const total = choices.length * CARD_W + (choices.length - 1) * CARD_GAP;
    const startX = (1280 - total) / 2;
    for (let i = 0; i < choices.length; i += 1) {
      const x = startX + i * (CARD_W + CARD_GAP);
      if (mouse.x >= x && mouse.x <= x + CARD_W && mouse.y >= CARD_Y && mouse.y <= CARD_Y + CARD_H) return i;
    }
    return -1;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_1) chooseUpgrade(0);
      else if (actions & ACTION_2) chooseUpgrade(1);
      else if (actions & ACTION_3) chooseUpgrade(2);
      else if (actions & ACTION_CONFIRM) {
        const card = clickedCard();
        if (card >= 0) chooseUpgrade(card);
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & (ACTION_RESTART | ACTION_CONFIRM)) startGame();
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const move = input.move();
    const aim = input.aim();
    const events = world.step(STEP, {
      mx: move.x,
      my: move.y,
      aimX: aim.x,
      aimY: aim.y,
      fire: input.firing(),
      dash: input.dashPressed(),
    });
    playEvents(events);
    if (events & EVENT_WIN) finishRun(true);
    else if (events & EVENT_OVER) finishRun(false);
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} cleared. Choose a blessing.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, input.mouse(), world.lightRadius());
  }

  // Leaving the tab pauses a running game rather than letting the light drain unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberkeeper. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
