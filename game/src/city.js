// Coral Bay itself: a grid city of named districts on a bay — the Centro's neon office towers,
// the pastel hotels of the Malecón, the houses of Las Palmas, the warehouses of the Puerto, a
// park, a beach and the sea. Generation is seeded, so the city is the same on every visit; this
// module also answers the questions every other system asks of the place: what district is
// this, what would a circle at (x, y) hit, where can a pedestrian walk.

import { BEACH, GRID, WORLD, blockX, blockY, streetX, streetY } from './config.js';
import { pick, randInt, randRange } from './random.js';

const SHOP_NAMES = ['CAFÉ ONDA', 'PIZZA FARO', 'PANADERÍA SOL', 'LICORES BRISA', 'FARMACIA MAR', 'TACOS EL FARO', 'SUSHI NEPTUNO', 'GYM BRISA', 'LIBROS CORAL', 'HELADOS LUNA'];
const OFFICE_NAMES = ['BANCO DEL MAR', 'SEGUROS CORAL', 'INMOBILIARIA BRISA', 'DIARIO LA OLA', 'RADIO NEPTUNO', 'IMPORTADORA SUR'];
const NEON_COLORS = ['#ff5da2', '#22d3ee', '#facc15', '#a3e635', '#f97316', '#e879f9'];

const PALETTES = {
  office: ['#5b6b8c', '#6d5b8c', '#546e7a', '#707a94', '#63517a', '#4f6f7a'],
  hotel: ['#f6c9d4', '#fde8c9', '#c9f2e4', '#cfe4fd', '#f9d5b0', '#e6d7fd'],
  house: ['#f2e3c6', '#e8f0d8', '#f6d8c3', '#dbeafe', '#fde2e2', '#e7e5e4'],
  shop: ['#fda4af', '#fcd34d', '#6ee7b7', '#93c5fd', '#fca5a5', '#c4b5fd'],
  warehouse: ['#8a7f72', '#7d7469', '#94867a', '#6f7d7a', '#857468'],
};

/** What kind of block (col, row) is: drives what gets built on it. */
function blockKind(col, row) {
  if (col === 2 && row === 3) return 'garage';
  if (col === 5 && row === 0) return 'police';
  if (col === 1 && row === 4) return 'hospital';
  if (col === 6 && row === 1) return 'mall';
  if (col === 1 && row === 3) return 'park';
  if (col === 7 && row === 1) return 'hotel';
  if (col === 7 && row === 2) return 'club';
  if (col === 5 && row === 5) return 'warehouse';
  if (row === 5 || (row === 4 && col >= 5)) return 'port';
  if (col === 7) return 'beachfront';
  if (col >= 3 && col <= 5 && row >= 1 && row <= 3) return 'downtown';
  if (col <= 2 && row <= 3) return 'residential';
  return 'shops';
}

function makeBuilding(rng, x, y, w, h, kind, palette, name) {
  const color = pick(rng, palette);
  return {
    x, y, w, h, kind,
    height: kind === 'office' ? randRange(rng, 46, 92) : kind === 'hotel' ? randRange(rng, 34, 54) : randRange(rng, 8, 22),
    color,
    name: name ?? null,
    signColor: pick(rng, NEON_COLORS),
    seed: Math.floor(rng() * 1e9),
  };
}

/** Build the whole city from a seeded generator. */
export function createCity(rng) {
  const buildings = [];
  const props = [];
  const landmarks = {};
  const blocks = [];

  for (let col = 0; col < GRID.cols; col += 1) {
    for (let row = 0; row < GRID.rows; row += 1) {
      const bx = blockX(col);
      const by = blockY(row);
      const kind = blockKind(col, row);
      const block = { col, row, kind, x0: bx.from, y0: by.from, x1: bx.to, y1: by.to };
      blocks.push(block);
      const inset = 30;
      const ix0 = bx.from + inset;
      const iy0 = by.from + inset;
      const iw = bx.to - bx.from - inset * 2;
      const ih = by.to - by.from - inset * 2;

      if (kind === 'park') {
        for (let i = 0; i < 9; i += 1) {
          props.push({ kind: 'tree', x: randRange(rng, bx.from + 40, bx.to - 40), y: randRange(rng, by.from + 40, by.to - 40), r: 15, solid: true });
        }
        props.push({ kind: 'fountain', x: (bx.from + bx.to) / 2, y: (by.from + by.to) / 2, r: 34, solid: true });
        continue;
      }
      if (kind === 'garage') {
        const b = makeBuilding(rng, ix0, iy0 + 60, iw, ih - 90, 'garage', ['#b3543f'], 'TALLER DARIO');
        buildings.push(b);
        landmarks.garage = { x: bx.from + 150, y: by.to + 26, name: "Dario's Garage", building: b };
        continue;
      }
      if (kind === 'police') {
        const b = makeBuilding(rng, ix0, iy0 + 40, iw, ih - 70, 'police', ['#7a8699'], 'COMISARÍA');
        buildings.push(b);
        landmarks.police = { x: bx.from + 150, y: by.to + 26, name: 'Police Station', building: b };
        continue;
      }
      if (kind === 'hospital') {
        const b = makeBuilding(rng, ix0, iy0 + 40, iw, ih - 70, 'hospital', ['#e8edf2'], 'HOSPITAL SAN CORAL');
        buildings.push(b);
        landmarks.hospital = { x: bx.from + 150, y: by.to + 26, name: 'Hospital San Coral', building: b };
        continue;
      }
      if (kind === 'mall') {
        const b = makeBuilding(rng, ix0, iy0, iw, ih - 110, 'mall', ['#d9c7a7'], 'PALMS MALL');
        buildings.push(b);
        landmarks.mall = { x: bx.from + 150, y: by.to - 55, name: 'Palms Mall', building: b };
        continue;
      }
      if (kind === 'hotel') {
        const b = makeBuilding(rng, ix0, iy0, iw, ih, 'hotel', PALETTES.hotel, 'HOTEL CORALIA');
        buildings.push(b);
        landmarks.hotel = { x: bx.to + 26, y: by.from + 150, name: 'Hotel Coralia', building: b };
        continue;
      }
      if (kind === 'club') {
        const b = makeBuilding(rng, ix0, iy0 + 30, iw, ih - 60, 'club', ['#3b2d4f'], 'CLUB NEPTUNO');
        b.signColor = '#ff5da2';
        buildings.push(b);
        landmarks.club = { x: bx.to + 26, y: by.from + 150, name: 'Club Neptuno', building: b };
        continue;
      }
      if (kind === 'warehouse') {
        const b = makeBuilding(rng, ix0, iy0 + 30, iw, ih - 60, 'warehouse', PALETTES.warehouse, 'ALMACÉN 9');
        buildings.push(b);
        landmarks.warehouse = { x: bx.from + 150, y: by.to + 26, name: 'Almacén 9', building: b };
        continue;
      }
      if (kind === 'downtown') {
        const two = rng() < 0.6;
        if (two) {
          buildings.push(makeBuilding(rng, ix0, iy0, iw * 0.46, ih, 'office', PALETTES.office, rng() < 0.5 ? pick(rng, OFFICE_NAMES) : null));
          buildings.push(makeBuilding(rng, ix0 + iw * 0.54, iy0, iw * 0.46, ih, 'office', PALETTES.office, rng() < 0.5 ? pick(rng, OFFICE_NAMES) : null));
        } else {
          buildings.push(makeBuilding(rng, ix0, iy0, iw, ih, 'office', PALETTES.office, pick(rng, OFFICE_NAMES)));
        }
        continue;
      }
      if (kind === 'port') {
        buildings.push(makeBuilding(rng, ix0, iy0 + 20, iw, ih - 40, 'warehouse', PALETTES.warehouse, rng() < 0.3 ? 'DEPÓSITO' : null));
        continue;
      }
      if (kind === 'residential') {
        for (let hx = 0; hx < 2; hx += 1) {
          for (let hy = 0; hy < 2; hy += 1) {
            buildings.push(makeBuilding(rng, ix0 + hx * (iw / 2) + 12, iy0 + hy * (ih / 2) + 12, iw / 2 - 24, ih / 2 - 24, 'house', PALETTES.house));
          }
        }
        if (rng() < 0.7) props.push({ kind: 'tree', x: bx.from + 24, y: by.from + 24, r: 13, solid: true });
        continue;
      }
      // shops and beachfront: a row of small bright buildings along the street.
      const n = 3;
      for (let s = 0; s < n; s += 1) {
        const w = iw / n - 14;
        buildings.push(makeBuilding(rng, ix0 + s * (iw / n) + 7, iy0 + 20, w, ih - 40, kind === 'beachfront' ? 'hotel' : 'shop', kind === 'beachfront' ? PALETTES.hotel : PALETTES.shop, pick(rng, SHOP_NAMES)));
      }
    }
  }

  // Palms along the promenade and the beachfront street, lamps at the intersections.
  for (let y = 140; y < WORLD.height - 120; y += 118) {
    props.push({ kind: 'palm', x: BEACH.sandFrom + 46, y: y + randRange(rng, -14, 14), r: 11, solid: true });
    if (rng() < 0.6) props.push({ kind: 'palm', x: streetX(8) + 74, y: y + 50, r: 11, solid: true });
  }
  for (let i = 0; i <= GRID.cols; i += 1) {
    for (let j = 0; j <= GRID.rows; j += 1) {
      props.push({ kind: 'lamp', x: streetX(i) - 62, y: streetY(j) - 62, r: 5, solid: false });
      props.push({ kind: 'lamp', x: streetX(i) + 62, y: streetY(j) + 62, r: 5, solid: false });
    }
  }
  // The lighthouse at the north end of the beach.
  landmarks.lighthouse = { x: 4080, y: 330, name: 'Faro de Coral' };
  props.push({ kind: 'lighthouse', x: 4080, y: 330, r: 26, solid: true });

  // Sidewalk waypoints: the ring around every block, in order, so pedestrians can stroll a
  // block and cross to the next at a corner. Beach points stroll the promenade.
  const walkPoints = [];
  for (const block of blocks) {
    const x0 = block.x0 - 16;
    const y0 = block.y0 - 16;
    const x1 = block.x1 + 16;
    const y1 = block.y1 + 16;
    const ring = [
      { x: x0, y: y0 }, { x: (x0 + x1) / 2, y: y0 }, { x: x1, y: y0 }, { x: x1, y: (y0 + y1) / 2 },
      { x: x1, y: y1 }, { x: (x0 + x1) / 2, y: y1 }, { x: x0, y: y1 }, { x: x0, y: (y0 + y1) / 2 },
    ];
    block.ring = ring;
    walkPoints.push(...ring);
  }
  for (let y = 180; y < WORLD.height - 140; y += 190) walkPoints.push({ x: BEACH.sandFrom + 120, y });

  return { buildings, props, blocks, landmarks, walkPoints };
}

/** The district name at a point, for the HUD. */
export function districtAt(city, x, y) {
  if (x >= BEACH.seaFrom) return 'La Bahía';
  if (x >= BEACH.sandFrom) return 'El Malecón';
  const col = Math.max(0, Math.min(GRID.cols - 1, Math.floor((x - GRID.margin) / GRID.pitch)));
  const row = Math.max(0, Math.min(GRID.rows - 1, Math.floor((y - GRID.margin) / GRID.pitch)));
  const block = city.blocks.find((b) => b.col === col && b.row === row);
  const kind = block ? block.kind : 'shops';
  if (kind === 'downtown' || kind === 'police') return 'El Centro';
  if (kind === 'residential' || kind === 'park' || kind === 'garage') return 'Las Palmas';
  if (kind === 'port' || kind === 'warehouse') return 'El Puerto';
  if (kind === 'hospital') return 'San Coral';
  return 'El Malecón';
}

/** True when (x, y) is on a street (asphalt), for spawning and traffic logic. */
export function isOnRoad(x, y) {
  const inV = ((x - GRID.margin) % GRID.pitch + GRID.pitch) % GRID.pitch < GRID.road;
  const inH = ((y - GRID.margin) % GRID.pitch + GRID.pitch) % GRID.pitch < GRID.road;
  return inV || inH;
}

/** The building a circle overlaps, or null. Rects are axis-aligned, so this is cheap. */
export function buildingAt(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle (an entity with x, y) out of every building and solid prop it overlaps. */
export function pushOutOfSolids(city, ent, r) {
  const b = buildingAt(city, ent.x, ent.y, r);
  if (b) {
    const left = ent.x + r - b.x;
    const right = b.x + b.w - (ent.x - r);
    const top = ent.y + r - b.y;
    const bottom = b.y + b.h - (ent.y - r);
    const min = Math.min(left, right, top, bottom);
    if (min === left) ent.x = b.x - r;
    else if (min === right) ent.x = b.x + b.w + r;
    else if (min === top) ent.y = b.y - r;
    else ent.y = b.y + b.h + r;
  }
  for (const p of city.props) {
    if (!p.solid) continue;
    const dx = ent.x - p.x;
    const dy = ent.y - p.y;
    const d2 = dx * dx + dy * dy;
    const min = r + p.r;
    if (d2 < min * min && d2 > 0.01) {
      const d = Math.sqrt(d2);
      ent.x = p.x + (dx / d) * min;
      ent.y = p.y + (dy / d) * min;
    }
  }
  // The sea is a wall, and so is the edge of the world.
  ent.x = Math.max(r, Math.min(WORLD.width - r, ent.x));
  ent.y = Math.max(r, Math.min(WORLD.height - r, ent.y));
  if (ent.x > BEACH.seaFrom + 30) ent.x = BEACH.seaFrom + 30;
}
