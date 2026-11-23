// The screenshot scenes behind ?shot=title|drive|chase|mission. Each stages the real game —
// the real city, traffic, police and mission state — runs it forward a few fixed seconds with
// simple scripted driving, then freezes on a frame worth showing: the title over the living
// city, a delivery run downtown, a four-star chase, and Marlo meeting Dario. The day is held
// at golden dusk in every scene, when Coral Bay looks its best.

import { STEP, streetX, streetY } from './config.js';
import { collideCars, makeCar, stepPlayerCar, stepTraffic } from './vehicles.js';
import { makePed, stepPed } from './people.js';
import { say } from './missions.js';
import { stepPolice } from './police.js';

const GOLDEN = 0.44; // dayT where the dusk is half fallen: lit windows, waking neon

function runSeconds(state, seconds, driveFn) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    for (const car of state.cars) {
      if (car.driver === 'traffic') stepTraffic(state, car, STEP);
    }
    for (const ped of state.peds) stepPed(state, ped, STEP);
    if (driveFn) driveFn(STEP);
    collideCars(state, STEP);
    state.fx.update(STEP);
    state.time += STEP;
  }
}

/** Take the ambient traffic out of one stretch of road, so a staged drive has a clear run. */
function clearCorridor(state, y, x0, x1, halfH) {
  state.cars = state.cars.filter((car) => {
    if (car.driver !== 'traffic' && car.driver !== null) return true;
    return !(car.x > x0 && car.x < x1 && Math.abs(car.y - y) < halfH);
  });
}

function centreCamera(state, view, x, y) {
  state.camera.x = Math.max(0, Math.min(4400 - view.w, x - view.w / 2));
  state.camera.y = Math.max(0, Math.min(2980 - view.h, y - view.h / 2));
}

/** Stage the named scene on a fresh state and leave it ready to paint. */
export function stageShot(state, name, view) {
  state.dayT = GOLDEN;
  const L = state.city.landmarks;

  if (name === 'drive') {
    // Marlo in the stolen Falcón, mid-delivery through the Centro, traffic all around.
    const car = makeCar(state.rng, 'sport', 1500, streetY(2) + 27, 0, 'player');
    car.color = '#e63946';
    car.everDriven = true;
    state.cars.push(car);
    state.player.car = car;
    state.mission.index = 0;
    state.mission.phase = 'active';
    state.mission.step = 1;
    state.mission.targetCar = car;
    state.player.money = 120;
    clearCorridor(state, streetY(2), 1350, 2900, 62);
    runSeconds(state, 3.2, (dt) => stepPlayerCar(state, car, { throttle: 1, steer: 0, brake: false }, dt));
    centreCamera(state, view, car.x + 120, car.y);
    state.screen = 'play';
    return;
  }

  if (name === 'chase') {
    // Four stars over the Centro: patrol cars on his bumper, lights going.
    const car = makeCar(state.rng, 'sedan', 2050, streetY(3) + 27, 0, 'player');
    car.color = '#00b4d8';
    car.everDriven = true;
    car.speed = 300;
    state.cars.push(car);
    state.player.car = car;
    state.wanted.heat = 3.6;
    state.wanted.stars = 4;
    for (let i = 0; i < 3; i += 1) {
      const cop = makeCar(state.rng, 'police', 2050 - 210 - i * 150, streetY(3) + (i % 2 === 0 ? 27 : -27), 0, 'police');
      cop.speed = 300;
      state.cars.push(cop);
    }
    state.mission.index = 1;
    state.mission.phase = 'active';
    state.mission.step = 1;
    state.mission.timer = 96;
    state.player.money = 620;
    state.player.weapon = 'pistol';
    state.player.ammo = 31;
    clearCorridor(state, streetY(3), 1850, 3100, 62);
    runSeconds(state, 2.4, (dt) => {
      stepPlayerCar(state, car, { throttle: 1, steer: 0, brake: false }, dt);
      stepPolice(state, dt);
    });
    state.wanted.bust = 0.3;
    centreCamera(state, view, car.x + 60, car.y);
    state.screen = 'play';
    return;
  }

  if (name === 'mission') {
    // On foot at the garage, Dario talking, the gold marker close and the city strolling by.
    const dario = makePed(state, null);
    dario.shirt = '#ffd166';
    state.peds.push(dario);
    runSeconds(state, 2.5, null);
    // Placed after the run, so the frame is exact: Marlo before the garage, Dario beside him.
    state.player.x = L.garage.x;
    state.player.y = L.garage.y - 66;
    state.player.angle = -0.5;
    dario.x = L.garage.x + 36;
    dario.y = L.garage.y - 72;
    dario.angle = 2.6;
    say(state, 'Dario', 'Marlo! You made it to Coral Bay. I run this garage — and half the favours in this town.');
    state.screen = 'play';
    centreCamera(state, view, state.player.x, state.player.y - 30);
    return;
  }

  // title: the living city under the name — traffic on the Malecón, the sea at the edge.
  runSeconds(state, 5, null);
  state.screen = 'title';
  centreCamera(state, view, streetX(7) + 210, streetY(2) + 60);
}
