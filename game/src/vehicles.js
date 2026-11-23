// Cars: the types Coral Bay drives, the traffic that follows the street grid lane by lane, the
// parked cars waiting to be borrowed, and the arcade physics of the car the player drives.
// Traffic keeps to the right-hand lane of its street, slows for whatever is ahead, and at each
// intersection mostly goes straight, sometimes turns — never a U-turn, never off the grid.

import { GRID, LANE, streetX, streetY } from './config.js';
import { buildingAt, pushOutOfSolids } from './city.js';
import { pick, randRange } from './random.js';

export const CAR_TYPES = {
  sedan: { length: 46, width: 22, maxSpeed: 305, accel: 250, cruise: 150, colors: ['#c0c8d4', '#8fa3bf', '#b3564d', '#5d8a66', '#c9a227', '#7a6a9e', '#d97b29'] },
  taxi: { length: 46, width: 22, maxSpeed: 300, accel: 245, cruise: 155, colors: ['#f7b731'] },
  sport: { length: 49, width: 23, maxSpeed: 445, accel: 360, cruise: 185, colors: ['#e63946', '#ff7b00', '#00b4d8', '#80ed99', '#e0aaff'] },
  van: { length: 58, width: 26, maxSpeed: 245, accel: 190, cruise: 125, colors: ['#a8a29e', '#78716c', '#94a3b8', '#64748b'] },
  police: { length: 48, width: 23, maxSpeed: 415, accel: 340, cruise: 200, colors: ['#e8ecf1'] },
};

let nextCarId = 1;

/** Create a car of a type at a place. driver: 'traffic', 'police', 'player' or null (parked). */
export function makeCar(rng, type, x, y, angle, driver) {
  const spec = CAR_TYPES[type];
  return {
    id: nextCarId += 1,
    type, x, y, angle, speed: 0,
    length: spec.length, width: spec.width,
    radius: spec.length * 0.42,
    color: pick(rng, spec.colors),
    driver, health: 100, parked: driver === null,
    traffic: null, // lane-following state, for traffic cars
    bust: 0,
  };
}

/** The lane x for a car travelling vertically on street i (dir +1 south, -1 north). */
function laneX(i, dir) { return streetX(i) + (dir > 0 ? -LANE : LANE); }
/** The lane y for a car travelling horizontally on street j (dir +1 east, -1 west). */
function laneY(j, dir) { return streetY(j) + (dir > 0 ? LANE : -LANE); }

/** Give a traffic car a fresh lane-following state on the street it sits on. */
export function startTraffic(car, rng) {
  const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
  if (vertical) {
    let street = 0;
    let best = Infinity;
    for (let i = 0; i <= GRID.cols; i += 1) {
      const d = Math.abs(car.x - streetX(i));
      if (d < best) { best = d; street = i; }
    }
    const dir = Math.sin(car.angle) > 0 ? 1 : -1;
    let cross = 0;
    best = Infinity;
    for (let j = 0; j <= GRID.rows; j += 1) {
      const d = Math.abs(car.y - streetY(j));
      if (d < best) { best = d; cross = j; }
    }
    if ((dir > 0 && streetY(cross) < car.y) || (dir < 0 && streetY(cross) > car.y)) cross += dir;
    car.traffic = { axis: 'v', street, dir, cross: Math.max(0, Math.min(GRID.rows, cross)) };
    car.x = laneX(street, dir);
  } else {
    let street = 0;
    let best = Infinity;
    for (let j = 0; j <= GRID.rows; j += 1) {
      const d = Math.abs(car.y - streetY(j));
      if (d < best) { best = d; street = j; }
    }
    const dir = Math.cos(car.angle) > 0 ? 1 : -1;
    let cross = 0;
    best = Infinity;
    for (let i = 0; i <= GRID.cols; i += 1) {
      const d = Math.abs(car.x - streetX(i));
      if (d < best) { best = d; cross = i; }
    }
    if ((dir > 0 && streetX(cross) < car.x) || (dir < 0 && streetX(cross) > car.x)) cross += dir;
    car.traffic = { axis: 'h', street, dir, cross: Math.max(0, Math.min(GRID.cols, cross)) };
    car.y = laneY(street, dir);
  }
}

/** The traffic car's current waypoint: where its lane crosses the street it is heading to. */
function waypoint(car) {
  const t = car.traffic;
  if (t.axis === 'v') return { x: laneX(t.street, t.dir), y: streetY(t.cross) };
  return { x: streetX(t.cross), y: laneY(t.street, t.dir) };
}

/** At an intersection, choose what the traffic car does next (and set its new target). */
function decide(car, rng) {
  const t = car.traffic;
  const options = [];
  if (t.axis === 'v') {
    const nextCross = t.cross + t.dir;
    if (nextCross >= 0 && nextCross <= GRID.rows) options.push('straight', 'straight');
    // Turning onto the crossing street: left is newDir = dir (in x), right is -dir.
    const leftNext = t.street + t.dir;
    const rightNext = t.street - t.dir;
    if (leftNext >= 0 && leftNext <= GRID.cols) options.push('left');
    if (rightNext >= 0 && rightNext <= GRID.cols) options.push('right');
    const choice = options.length ? pick(rng, options) : 'straight';
    if (choice === 'straight') {
      t.cross = nextCross;
    } else {
      const newDir = choice === 'left' ? t.dir : -t.dir;
      car.traffic = { axis: 'h', street: t.cross, dir: newDir, cross: t.street + newDir };
    }
  } else {
    const nextCross = t.cross + t.dir;
    if (nextCross >= 0 && nextCross <= GRID.cols) options.push('straight', 'straight');
    // Turning onto the crossing street: left is newDir = -dir (in y), right is dir.
    const leftNext = t.street - t.dir;
    const rightNext = t.street + t.dir;
    if (leftNext >= 0 && leftNext <= GRID.rows) options.push('left');
    if (rightNext >= 0 && rightNext <= GRID.rows) options.push('right');
    const choice = options.length ? pick(rng, options) : 'straight';
    if (choice === 'straight') {
      t.cross = nextCross;
    } else {
      const newDir = choice === 'left' ? -t.dir : t.dir;
      car.traffic = { axis: 'v', street: t.cross, dir: newDir, cross: t.street + newDir };
    }
  }
}

/** Is something (a car or a pedestrian) just ahead of this car? Returns 0..1 urgency. */
function blockedAhead(state, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let urgency = 0;
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * fy - dy * fx);
    if (ahead > 0 && ahead < 78 && side < 20) urgency = Math.max(urgency, 1 - ahead / 78);
  }
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * fy - dy * fx);
    if (ahead > 0 && ahead < 52 && side < 18) urgency = 1;
  }
  if (state.player && !state.player.car) {
    const dx = state.player.x - car.x;
    const dy = state.player.y - car.y;
    const ahead = dx * fx + dy * fy;
    const side = Math.abs(dx * fy - dy * fx);
    if (ahead > 0 && ahead < 52 && side < 18) urgency = 1;
  }
  return urgency;
}

/** Steer a car toward a point with a limited turn rate; returns the angle difference. */
export function steerToward(car, tx, ty, dt, turnRate) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = turnRate * dt;
  car.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
  return diff;
}

/** Advance one traffic car: follow its lane, mind traffic, decide at intersections. */
export function stepTraffic(state, car, dt) {
  const rng = state.rng;
  if (!car.traffic) startTraffic(car, rng);
  const wp = waypoint(car);
  const dist = Math.hypot(wp.x - car.x, wp.y - car.y);
  if (dist < 34) {
    decide(car, rng);
    return;
  }
  const diff = steerToward(car, wp.x, wp.y, dt, 2.4);
  const spec = CAR_TYPES[car.type];
  let target = spec.cruise * (1 - Math.min(0.75, Math.abs(diff) * 0.9));
  const urgency = blockedAhead(state, car);
  if (urgency > 0) target = Math.min(target, spec.cruise * (1 - urgency) - (urgency >= 1 ? spec.cruise : 0));
  if (target < 0) target = 0;
  car.speed += Math.max(-260 * dt, Math.min(150 * dt, target - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  pushOutOfSolids(state.city, car, car.radius * 0.8);
}

/** Advance the car the player drives, from the driving keys. */
export function stepPlayerCar(state, car, drive, dt) {
  const spec = CAR_TYPES[car.type];
  const onSand = car.x > 3560 && car.x < 3980;
  const maxF = spec.maxSpeed * (onSand ? 0.55 : 1);
  const maxR = -110;
  if (drive.throttle > 0) car.speed += spec.accel * dt;
  else if (drive.throttle < 0) car.speed -= (car.speed > 0 ? 320 : spec.accel * 0.55) * dt;
  else car.speed -= car.speed * 0.55 * dt; // engine braking
  car.speed -= car.speed * 0.35 * dt; // drag
  if (drive.brake) car.speed -= car.speed * 3.2 * dt;
  car.speed = Math.max(maxR, Math.min(maxF, car.speed));
  if (drive.steer !== 0 && Math.abs(car.speed) > 4) {
    const grip = drive.brake ? 3.4 : 2.3;
    car.angle += drive.steer * grip * dt * Math.min(1, Math.abs(car.speed) / 130) * (car.speed < 0 ? -1 : 1);
  }
  const beforeX = car.x;
  const beforeY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hit = buildingAt(state.city, car.x, car.y, car.radius * 0.8);
  pushOutOfSolids(state.city, car, car.radius * 0.8);
  if (hit && Math.abs(car.speed) > 120) {
    damageCar(state, car, Math.abs(car.speed) * 0.045);
    state.audio.crash(Math.abs(car.speed) / 60);
    state.fx.burst(car.x, car.y, 10, '#ffd166', 130);
    car.speed *= -0.22;
  } else if ((beforeX !== car.x || beforeY !== car.y) && Math.abs(car.speed) > 200) {
    car.speed *= 0.94;
  }
  // Skid smoke when cornering hard under power.
  if (Math.abs(car.speed) > 190 && drive.steer !== 0 && state.rng() < 0.5) {
    state.fx.smoke(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, 1);
  }
}

/** Hurt a car; at zero it is a smoking wreck that no longer drives. */
export function damageCar(state, car, amount) {
  car.health = Math.max(0, car.health - amount);
  if (car.health <= 0 && car.driver === 'traffic') {
    car.driver = null;
    car.parked = true;
  }
}

/** Separate overlapping cars and share the shove; returns nothing, mutates positions/speeds. */
export function collideCars(state, dt) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = (a.radius + b.radius) * 0.82;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      const aFixed = a.parked && a.driver === null;
      const bFixed = b.parked && b.driver === null;
      if (!aFixed) { a.x -= nx * push; a.y -= ny * push; }
      if (!bFixed) { b.x += nx * push; b.y += ny * push; }
      const rel = Math.abs(a.speed - b.speed);
      if (rel > 90) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        state.fx.burst(mid.x, mid.y, 8, '#ffd166', 110);
        state.audio.crash(rel / 60);
        damageCar(state, a, rel * 0.03);
        damageCar(state, b, rel * 0.03);
        if (a.driver === 'player' || b.driver === 'player') state.reportCrime('hitAndRun', mid.x, mid.y, 0.5);
      }
      const avg = (a.speed + b.speed) / 2;
      if (!aFixed) a.speed = avg;
      if (!bFixed) b.speed = avg;
    }
  }
}

/** Spawn the ambient traffic and parked cars that make the city feel lived in. */
export function spawnTraffic(state, count) {
  const rng = state.rng;
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'sport', 'van'];
  for (let n = 0; n < count; n += 1) {
    const vertical = rng() < 0.5;
    const i = Math.floor(randRange(rng, 0, GRID.cols + 0.99));
    const j = Math.floor(randRange(rng, 0, GRID.rows + 0.99));
    const dir = rng() < 0.5 ? 1 : -1;
    let x;
    let y;
    let angle;
    if (vertical) {
      x = laneX(Math.min(i, GRID.cols), dir);
      y = streetY(Math.min(j, GRID.rows)) + randRange(rng, -140, 140);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = laneY(Math.min(j, GRID.rows), dir);
      x = streetX(Math.min(i, GRID.cols)) + randRange(rng, -140, 140);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCar(rng, pick(rng, types), x, y, angle, 'traffic');
    car.speed = CAR_TYPES[car.type].cruise * 0.8;
    startTraffic(car, rng);
    state.cars.push(car);
  }
  // Parked cars along the curbs, waiting to be borrowed.
  for (let n = 0; n < 22; n += 1) {
    const vertical = rng() < 0.5;
    const i = Math.floor(randRange(rng, 0, GRID.cols + 0.99));
    const t = randRange(rng, 0.08, 0.92);
    let x;
    let y;
    let angle;
    if (vertical) {
      const cx = streetX(Math.min(i, GRID.cols));
      x = cx + (rng() < 0.5 ? -46 : 46);
      y = GRID.margin + t * (2980 - GRID.margin * 2);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const cy = streetY(Math.floor(randRange(rng, 0, GRID.rows + 0.99)));
      y = cy + (rng() < 0.5 ? -46 : 46);
      x = GRID.margin + t * (3560 - GRID.margin * 2);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    if (buildingAt(state.city, x, y, 24)) continue;
    state.cars.push(makeCar(rng, pick(rng, types), x, y, angle, null));
  }
}

/** Keep traffic near the player: a car that has wandered too far re-enters across town. */
export function recycleTraffic(state) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    const d = Math.hypot(car.x - px, car.y - py);
    if (d > 1750) {
      const angle = state.rng() * Math.PI * 2;
      const nx = px + Math.cos(angle) * 1150;
      const ny = py + Math.sin(angle) * 1150;
      if (nx > 80 && nx < 3500 && ny > 80 && ny < 2900) {
        car.x = nx;
        car.y = ny;
        car.traffic = null;
        startTraffic(car, state.rng);
      }
    }
  }
}
