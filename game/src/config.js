// Coral Bay's tuning: the size of the world, the street grid every other module builds on, and
// the numbers that balance driving, crime and the police. One place to change how the game feels.

/** The fixed step the world advances in, seconds: 60 updates a second, however fast frames come. */
export const STEP = 1 / 60;

/** World size in pixels. The city grid fills most of it; the east edge is sand, then sea. */
export const WORLD = { width: 4400, height: 2980 };

/** Streets: vertical streets i = 0..8 and horizontal streets j = 0..6 on a regular pitch. */
export const GRID = {
  pitch: 410,
  road: 110,
  margin: 60,
  cols: 8, // building blocks across (between 9 vertical streets)
  rows: 6, // building blocks down (between 7 horizontal streets)
};

/** x of the centre line of vertical street i. */
export function streetX(i) { return GRID.margin + GRID.road / 2 + i * GRID.pitch; }
/** y of the centre line of horizontal street j. */
export function streetY(j) { return GRID.margin + GRID.road / 2 + j * GRID.pitch; }
/** The block between streets c and c + 1: its x span (the buildings stand inside it). */
export function blockX(c) { return { from: streetX(c) + GRID.road / 2, to: streetX(c + 1) - GRID.road / 2 }; }
/** The block between streets r and r + 1: its y span. */
export function blockY(r) { return { from: streetY(r) + GRID.road / 2, to: streetY(r + 1) - GRID.road / 2 }; }

/** Where the sand starts and where the sea starts, on the east edge. */
export const BEACH = { sandFrom: 3560, seaFrom: 3980 };

/** How far a lane sits from its street's centre line (right-hand traffic). */
export const LANE = 27;

/** The player on foot. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 148,
  sprintSpeed: 235,
  health: 100,
  punchRange: 40,
  punchDamage: 34,
  punchCooldown: 0.34,
  gunRange: 560,
  gunDamage: 60,
  gunCooldown: 0.24,
};

/** Heat: crimes add it, hiding bleeds it off; the stars shown are ceil(heat), capped at 5. */
export const WANTED = {
  maxStars: 5,
  decayPerSecond: 0.045,
  decayHiddenPerSecond: 0.16,
  bustFillPerSecond: 0.55,
  bustRange: 86,
};

/** localStorage key for the saved game. */
export const SAVE_KEY = 'coralbay-save-v1';

/** Money the player starts a new game with. */
export const START_MONEY = 120;
