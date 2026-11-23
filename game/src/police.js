// The law: a heat value behind the wanted stars, and the patrol cars that answer it. Crimes
// only count when somebody sees them — a pedestrian or a patrol car close enough — which makes
// quiet crime free and loud crime expensive. Police spawn on the streets around the player,
// chase what he drives or where he runs, and bust him by staying close while he is slow or on
// foot; lose them, and the heat bleeds away.

import { WANTED, streetX, streetY } from './config.js';
import { pushOutOfSolids } from './city.js';
import { makeCar, steerToward } from './vehicles.js';
import { scarePeds } from './people.js';

const CRIME_HEAT = { theft: 1.0, assault: 0.9, murder: 2.2, shots: 0.55, hitAndRun: 1.1, policeHit: 1.8 };
const CRIME_RADIUS = { theft: 260, assault: 280, murder: 300, shots: 380, hitAndRun: 300, policeHit: 460 };

/** The wanted state at the start of a game. */
export function createWanted() {
  return { heat: 0, stars: 0, bust: 0, seen: false };
}

/**
 * Report a crime at a place. Witnessed crimes add their heat (scaled); an unwitnessed one is
 * free, except gunfire, which carries. Violent crimes scatter the crowd either way.
 */
export function reportCrime(state, kind, x, y, scale = 1) {
  let witnessed = false;
  const radius = CRIME_RADIUS[kind] ?? 280;
  for (const ped of state.peds) {
    if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < radius) { witnessed = true; break; }
  }
  if (!witnessed) {
    for (const car of state.cars) {
      if (car.driver === 'police' && Math.hypot(car.x - x, car.y - y) < 460) { witnessed = true; break; }
    }
  }
  if (kind === 'assault' || kind === 'murder' || kind === 'hitAndRun') scarePeds(state, x, y, 240);
  if (witnessed) {
    state.wanted.heat = Math.min(5.4, state.wanted.heat + (CRIME_HEAT[kind] ?? 0.5) * scale);
  } else if (kind === 'shots') {
    state.wanted.heat = Math.min(5.4, state.wanted.heat + 0.15 * scale);
  }
}

/** The point the police hunt: the player's car when he drives, the player when he walks. */
function huntPoint(state) {
  const p = state.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

/** Spawn a patrol car on a street a few blocks from the player. */
function spawnPolice(state) {
  const target = huntPoint(state);
  const angle = state.rng() * Math.PI * 2;
  const dist = 640 + state.rng() * 260;
  let x = target.x + Math.cos(angle) * dist;
  let y = target.y + Math.sin(angle) * dist;
  // Snap to the nearest intersection so the car starts on the road grid.
  let bestX = streetX(0);
  let bestY = streetY(0);
  for (let i = 0; i <= 8; i += 1) if (Math.abs(streetX(i) - x) < Math.abs(bestX - x)) bestX = streetX(i);
  for (let j = 0; j <= 6; j += 1) if (Math.abs(streetY(j) - y) < Math.abs(bestY - y)) bestY = streetY(j);
  x = Math.max(90, Math.min(3520, bestX));
  y = Math.max(90, Math.min(2890, bestY));
  const car = makeCar(state.rng, 'police', x, y, Math.atan2(target.y - y, target.x - x), 'police');
  state.cars.push(car);
}

/** Advance the wanted level and every patrol car. Sets state.events.busted when the meter fills. */
export function stepPolice(state, dt) {
  const w = state.wanted;
  const p = state.player;
  const target = huntPoint(state);

  // Who can see the player right now?
  w.seen = false;
  let nearestPolice = Infinity;
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.health <= 0) continue;
    const d = Math.hypot(car.x - target.x, car.y - target.y);
    if (d < nearestPolice) nearestPolice = d;
    if (d < 540) w.seen = true;
  }
  state.nearestPolice = nearestPolice;

  // Heat decays when unseen — slowly in the open, faster when well away from the patrols.
  if (!w.seen && w.heat > 0) {
    const rate = nearestPolice > 900 ? WANTED.decayHiddenPerSecond : WANTED.decayPerSecond;
    w.heat = Math.max(0, w.heat - rate * dt);
  }
  w.stars = Math.min(WANTED.maxStars, Math.ceil(w.heat - 1e-6));

  // Keep the patrol strength matched to the stars.
  const police = state.cars.filter((c) => c.driver === 'police');
  const desired = w.stars === 0 ? 0 : Math.min(2 + w.stars, 7);
  const active = police.filter((c) => c.health > 0);
  if (active.length < desired) {
    state.policeSpawnT = (state.policeSpawnT ?? 0) - dt;
    if (state.policeSpawnT <= 0) {
      spawnPolice(state);
      state.policeSpawnT = 1.6;
    }
  }
  // Patrol cars that lost the trail (or are wrecks far away) leave the world.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.driver !== 'police') continue;
    const d = Math.hypot(car.x - target.x, car.y - target.y);
    if ((w.stars === 0 && d > 700) || d > 2100 || (car.health <= 0 && d > 500)) {
      state.cars.splice(i, 1);
    }
  }

  // Chase.
  for (const car of police) {
    if (car.health <= 0) { car.speed = 0; continue; }
    const lead = p.car ? 0.35 : 0.12;
    const vx = p.car ? Math.cos(p.car.angle) * p.car.speed : 0;
    const vy = p.car ? Math.sin(p.car.angle) * p.car.speed : 0;
    steerToward(car, target.x + vx * lead, target.y + vy * lead, dt, 2.35);
    const d = Math.hypot(car.x - target.x, car.y - target.y);
    let desired = 415;
    if (!p.car && d < 120) desired = Math.max(0, (d - 44) * 3.2); // pull up beside a runner
    if (p.car && d < 90) desired = Math.abs(p.car.speed) + 26; // stay on his bumper
    car.speed += Math.max(-380 * dt, Math.min(330 * dt, desired - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    pushOutOfSolids(state.city, car, car.radius * 0.8);
  }

  // The bust meter: a patrol car close by while the player is on foot or barely moving.
  const playerSpeed = p.car ? Math.abs(p.car.speed) : (p.moving ? 150 : 0);
  if (w.stars > 0 && nearestPolice < WANTED.bustRange && (!p.car || playerSpeed < 30)) {
    w.bust = Math.min(1, w.bust + WANTED.bustFillPerSecond * dt);
    if (w.bust >= 1) state.events.busted = true;
  } else {
    w.bust = Math.max(0, w.bust - dt * 0.45);
  }
}
