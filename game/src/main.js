// Boot and the one loop. The world advances in fixed steps however fast frames arrive; this
// module owns the screens (title, play, pause, help, busted, wasted), the camera, entering and
// leaving cars, the bust and hospital respawns, and the saved game in localStorage.
//
// ?seed=N fixes the city. ?shot=title|drive|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { SAVE_KEY, STEP, WORLD, streetX, streetY } from './config.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE } from './input.js';
import { createRenderer, menuItemRect, SCREEN_BUSTED, SCREEN_HELP, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createGameState } from './state.js';
import { districtAt } from './city.js';
import { carNearPlayer, enterCar, exitCar, stepPed, stepPlayer } from './people.js';
import { collideCars, recycleTraffic, stepPlayerCar, stepTraffic } from './vehicles.js';
import { stepPolice } from './police.js';
import { failMission, stepMissions } from './missions.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const DAY_LENGTH = 300; // seconds for the light to drift from morning to dusk and back

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message));
});

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(state) {
  try {
    const p = state.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      seed: state.seed,
      money: p.money,
      missionIndex: state.mission.index,
      storyDone: state.storyDone,
      weapon: p.weapon,
      ammo: p.ammo,
      x: p.car ? p.car.x : p.x,
      y: p.car ? p.car.y : p.y,
    }));
  } catch {
    // Storage can be off (private windows): the game then lasts this visit only.
  }
}

function applySave(state, save) {
  const p = state.player;
  p.money = save.money ?? p.money;
  p.weapon = save.weapon ?? 'fist';
  p.ammo = save.ammo ?? 0;
  p.x = save.x ?? p.x;
  p.y = save.y ?? p.y;
  state.mission.index = save.missionIndex ?? 0;
  state.storyDone = Boolean(save.storyDone);
}

function runShot(name) {
  const seed = Number.isInteger(seedParam) ? seedParam : 7;
  const state = createGameState(seed);
  stageShot(state, name, { w: canvas.width, h: canvas.height });
  const focus = state.player.car ?? state.player;
  state.district = districtAt(state.city, focus.x, focus.y);
  let painted = 0;
  function paint() {
    renderer.draw(state);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 1e9);
  let state = createGameState(seed);
  state.onSave = () => writeSave(state);
  let overlayT = 0;

  function refreshMenu() {
    state.hasSave = Boolean(readSave());
    state.menuItems = state.hasSave ? ['New Game', 'Continue', 'How to Play'] : ['New Game', 'How to Play'];
    if (state.menuIndex >= state.menuItems.length) state.menuIndex = 0;
  }
  refreshMenu();

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    seed = Math.floor(Math.random() * 1e9);
    state = createGameState(seed);
    state.onSave = () => writeSave(state);
    state.screen = SCREEN_PLAY;
    announce('A new game in Coral Bay. Meet Dario at his garage.');
  }

  function continueGame() {
    const save = readSave();
    state = createGameState(save && Number.isInteger(save.seed) ? save.seed : 7);
    state.onSave = () => writeSave(state);
    if (save) applySave(state, save);
    state.screen = SCREEN_PLAY;
    announce('Welcome back to Coral Bay.');
  }

  function activateMenu() {
    const item = state.menuItems[state.menuIndex];
    state.audio.wake();
    state.audio.click();
    if (item === 'New Game') startNewGame();
    else if (item === 'Continue') continueGame();
    else if (item === 'How to Play') {
      state.screen = SCREEN_HELP;
      announce('How to play.');
    }
  }

  function respawn(atHospital) {
    const L = state.city.landmarks;
    const spot = atHospital ? L.hospital : L.police;
    const p = state.player;
    if (p.car) {
      p.car.driver = null;
      p.car.parked = true;
      p.car.speed = 0;
      p.car = null;
    }
    p.x = spot.x;
    p.y = spot.y;
    p.hp = atHospital ? 75 : Math.max(p.hp, 55);
    state.wanted.heat = 0;
    state.wanted.bust = 0;
    state.wanted.stars = 0;
    state.screen = SCREEN_PLAY;
    writeSave(state);
  }

  function enterBusted() {
    const p = state.player;
    const fine = Math.floor(p.money * 0.15);
    p.money -= fine;
    failMission(state, 'Busted — the job is off. The marker will offer it again.');
    state.audio.sting();
    state.screen = SCREEN_BUSTED;
    overlayT = 2.4;
    state.events.busted = false;
    announce(`Busted. The fine is $${fine}.`);
  }

  function enterWasted() {
    const p = state.player;
    const bill = Math.floor(p.money * 0.10);
    p.money -= bill;
    failMission(state, 'Wasted — the job is off. The marker will offer it again.');
    state.audio.sting();
    state.screen = SCREEN_WASTED;
    overlayT = 2.4;
    announce(`Wasted. The hospital bill is $${bill}.`);
  }

  function updatePrompt() {
    const p = state.player;
    if (p.car) {
      state.prompt = Math.abs(p.car.speed) < 200 ? 'E — get out' : '';
      return;
    }
    const car = carNearPlayer(state, 58);
    state.prompt = car ? `E — get in the ${car.type === 'taxi' ? 'taxi' : car.type}` : '';
  }

  function updateCamera(dt) {
    const p = state.player;
    const focusX = p.car ? p.car.x : p.x;
    const focusY = p.car ? p.car.y : p.y;
    const lookX = p.car ? Math.cos(p.car.angle) * p.car.speed * 0.38 : 0;
    const lookY = p.car ? Math.sin(p.car.angle) * p.car.speed * 0.38 : 0;
    const tx = focusX + lookX - canvas.width / 2;
    const ty = focusY + lookY - canvas.height / 2;
    const k = Math.min(1, dt * 5);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
    state.camera.x = Math.max(0, Math.min(WORLD.width - canvas.width, state.camera.x));
    state.camera.y = Math.max(0, Math.min(WORLD.height - canvas.height, state.camera.y));
  }

  function stepPlay(dt) {
    const actions = input.takeActions();
    const p = state.player;
    if (actions & ACTION_PAUSE) {
      state.screen = SCREEN_PAUSE;
      writeSave(state);
      announce('Paused.');
      return;
    }
    if (actions & ACTION_ENTER) {
      if (p.car) exitCar(state);
      else {
        const car = carNearPlayer(state, 58);
        if (car) enterCar(state, car);
      }
    }
    if (p.car) {
      stepPlayerCar(state, p.car, input.driveKeys(), dt);
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
    } else {
      stepPlayer(state, input, dt);
    }
    for (const car of state.cars) {
      if (car.driver === 'traffic') stepTraffic(state, car, dt);
    }
    collideCars(state, dt);
    for (const ped of state.peds) stepPed(state, ped, dt);
    stepPolice(state, dt);
    stepMissions(state, dt);
    // Wrecks and dying engines smoke.
    for (const car of state.cars) {
      if (car.health < 45 && state.rng() < 0.25) state.fx.smoke(car.x, car.y, 1);
    }
    state.fx.update(dt);
    state.dayT = (state.dayT + dt / DAY_LENGTH) % 1;
    state.time += dt;
    if (state.events.busted) enterBusted();
    else if (p.hp <= 0) enterWasted();
    state.saveT += dt;
    if (state.saveT > 12) {
      state.saveT = 0;
      writeSave(state);
    }
    updatePrompt();
    state.district = districtAt(state.city, p.x, p.y);
  }

  function stepAttract(dt) {
    // Behind the title, the city lives: traffic flows and people stroll.
    for (const car of state.cars) {
      if (car.driver === 'traffic') stepTraffic(state, car, dt);
    }
    for (const ped of state.peds) stepPed(state, ped, dt);
    state.fx.update(dt);
    state.time += dt;
    state.attractAngle += dt * 0.045;
    const cx = streetX(6) + 330 + Math.cos(state.attractAngle) * 420;
    const cy = streetY(2) + Math.sin(state.attractAngle) * 300;
    state.camera.x = Math.max(0, Math.min(WORLD.width - canvas.width, cx - canvas.width / 2));
    state.camera.y = Math.max(0, Math.min(WORLD.height - canvas.height, cy - canvas.height / 2));
  }

  function handleMenuInput() {
    const { x, y } = input.mouse;
    for (let i = 0; i < state.menuItems.length; i += 1) {
      const r = menuItemRect(i, canvas.width, canvas.height);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        state.menuIndex = i;
        if (input.mouse.down) {
          activateMenu();
          return true; // the click is spent; the caller must not also fire Confirm
        }
        return false;
      }
    }
    return false;
  }

  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += frameDt;

    if (state.screen === SCREEN_TITLE) {
      const consumed = handleMenuInput();
      const actions = input.takeActions();
      if (!consumed && (actions & ACTION_CONFIRM)) activateMenu();
      while (accumulator >= STEP) {
        stepAttract(STEP);
        accumulator -= STEP;
      }
    } else if (state.screen === SCREEN_HELP) {
      if (input.takeActions() & (ACTION_CONFIRM | ACTION_PAUSE)) {
        state.screen = SCREEN_TITLE;
        refreshMenu();
      }
      accumulator = 0;
    } else if (state.screen === SCREEN_PAUSE) {
      if (input.takeActions() & (ACTION_PAUSE | ACTION_CONFIRM)) {
        state.screen = SCREEN_PLAY;
        announce('Playing.');
      }
      accumulator = 0;
    } else if (state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED) {
      overlayT -= frameDt;
      input.takeActions();
      if (overlayT <= 0) respawn(state.screen === SCREEN_WASTED);
      accumulator = 0;
    } else {
      while (accumulator >= STEP && state.screen === SCREEN_PLAY) {
        stepPlay(STEP);
        accumulator -= STEP;
      }
      if (state.screen !== SCREEN_PLAY) accumulator = 0;
    }

    if (state.screen !== SCREEN_TITLE) updateCamera(frameDt);
    // The continuous sounds follow the world each frame.
    const p = state.player;
    state.audio.update(
      frameDt,
      p.car ? Math.abs(p.car.speed) / 445 : 0,
      state.screen === SCREEN_PLAY || state.screen === SCREEN_PAUSE ? state.nearestPolice : Infinity,
    );
    renderer.draw(state);
  }

  window.addEventListener('keydown', (event) => {
    state.audio.wake();
    if (event.code === 'KeyM') {
      const muted = state.audio.toggleMute();
      state.toast = muted ? 'Sound off' : 'Sound on';
      state.toastT = 1.6;
    }
    if (state.screen === SCREEN_TITLE) {
      if (event.code === 'ArrowDown' || event.code === 'KeyS') state.menuIndex = (state.menuIndex + 1) % state.menuItems.length;
      if (event.code === 'ArrowUp' || event.code === 'KeyW') state.menuIndex = (state.menuIndex - 1 + state.menuItems.length) % state.menuItems.length;
    }
  });
  window.addEventListener('pointerdown', () => state.audio.wake());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSE;
      writeSave(state);
      announce('Paused.');
    }
  });

  announce('Coral Bay. Choose New Game to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
