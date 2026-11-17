// Keyboard + mouse, in logical 1280x720 coordinates. The world never sees
// this module: main.js reads it once a frame and hands the world a plain
// input object { mx, my, aimX, aimY, fire, dash }, which is also what the
// screenshot autopilot builds, so live play and staged shots drive the
// same rules.
import { VIEW_H, VIEW_W } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_1 = 16;
export const ACTION_2 = 32;
export const ACTION_3 = 64;

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = VIEW_W / 2;
  let mouseY = VIEW_H / 2 - 120;
  let mouseDown = false;
  let clicked = false;
  let actions = 0;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'Digit1' || event.code === 'Numpad1') actions |= ACTION_1;
    if (event.code === 'Digit2' || event.code === 'Numpad2') actions |= ACTION_2;
    if (event.code === 'Digit3' || event.code === 'Numpad3') actions |= ACTION_3;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const p = toLogical(event);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    const p = toLogical(event);
    mouseX = p.x;
    mouseY = p.y;
    mouseDown = true;
    clicked = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement vector from WASD / arrows. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = MOVE_KEYS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      if (x !== 0 && y !== 0) {
        const len = Math.hypot(x, y);
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    aim() {
      return { x: mouseX, y: mouseY };
    },
    firing() {
      return mouseDown;
    },
    dashPressed() {
      return keys.has('Space');
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** One-shot actions since the last call; a click also confirms. */
    takeActions() {
      const out = actions | (clicked ? ACTION_CONFIRM : 0);
      actions = 0;
      clicked = false;
      return out;
    },
  };
}
