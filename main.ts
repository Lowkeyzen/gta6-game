// Coral Bay — hand-in program for the make.fun "Make GTA 6" bounty (gta6-01).
//
// The game itself is the static site under game/ (game/index.html plus its ES modules; no build
// step, no network). This program is only the courier: it copies game/ and screenshots/ from
// beside this file into the output directory and writes dossier.json there with the vendored
// make.fun library, byte for byte the way the scorer builds it.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with:  node serve.ts   (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, passed through so this program refuses anything the scorer would refuse
// (over 4 screenshots or one over 256 KiB, over 993 files or 48 MiB under game/, a game path
// over 1000 bytes) instead of handing in an entry that scores as invalid.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_CAPS));
console.log(`coral-bay: hand-in written to ${out} (game/ + screenshots/ + dossier.json)`);
