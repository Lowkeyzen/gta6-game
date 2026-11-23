[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Lowkeyzen/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Lowkeyzen/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Coral Bay

An original open-world crime game in the spirit of the genre's greats — built for the
[make.fun "Make GTA 6" bounty (gta6-01)](https://make.fun/bounty/gta6-01).
You are Marlo, a wheelman fresh off the boat in **Coral Bay**, a neon-soaked coastal city of
palm-lined avenues, beachfront hotels and one very connected garage owner named Dario.
Run his errands, lift what you need, and try to keep the stars off your back.

Everything is original: the city, the names, the story and the art are this project's own.
No assets, no network requests — the game runs fully offline from its own static files.

## What's in the game

- **A living city** — 8×6 blocks of roads with lane markings and crosswalks, named
  businesses with neon signs (Palms Mall, Hotel Coralia, Club Neptuno, Radio Neptuno…),
  a park with a fountain, a working lighthouse, a port district, a beach and the sea.
- **On foot and behind the wheel** — walk or sprint the sidewalks, then steal any car you
  find: sedans, taxis, sports cars, vans and police cruisers, each with its own speed,
  handling and look. Traffic drives itself, stops for obstacles and panics appropriately.
- **Pedestrians** — dozens of citizens stroll the blocks, dodge traffic, flee danger and
  occasionally fight back.
- **Wanted system** — crimes witnessed by police or citizens raise your stars (up to 5).
  Police cruisers spawn, chase, and try to hold you still long enough to bust you.
  Break line of sight and the heat cools.
- **Combat** — fists, and a pistol once Dario trusts you with one. Mouse aim, tracers,
  muzzle flash, and consequences.
- **A story in three missions, then open-ended work** — steal a Falcón GT for Dario,
  run a hot package across town against the clock, then the Neon Run checkpoint race.
  After the story, the garage keeps offering paid errands.
- **HUD & minimap** — health, money, wanted stars, bust meter, weapon/ammo, speed,
  current objective with a world marker and edge arrow, and a live minimap with
  police blips.
- **Day cycle & sound** — the light drifts from morning gold to neon dusk; engines,
  sirens, punches, shots, crashes and cash are all synthesized live with WebAudio.
  No audio files.
- **Save / continue** — progress (money, mission, weapon, position) persists in
  `localStorage`.

## How to play

Serve the `game/` folder with any static file server, for example from this repo:

```sh
node serve.ts            # then open http://localhost:8080
```

(or `npx serve game`, `python3 -m http.server -d game`, … — any static server works.)

| Input | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Shift | Sprint |
| Mouse | Aim |
| Left click | Punch / shoot |
| E | Enter or exit a car |
| Space | Handbrake (in a car) |
| P or Esc | Pause |
| M | Mute |

Follow the gold marker. Dario's garage — **Taller Dario**, in Las Palmas — is where
every job starts.

## Layout

- `game/` — the game itself: `index.html` plus ES modules under `game/src/`
  (city generation, vehicles & traffic AI, pedestrians, police & wanted system,
  missions, rendering, synthesized audio). No build step, no dependencies.
- `main.ts` — the make.fun hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored make.fun library.
- `screenshots/` — the four judge screenshots (title, driving, police chase, mission).
- `serve.ts` — a tiny local dev server.

## License

MIT — see `LICENSE`.
