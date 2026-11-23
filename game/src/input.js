// Keyboard and mouse, read as state the game polls each step: held movement keys, the mouse
// position in screen space, and one-shot actions (enter a car, pause, confirm) that fire once
// per press however long the key is held.

export const ACTION_ENTER = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_RESTART = 8;

/** Create the input reader bound to a canvas. */
export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  const ACTION_KEYS = {
    KeyE: ACTION_ENTER,
    Enter: ACTION_CONFIRM,
    Space: ACTION_CONFIRM,
    Escape: ACTION_PAUSE,
    KeyP: ACTION_PAUSE,
    KeyR: ACTION_RESTART,
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    const action = ACTION_KEYS[event.code];
    if (action) {
      actions |= action;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** The held movement as a unit-ish vector: x from A/D and arrows, y from W/S and arrows. */
    moveVector() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** Driving keys for the car the player sits in. */
    driveKeys() {
      return {
        throttle: held.has('KeyW') || held.has('ArrowUp') ? 1 : held.has('KeyS') || held.has('ArrowDown') ? -1 : 0,
        steer: (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0),
        brake: held.has('Space'),
      };
    },
    sprinting() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** Take the one-shot actions pressed since the last call, clearing them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
