// A small seeded random generator (mulberry32): the same seed always builds the same city and
// stages the same screenshot, and Math.random is never used for anything the game depends on.

/** Create a generator from a 32-bit seed. Returns a function giving floats in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [min, max] from the generator. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** A float in [min, max) from the generator. */
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** One item of an array, chosen by the generator. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
