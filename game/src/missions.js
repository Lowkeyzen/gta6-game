// The story of Coral Bay, in three jobs for Dario Fontán — the garage owner who gives Marlo
// his start — plus the little delivery errands that keep paying after the story ends. A
// mission is a short chain of places to be (with, sometimes, a clock and a specific car);
// this module owns the chain, the dialogue lines that frame it, and the gold marker the HUD
// and the world draw. Failing a job — the clock, a bust, a hospital visit — sends the player
// back to the marker to try again.

import { makeCar } from './vehicles.js';

/** Say a line: dialogue lines queue and the renderer shows them one at a time. */
export function say(state, speaker, text, dur = 3.6) {
  state.dialogue.push({ speaker, text, t: dur });
}

const GARAGE_INTRO = [
  ['Dario', 'Marlo! You made it to Coral Bay. I run this garage — and half the favours in this town.'],
  ['Dario', 'Do jobs for me, keep your nose clean-ish, and the bay will take care of you.'],
];

/** The mission state at the start of a game (or restored from a save). */
export function createMissionState() {
  return {
    index: 0, // 0,1,2 are the story jobs; 3 means the story is done
    phase: 'offer', // offer (marker waiting) | active | errand
    step: 0,
    timer: 0,
    targetCar: null,
    errandTarget: null,
    failedNote: '',
  };
}

/** Where the player must go next, or null: {x, y, label}. */
export function currentTarget(state) {
  const m = state.mission;
  const L = state.city.landmarks;
  if (m.phase === 'offer') {
    if (m.index === 0) return { ...L.garage, label: 'Meet Dario at his garage' };
    if (m.index === 1) return { ...L.garage, label: 'Dario has another job for you' };
    if (m.index === 2) return { ...L.club, label: 'Meet Dario at Club Neptuno' };
    return { ...L.garage, label: 'Ask Dario for a delivery errand' };
  }
  if (m.phase === 'errand') return m.errandTarget;
  if (m.index === 0) {
    if (m.step === 0) return { x: state.city.landmarks.mall.x, y: state.city.landmarks.mall.y - 25, label: 'Steal the sports car at Palms Mall' };
    return { ...L.garage, label: "Deliver the car to Dario's garage" };
  }
  if (m.index === 1) {
    if (m.step === 0) return { ...L.warehouse, label: 'Pick up the package at Almacén 9' };
    return { ...L.hotel, label: 'Deliver the package to Hotel Coralia — fast' };
  }
  if (m.index === 2) {
    const points = [
      { ...L.club, label: 'Checkpoint 1: Club Neptuno' },
      { ...L.lighthouse, label: 'Checkpoint 2: the Faro lighthouse' },
      { ...L.hotel, label: 'Final checkpoint: Hotel Coralia' },
    ];
    return points[m.step];
  }
  return null;
}

/** The objective line the HUD shows. */
export function currentObjective(state) {
  const target = currentTarget(state);
  if (!target) return 'Free roam — Coral Bay is yours.';
  const m = state.mission;
  if (m.phase === 'active' && m.timer > 0) return `${target.label} — ${Math.ceil(m.timer)}s`;
  return target.label;
}

function completeMission(state, reward, lines) {
  const m = state.mission;
  state.player.money += reward;
  state.fx.text(state.player.x, state.player.y - 30, `+$${reward}`, '#7CFC98');
  state.audio.cash();
  state.audio.jingle();
  for (const [speaker, text] of lines) say(state, speaker, text);
  m.index += 1;
  m.phase = 'offer';
  m.step = 0;
  m.timer = 0;
  m.targetCar = null;
  state.onSave?.();
}

/** Fail the active job (clock, bust or hospital): back to the offer marker. */
export function failMission(state, why) {
  const m = state.mission;
  if (m.phase !== 'active' && m.phase !== 'errand') return;
  if (m.targetCar && state.player.car !== m.targetCar) {
    // The borrowed car is left where it was; it stops being special.
    m.targetCar = null;
  }
  m.phase = 'offer';
  m.step = 0;
  m.timer = 0;
  m.errandTarget = null;
  state.toast = why;
  state.toastT = 4.2;
}

function startMission(state) {
  const m = state.mission;
  const L = state.city.landmarks;
  m.phase = 'active';
  m.step = 0;
  if (m.index === 0) {
    for (const [s, t] of GARAGE_INTRO) say(state, s, t);
    say(state, 'Dario', 'First job: a red Falcón GT is sitting at Palms Mall. Bring it to me — wheels up, no questions.');
    const car = makeCar(state.rng, 'sport', L.mall.x, L.mall.y - 25, -Math.PI / 2, null);
    car.color = '#e63946';
    state.cars.push(car);
    m.targetCar = car;
  } else if (m.index === 1) {
    say(state, 'Dario', 'A package waits at Almacén 9 in the port. Take this pistol — the port is not friendly.');
    say(state, 'Dario', 'Once you have it, the Coralia wants it fast. Very fast. Do not stop for anyone.');
    state.player.weapon = 'pistol';
    state.player.ammo += 48;
    state.fx.text(state.player.x, state.player.y - 30, 'Pistol received', '#ffd166');
  } else if (m.index === 2) {
    say(state, 'Dario', 'Last job, Marlo. The Neon Run: Neptuno, the Faro, the Coralia — in order, against the clock.');
    say(state, 'Dario', 'Prove the bay is yours and I will call you partner, not driver.');
    m.timer = 150;
  }
}

function startErrand(state) {
  const m = state.mission;
  const L = state.city.landmarks;
  const spots = [L.mall, L.hotel, L.club, L.warehouse, L.police, L.hospital];
  const spot = spots[Math.floor(state.rng() * spots.length)];
  m.phase = 'errand';
  m.errandTarget = { x: spot.x, y: spot.y, label: `Errand: reach ${spot.name} in a car` };
  m.timer = 75;
  say(state, 'Dario', `Quick one: a customer is waiting at ${spot.name}. Get there in a car, 75 seconds, $120.`);
}

function playerAt(state, target, radius) {
  const p = state.player;
  const x = p.car ? p.car.x : p.x;
  const y = p.car ? p.car.y : p.y;
  return Math.hypot(x - target.x, y - target.y) < radius;
}

/** Advance the mission chain. Call once per step. */
export function stepMissions(state, dt) {
  const m = state.mission;
  // Dialogue ages here, so lines move on even while the player just listens.
  if (state.dialogue.length) {
    state.dialogue[0].t -= dt;
    if (state.dialogue[0].t <= 0) state.dialogue.shift();
  }
  if (state.toastT > 0) state.toastT -= dt;

  if (m.phase === 'offer') {
    const target = currentTarget(state);
    if (target && playerAt(state, target, 64)) {
      if (m.index < 3) startMission(state);
      else startErrand(state);
    }
    return;
  }

  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'Out of time — the job is off. Go back to the marker to try again.');
      state.audio.sting();
      return;
    }
  }

  if (m.phase === 'errand') {
    if (state.player.car && playerAt(state, m.errandTarget, 84)) {
      state.player.money += 120;
      state.fx.text(state.player.x, state.player.y - 30, '+$120', '#7CFC98');
      state.audio.cash();
      m.phase = 'offer';
      m.errandTarget = null;
      m.timer = 0;
      state.onSave?.();
    }
    return;
  }

  // Story missions, step by step.
  if (m.index === 0) {
    if (m.step === 0 && state.player.car === m.targetCar && m.targetCar) {
      m.step = 1;
      say(state, 'Dario', 'That is the one! Now bring her home — and try not to gift-wrap her around a palm.');
      if (state.wanted.heat < 1.05) state.wanted.heat = 1.05; // somebody saw the theft
    } else if (m.step === 1 && playerAt(state, state.city.landmarks.garage, 92)) {
      completeMission(state, 300, [
        ['Dario', 'Beautiful. $300, as agreed. You drive like you were born in this bay, Marlo.'],
      ]);
    }
  } else if (m.index === 1) {
    if (m.step === 0 && playerAt(state, state.city.landmarks.warehouse, 84)) {
      m.step = 1;
      m.timer = 150;
      if (state.wanted.heat < 2.05) state.wanted.heat = 2.05;
      say(state, 'Marlo', 'Got the package. Half the port just woke up — time to run.');
    } else if (m.step === 1 && playerAt(state, state.city.landmarks.hotel, 92)) {
      completeMission(state, 500, [
        ['Concierge', 'The Coralia thanks you. Dario says the bay owes you now, señor Reyes.'],
        ['Dario', 'One more job, partner. Meet me at Club Neptuno tonight.'],
      ]);
    }
  } else if (m.index === 2) {
    const target = currentTarget(state);
    if (target && state.player.car && playerAt(state, target, 96)) {
      if (m.step < 2) {
        m.step += 1;
        state.audio.cash();
        say(state, 'Dario', m.step === 1 ? 'Neptuno down! Now the Faro — mind the sand.' : 'The Faro! One more: the Coralia. Bring it home!');
      } else {
        completeMission(state, 750, [
          ['Dario', 'Partner. The garage, the bay, the whole neon shore — ours. Coral Bay is yours now.'],
          ['Marlo', 'Then let us keep it loud, socio.'],
        ]);
        state.storyDone = true;
      }
    }
  }
}
