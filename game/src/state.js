// The whole game in one object: the city, every car and pedestrian, the player, the wanted
// level, the mission chain, the dialogue queue and the clocks. main.js advances it, render.js
// paints it, and the screenshot scenes stage it. Created from a seed, so a given seed always
// builds the same world.

import { START_MONEY, streetY } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createPlayer, spawnPeds } from './people.js';
import { spawnTraffic } from './vehicles.js';
import { createWanted, reportCrime } from './police.js';
import { createMissionState } from './missions.js';

/** Build a fresh game: Marlo on the street outside Dario's garage, the city awake around him. */
export function createGameState(seed) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const state = {
    rng,
    seed,
    city,
    cars: [],
    peds: [],
    player: null,
    wanted: createWanted(),
    mission: createMissionState(),
    dialogue: [],
    toast: '',
    toastT: 0,
    fx: createEffects(),
    audio: createAudio(),
    camera: { x: 0, y: 0 },
    time: 0,
    dayT: 0.16, // mid-morning, drifting toward dusk as the day cycle turns
    screen: 'title',
    district: 'Las Palmas',
    prompt: '',
    danger: { x: -9999, y: -9999 },
    events: { busted: false },
    policeSpawnT: 0,
    nearestPolice: Infinity,
    storyDone: false,
    menuItems: ['New Game', 'How to Play'],
    menuIndex: 0,
    hasSave: false,
    onSave: null,
    saveT: 0,
    attractAngle: 0,
  };
  state.player = createPlayer(1140, streetY(4) + 40);
  state.player.money = START_MONEY;
  state.reportCrime = (kind, x, y, scale) => reportCrime(state, kind, x, y, scale);
  spawnTraffic(state, 24);
  spawnPeds(state, 42);
  return state;
}
