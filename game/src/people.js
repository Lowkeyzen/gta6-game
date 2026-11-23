// People: Marlo (the player) on foot, and Coral Bay's pedestrians strolling their block rings,
// crossing at corners, fleeing trouble and occasionally fighting back. Combat lives here too —
// fists and the pistol are the player's, aimed with the mouse — as does getting in and out of
// cars, which is where most crimes begin.

import { PLAYER } from './config.js';
import { buildingAt, pushOutOfSolids } from './city.js';
import { pick, randRange } from './random.js';
import { damageCar } from './vehicles.js';

const SHIRT_COLORS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c77dff', '#f1fa8c', '#8ecae6', '#ffb703', '#e0e1dd'];
const SKIN_COLORS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** The player at a spawn point. */
export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: PLAYER.health, car: null,
    weapon: 'fist', ammo: 0, money: 0, attackCd: 0, walkPhase: 0, moving: false,
  };
}

/** One pedestrian, strolling the ring of the block it starts on (or the promenade). */
export function makePed(state, block) {
  const rng = state.rng;
  let x;
  let y;
  let idx = 0;
  if (block) {
    idx = Math.floor(randRange(rng, 0, 8));
    x = block.ring[idx].x;
    y = block.ring[idx].y;
  } else {
    x = 3680;
    y = randRange(rng, 200, 2800);
  }
  return {
    x, y, angle: 0, hp: 30, dead: false, block, idx,
    target: null, speed: randRange(rng, 52, 84), panicT: 0, fightT: 0,
    shirt: pick(rng, SHIRT_COLORS), skin: pick(rng, SKIN_COLORS),
    walkPhase: randRange(rng, 0, 6),
  };
}

/** Fill the streets with pedestrians. */
export function spawnPeds(state, count) {
  const rng = state.rng;
  for (let n = 0; n < count; n += 1) {
    const beach = rng() < 0.14;
    const block = beach ? null : pick(rng, state.city.blocks);
    state.peds.push(makePed(state, block));
  }
}

/** Where a strolling pedestrian heads next: around its block, or across to a new one. */
function nextTarget(state, ped) {
  const rng = state.rng;
  if (!ped.block) {
    ped.target = { x: 3680 + randRange(rng, -50, 130), y: Math.max(140, Math.min(2840, ped.y + randRange(rng, -460, 460))) };
    return;
  }
  if (rng() < 0.18) {
    // Cross the street: aim for the nearest ring point of a neighbouring block.
    let best = null;
    let bestD = 560;
    for (const block of state.city.blocks) {
      if (block === ped.block) continue;
      for (let i = 0; i < 8; i += 2) {
        const p = block.ring[i];
        const d = Math.hypot(p.x - ped.x, p.y - ped.y);
        if (d < bestD) { bestD = d; best = { block, idx: i, x: p.x, y: p.y }; }
      }
    }
    if (best) {
      ped.block = best.block;
      ped.idx = best.idx;
      ped.target = { x: best.x, y: best.y };
      return;
    }
  }
  ped.idx = (ped.idx + 1) % 8;
  ped.target = ped.block.ring[ped.idx];
}

/** Advance one pedestrian: stroll, flee danger, or lie where it fell. */
export function stepPed(state, ped, dt) {
  if (ped.dead) return;
  ped.walkPhase += dt * (ped.panicT > 0 ? 13 : 8);
  // Run over: any fast car on top of a pedestrian is a hit-and-run.
  for (const car of state.cars) {
    if (Math.abs(car.speed) > 130 && Math.hypot(car.x - ped.x, car.y - ped.y) < car.radius + 8) {
      ped.dead = true;
      ped.hp = 0;
      state.fx.burst(ped.x, ped.y, 10, '#e63946', 120);
      if (car.driver === 'player') state.reportCrime('hitAndRun', ped.x, ped.y, 1.6);
      return;
    }
  }
  if (ped.panicT > 0) {
    ped.panicT -= dt;
    const from = state.danger;
    const a = Math.atan2(ped.y - from.y, ped.x - from.x);
    ped.angle = a;
    ped.x += Math.cos(a) * 175 * dt;
    ped.y += Math.sin(a) * 175 * dt;
    pushOutOfSolids(state.city, ped, 11);
    return;
  }
  if (!ped.target) nextTarget(state, ped);
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 9) {
    nextTarget(state, ped);
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  // Dodge an oncoming car rather than stroll into it.
  for (const car of state.cars) {
    if (Math.abs(car.speed) > 60 && Math.hypot(car.x - ped.x, car.y - ped.y) < 64) {
      ped.panicT = Math.max(ped.panicT, 0.7);
      state.danger = { x: car.x, y: car.y };
      return;
    }
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  pushOutOfSolids(state.city, ped, 11);
}

/** Send every pedestrian near a crime running from it. */
export function scarePeds(state, x, y, radius) {
  state.danger = { x, y };
  for (const ped of state.peds) {
    if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < radius) ped.panicT = Math.max(ped.panicT, 2.2);
  }
}

/** The nearest car the player could get into (parked, or a traffic car going slowly). */
export function carNearPlayer(state, range) {
  const p = state.player;
  let best = null;
  let bestD = range;
  for (const car of state.cars) {
    if (car.driver === 'player' || car.health <= 0) continue;
    if (car.driver === 'traffic' && Math.abs(car.speed) > 55) continue;
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Put the player into a car (stealing it, if it is not already theirs). */
export function enterCar(state, car) {
  const p = state.player;
  if (car.driver === 'traffic') {
    // The driver is yanked out and runs off.
    const driver = makePed(state, null);
    driver.x = car.x + 20;
    driver.y = car.y + 10;
    driver.panicT = 3;
    state.peds.push(driver);
    state.reportCrime('theft', car.x, car.y, 1);
  } else if (!car.everDriven) {
    state.reportCrime('theft', car.x, car.y, 0.8);
  }
  car.everDriven = true;
  car.driver = 'player';
  car.parked = false;
  car.traffic = null;
  p.car = car;
  state.audio.door();
}

/** Put the player back on the pavement beside the car. */
export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  car.parked = Math.abs(car.speed) < 30;
  if (car.parked) car.speed = 0;
  p.car = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * -30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * -30;
  pushOutOfSolids(state.city, p, PLAYER.radius);
  state.audio.door();
}

/** A punch or a shot from the player, aimed at the mouse. */
function attack(state, aimAngle) {
  const p = state.player;
  const audio = state.audio;
  if (p.weapon === 'pistol') {
    if (p.ammo <= 0) {
      audio.dryFire();
      p.attackCd = 0.2;
      return;
    }
    p.ammo -= 1;
    p.attackCd = PLAYER.gunCooldown;
    audio.shot();
    state.reportCrime('shots', p.x, p.y, 1);
    scarePeds(state, p.x, p.y, 230);
    // Hitscan: walk the ray until it meets a building, a car or a person.
    let hitX = p.x + Math.cos(aimAngle) * PLAYER.gunRange;
    let hitY = p.y + Math.sin(aimAngle) * PLAYER.gunRange;
    for (let d = 14; d < PLAYER.gunRange; d += 7) {
      const x = p.x + Math.cos(aimAngle) * d;
      const y = p.y + Math.sin(aimAngle) * d;
      if (buildingAt(state.city, x, y, 1)) { hitX = x; hitY = y; break; }
      let struck = false;
      for (const ped of state.peds) {
        if (!ped.dead && Math.hypot(ped.x - x, ped.y - y) < 13) {
          ped.hp -= PLAYER.gunDamage;
          state.fx.burst(ped.x, ped.y, 7, '#e63946', 100);
          if (ped.hp <= 0) {
            ped.dead = true;
            state.reportCrime('murder', ped.x, ped.y, 1);
          } else {
            ped.panicT = 3;
          }
          hitX = x; hitY = y; struck = true;
          break;
        }
      }
      if (struck) break;
      for (const car of state.cars) {
        if (Math.hypot(car.x - x, car.y - y) < car.radius) {
          damageCar(state, car, PLAYER.gunDamage * 0.5);
          state.fx.burst(x, y, 6, '#ffd166', 110);
          if (car.driver === 'police') state.reportCrime('policeHit', x, y, 1);
          hitX = x; hitY = y; struck = true;
          break;
        }
      }
      if (struck) break;
    }
    state.fx.flash(p.x + Math.cos(aimAngle) * 22, p.y + Math.sin(aimAngle) * 22);
    state.fx.tracer(p.x, p.y, hitX, hitY);
    return;
  }
  // Fists.
  p.attackCd = PLAYER.punchCooldown;
  audio.punch();
  const hx = p.x + Math.cos(aimAngle) * PLAYER.punchRange * 0.7;
  const hy = p.y + Math.sin(aimAngle) * PLAYER.punchRange * 0.7;
  for (const ped of state.peds) {
    if (!ped.dead && Math.hypot(ped.x - hx, ped.y - hy) < 24) {
      ped.hp -= PLAYER.punchDamage;
      state.fx.burst(ped.x, ped.y, 5, '#ffffff', 80);
      state.reportCrime('assault', ped.x, ped.y, 1);
      if (ped.hp <= 0) {
        ped.dead = true;
        state.reportCrime('murder', ped.x, ped.y, 1);
      } else if (state.rng() < 0.3) {
        ped.fightT = 2.5; // some fight back
      } else {
        ped.panicT = 3;
      }
      return;
    }
  }
  for (const car of state.cars) {
    if (Math.hypot(car.x - hx, car.y - hy) < car.radius + 8) {
      damageCar(state, car, 6);
      state.fx.burst(hx, hy, 4, '#ffd166', 80);
      return;
    }
  }
}

/** Advance the player on foot: movement, aiming, attacking, being fought back at. */
export function stepPlayer(state, input, dt) {
  const p = state.player;
  p.attackCd = Math.max(0, p.attackCd - dt);
  const move = input.moveVector();
  const cam = state.camera;
  const aimAngle = Math.atan2(input.mouse.y + cam.y - p.y, input.mouse.x + cam.x - p.x);
  const speed = input.sprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = move.x !== 0 || move.y !== 0;
  if (p.moving) {
    const len = Math.hypot(move.x, move.y);
    p.x += (move.x / len) * speed * dt;
    p.y += (move.y / len) * speed * dt;
    p.walkPhase += dt * (input.sprinting() ? 13 : 10);
    if (!input.mouse.down) p.angle = Math.atan2(move.y, move.x);
  }
  if (input.mouse.down) {
    p.angle = aimAngle;
    if (p.attackCd <= 0) attack(state, aimAngle);
  }
  pushOutOfSolids(state.city, p, PLAYER.radius);
  // Pedestrians who decided to fight back take their swings.
  for (const ped of state.peds) {
    if (ped.dead || ped.fightT <= 0) continue;
    ped.fightT -= dt;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d > 30) {
      ped.x += ((p.x - ped.x) / (d || 1)) * 120 * dt;
      ped.y += ((p.y - ped.y) / (d || 1)) * 120 * dt;
    } else if (state.rng() < dt * 1.6) {
      p.hp -= 6;
      state.fx.burst(p.x, p.y, 4, '#ffffff', 70);
      state.audio.punch();
    }
  }
  // Slow recovery when the city is calm.
  if (state.wanted.stars === 0 && p.hp > 0) p.hp = Math.min(PLAYER.health, p.hp + dt * 1.6);
}
