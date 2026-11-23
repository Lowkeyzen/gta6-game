// Everything the player sees: the city from above (asphalt, sidewalks, roofs and neon signs,
// palms and the sea), the cars and people in it, and the layer above the world — HUD, minimap,
// dialogue, menus. The camera is the state's; this module only paints. Day drifts toward a
// golden dusk as you play, when the windows light up and the neon signs start to glow.

import { BEACH, GRID, PLAYER, WORLD, streetX, streetY } from './config.js';
import { currentObjective, currentTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_HELP = 'help';

/** The title menu's item boxes, shared by the painter and the click handler. */
export function menuItemRect(index, viewW, viewH) {
  return { x: viewW / 2 - 130, y: viewH * 0.52 + index * 52, w: 260, h: 42 };
}

function shade(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** How dark the day has become, 0 (midday) to 1 (deep dusk): windows and neon wake up with it. */
export function duskAmount(state) {
  const t = state.dayT; // 0..1 over the day cycle
  if (t < 0.34) return 0;
  if (t < 0.5) return (t - 0.34) / 0.16 * 0.85;
  if (t < 0.78) return 0.85;
  if (t < 0.92) return 0.85 - (t - 0.78) / 0.14 * 0.85;
  return 0;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    // The canvas backing store is the window's CSS size, so mouse coordinates, the camera
    // and the drawing all share one pixel grid (and a 1280x800 window gives 1280x800 shots).
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ----- the world -----

  function drawGround(state) {
    const cam = state.camera;
    const dusk = duskAmount(state);
    // Sea, with slow moving light on it.
    ctx.fillStyle = '#1668a8';
    ctx.fillRect(BEACH.seaFrom - cam.x, 0 - cam.y, WORLD.width - BEACH.seaFrom, WORLD.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    for (let y = 60; y < WORLD.height; y += 92) {
      ctx.beginPath();
      for (let x = BEACH.seaFrom + 20; x < WORLD.width; x += 60) {
        const wy = y + Math.sin(state.time * 0.9 + x * 0.02 + y) * 5;
        if (x === BEACH.seaFrom + 20) ctx.moveTo(x - cam.x, wy - cam.y);
        else ctx.lineTo(x - cam.x, wy - cam.y);
      }
      ctx.stroke();
    }
    // Sand.
    ctx.fillStyle = '#e8d199';
    ctx.fillRect(BEACH.sandFrom - cam.x, 0 - cam.y, BEACH.seaFrom - BEACH.sandFrom, WORLD.height);
    ctx.fillStyle = 'rgba(160,130,70,0.35)';
    for (let i = 0; i < 60; i += 1) {
      const x = BEACH.sandFrom + ((i * 613) % (BEACH.seaFrom - BEACH.sandFrom));
      const y = (i * 389) % WORLD.height;
      ctx.fillRect(x - cam.x, y - cam.y, 5, 3);
    }
    // Land base: pavement everywhere the city stands.
    ctx.fillStyle = '#7c8288';
    ctx.fillRect(0 - cam.x, 0 - cam.y, BEACH.sandFrom, WORLD.height);
    // Blocks: a lighter sidewalk slab, grass in the park and around houses.
    for (const block of state.city.blocks) {
      const x = block.x0 - 14 - cam.x;
      const y = block.y0 - 14 - cam.y;
      const w = block.x1 - block.x0 + 28;
      const h = block.y1 - block.y0 + 28;
      if (x + w < 0 || y + h < 0 || x > canvas.width || y > canvas.height) continue;
      ctx.fillStyle = block.kind === 'park' ? '#4d7c3a' : block.kind === 'residential' ? '#69995a' : '#9aa0a6';
      ctx.fillRect(x, y, w, h);
      if (block.kind === 'park') {
        ctx.strokeStyle = '#c9b18a';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + h / 2);
        ctx.lineTo(x + w - 10, y + h / 2);
        ctx.moveTo(x + w / 2, y + 10);
        ctx.lineTo(x + w / 2, y + h - 10);
        ctx.stroke();
      }
    }
    // Asphalt.
    ctx.fillStyle = '#33373d';
    for (let i = 0; i <= GRID.cols; i += 1) {
      ctx.fillRect(streetX(i) - GRID.road / 2 - cam.x, 0 - cam.y, GRID.road, WORLD.height);
    }
    for (let j = 0; j <= GRID.rows; j += 1) {
      ctx.fillRect(0 - cam.x, streetY(j) - GRID.road / 2 - cam.y, BEACH.sandFrom + 40, GRID.road);
    }
    // Lane dashes.
    ctx.strokeStyle = 'rgba(250,204,21,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (let i = 0; i <= GRID.cols; i += 1) {
      ctx.beginPath();
      ctx.moveTo(streetX(i) - cam.x, 0 - cam.y);
      ctx.lineTo(streetX(i) - cam.x, WORLD.height - cam.y);
      ctx.stroke();
    }
    for (let j = 0; j <= GRID.rows; j += 1) {
      ctx.beginPath();
      ctx.moveTo(0 - cam.x, streetY(j) - cam.y);
      ctx.lineTo(BEACH.sandFrom + 40 - cam.x, streetY(j) - cam.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Crosswalks at the intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i <= GRID.cols; i += 1) {
      for (let j = 0; j <= GRID.rows; j += 1) {
        const cx = streetX(i) - cam.x;
        const cy = streetY(j) - cam.y;
        if (cx < -90 || cy < -90 || cx > canvas.width + 90 || cy > canvas.height + 90) continue;
        for (let s = -2; s <= 2; s += 1) {
          ctx.fillRect(cx - 52, cy + s * 18 - 5, 16, 9);
          ctx.fillRect(cx + 36, cy + s * 18 - 5, 16, 9);
          ctx.fillRect(cx + s * 18 - 5, cy - 52, 9, 16);
          ctx.fillRect(cx + s * 18 - 5, cy + 36, 9, 16);
        }
      }
    }
    if (dusk > 0.3) drawLampGlow(state, dusk);
  }

  function drawLampGlow(state, dusk) {
    const cam = state.camera;
    for (const p of state.city.props) {
      if (p.kind !== 'lamp') continue;
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      if (x < -60 || y < -60 || x > canvas.width + 60 || y > canvas.height + 60) continue;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 44);
      grad.addColorStop(0, `rgba(255,214,120,${0.35 * dusk})`);
      grad.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 44, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildings(state) {
    const cam = state.camera;
    const dusk = duskAmount(state);
    for (const b of state.city.buildings) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      if (x + b.w < -120 || y + b.h < -120 || x > canvas.width + 120 || y > canvas.height + 160) continue;
      const lift = b.height;
      // Shadow, then the south wall, then the roof.
      ctx.fillStyle = 'rgba(10,12,20,0.30)';
      ctx.fillRect(x + lift * 0.4, y + lift * 0.55, b.w, b.h);
      ctx.fillStyle = shade(b.color, 0.62);
      ctx.fillRect(x, y - lift * 0.35 + b.h, b.w, lift * 0.35);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y - lift * 0.35, b.w, b.h);
      const roofY = y - lift * 0.35;
      // Roof furniture and window lights.
      if (b.kind === 'house') {
        ctx.strokeStyle = shade(b.color, 0.7);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + 8, roofY + b.h / 2);
        ctx.lineTo(x + b.w - 8, roofY + b.h / 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(x + b.w * 0.14, roofY + b.h * 0.14, b.w * 0.2, b.h * 0.18);
        ctx.fillRect(x + b.w * 0.62, roofY + b.h * 0.6, b.w * 0.16, b.h * 0.14);
        if (dusk > 0.15) {
          ctx.fillStyle = `rgba(255,214,120,${0.75 * dusk})`;
          const cols = Math.max(2, Math.floor(b.w / 26));
          const rows = Math.max(2, Math.floor(b.h / 26));
          for (let cx = 0; cx < cols; cx += 1) {
            for (let cy = 0; cy < rows; cy += 1) {
              if ((b.seed + cx * 7 + cy * 13) % 5 < 2) {
                ctx.fillRect(x + 8 + cx * 26, roofY + 8 + cy * 26, 9, 12);
              }
            }
          }
        }
      }
      // A neon sign along the front, glowing as dusk falls. Skip signs that
      // would spill onto the neighbouring building and collide with its sign.
      if (b.name && b.w > 92) {
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        if (ctx.measureText(b.name).width <= b.w + 16) {
          if (dusk > 0.2) {
            ctx.shadowColor = b.signColor;
            ctx.shadowBlur = 16 * dusk;
          }
          ctx.fillStyle = b.signColor;
          ctx.fillText(b.name, x + b.w / 2, y + b.h + 20);
          ctx.shadowBlur = 0;
        }
      }
    }
  }

  function drawProps(state) {
    const cam = state.camera;
    for (const p of state.city.props) {
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      if (x < -60 || y < -60 || x > canvas.width + 60 || y > canvas.height + 60) continue;
      if (p.kind === 'palm' || p.kind === 'tree') {
        ctx.strokeStyle = '#7a5c3e';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y - 7);
        ctx.stroke();
        ctx.strokeStyle = p.kind === 'palm' ? '#2f9e44' : '#2b6e31';
        ctx.lineWidth = 4;
        for (let f = 0; f < 6; f += 1) {
          const a = (f / 6) * Math.PI * 2 + p.x * 0.01;
          ctx.beginPath();
          ctx.moveTo(x + 4, y - 7);
          ctx.quadraticCurveTo(
            x + 4 + Math.cos(a) * 15, y - 12 + Math.sin(a) * 8,
            x + 4 + Math.cos(a) * 24, y - 4 + Math.sin(a) * 15,
          );
          ctx.stroke();
        }
        if (p.kind === 'tree') {
          ctx.fillStyle = '#35703a';
          ctx.beginPath();
          ctx.arc(x, y - 6, 17, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.kind === 'lamp') {
        ctx.fillStyle = '#3c4046';
        ctx.fillRect(x - 2, y - 2, 4, 4);
      } else if (p.kind === 'fountain') {
        ctx.fillStyle = '#9aa0a6';
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#39a7d8';
        ctx.beginPath(); ctx.arc(x, y, p.r - 8, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'lighthouse') {
        ctx.fillStyle = '#e8e4da';
        ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d64541';
        ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        const dusk = duskAmount(state);
        if (dusk > 0.25) {
          const a = state.time * 0.7;
          ctx.fillStyle = `rgba(255,243,176,${0.20 * dusk})`;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.arc(x, y, 190, a, a + 0.5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  function drawCar(state, car) {
    const cam = state.camera;
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    if (x < -80 || y < -80 || x > canvas.width + 80 || y > canvas.height + 80) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    const L = car.length;
    const W = car.width;
    ctx.fillStyle = 'rgba(10,12,20,0.35)';
    roundRect(ctx, -L / 2 + 3, -W / 2 + 5, L, W, 7);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#14161a';
    const ww = 9;
    ctx.fillRect(-L / 2 + 5, -W / 2 - 3, ww, 5);
    ctx.fillRect(-L / 2 + 5, W / 2 - 2, ww, 5);
    ctx.fillRect(L / 2 - 14, -W / 2 - 3, ww, 5);
    ctx.fillRect(L / 2 - 14, W / 2 - 2, ww, 5);
    // Body.
    ctx.fillStyle = car.health <= 0 ? '#4a4a4f' : car.color;
    roundRect(ctx, -L / 2, -W / 2, L, W, 7);
    ctx.fill();
    if (car.type === 'police') {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(-6, -W / 2, 15, W);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(-L / 2 + 2, -W / 2 + 2, 4, W - 4);
    }
    // Cabin: windshield, roof, rear window.
    ctx.fillStyle = '#1d2733';
    if (car.type === 'van') {
      ctx.fillRect(L / 2 - 13, -W / 2 + 3, 7, W - 6);
      ctx.fillStyle = shade(car.color, 1.12);
      ctx.fillRect(-L / 2 + 4, -W / 2 + 3, L - 20, W - 6);
    } else {
      ctx.fillRect(L * 0.08, -W / 2 + 3, 6, W - 6);
      ctx.fillStyle = shade(car.color, 1.18);
      roundRect(ctx, -L * 0.26, -W / 2 + 3, L * 0.34, W - 6, 4);
      ctx.fill();
      ctx.fillStyle = '#1d2733';
      ctx.fillRect(-L * 0.33, -W / 2 + 3, 5, W - 6);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#fff7cc';
      ctx.fillRect(-4, -5, 9, 10);
    }
    if (car.type === 'sport') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-L / 2 + 1, -W / 2 + 1, 4, W - 2);
    }
    if (car.type === 'police') {
      // Light bar, flashing with the game clock.
      const phase = Math.floor(state.time * 3.2) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d40' : '#7a0d18';
      ctx.fillRect(-3, -W / 2 + 2, 7, W / 2 - 2);
      ctx.fillStyle = phase ? '#274bff' : '#27c4ff';
      ctx.fillRect(-3, 0, 7, W / 2 - 2);
    }
    // Headlights at dusk.
    if (duskAmount(state) > 0.3 && car.health > 0) {
      ctx.fillStyle = 'rgba(255,240,180,0.5)';
      ctx.beginPath();
      ctx.moveTo(L / 2, -W / 4);
      ctx.lineTo(L / 2 + 44, -W / 2);
      ctx.lineTo(L / 2 + 44, W / 2);
      ctx.lineTo(L / 2, W / 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPerson(state, x0, y0, shirt, skin, angle, phase, isPlayer, dead) {
    const cam = state.camera;
    const x = x0 - cam.x;
    const y = y0 - cam.y;
    if (x < -40 || y < -40 || x > canvas.width + 40 || y > canvas.height + 40) return;
    if (dead) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + 1.2);
      ctx.fillStyle = shade(shirt, 0.55);
      roundRect(ctx, -14, -6, 28, 12, 6);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(16, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(phase) * 2.2;
    const px = Math.cos(angle + Math.PI / 2) * bob * 0.4;
    const py = Math.sin(angle + Math.PI / 2) * bob * 0.4;
    ctx.fillStyle = 'rgba(10,12,20,0.3)';
    ctx.beginPath(); ctx.arc(x + 2, y + 3, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.arc(x + px, y + py, 10.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x + px, y + py, 6, 0, Math.PI * 2); ctx.fill();
    // Facing tick.
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + px, y + py);
    ctx.lineTo(x + px + Math.cos(angle) * 13, y + py + Math.sin(angle) * 13);
    ctx.stroke();
    if (isPlayer) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 15.5, 0, Math.PI * 2); ctx.stroke();
      if (state.player.weapon === 'pistol') {
        ctx.strokeStyle = '#22252b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8);
        ctx.lineTo(x + Math.cos(angle) * 21, y + Math.sin(angle) * 21);
        ctx.stroke();
      }
    }
  }

  function drawMarker(state) {
    const target = currentTarget(state);
    if (!target || state.screen !== SCREEN_PLAY) return;
    const cam = state.camera;
    const pulse = 1 + Math.sin(state.time * 5) * 0.12;
    const x = target.x - cam.x;
    const y = target.y - cam.y;
    if (x > -40 && y > -40 && x < canvas.width + 40 && y < canvas.height + 40) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,209,102,0.20)';
      ctx.beginPath(); ctx.arc(x, y, 30 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', x, y - 42 - Math.sin(state.time * 5) * 4);
    } else {
      // An edge arrow pointing the way, with the distance.
      const p = state.player;
      const px = (p.car ? p.car.x : p.x) - cam.x;
      const py = (p.car ? p.car.y : p.y) - cam.y;
      const a = Math.atan2(target.y - (p.car ? p.car.y : p.y), target.x - (p.car ? p.car.x : p.x));
      const ex = Math.max(40, Math.min(canvas.width - 40, px + Math.cos(a) * 130));
      const ey = Math.max(40, Math.min(canvas.height - 40, py + Math.sin(a) * 130));
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const dist = Math.round(Math.hypot(target.x - (p.car ? p.car.x : p.x), target.y - (p.car ? p.car.y : p.y)) / 10);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist}m`, ex, ey + 26);
    }
  }

  // ----- the layer above the world -----

  function star(ctx2, cx, cy, r, filled) {
    ctx2.beginPath();
    for (let s = 0; s < 10; s += 1) {
      const a = -Math.PI / 2 + (s / 10) * Math.PI * 2;
      const rad = s % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (s === 0) ctx2.moveTo(px, py); else ctx2.lineTo(px, py);
    }
    ctx2.closePath();
    if (filled) ctx2.fill(); else ctx2.stroke();
  }

  function drawMinimap(state) {
    const w = 198;
    const h = 148;
    const x0 = 14;
    const y0 = canvas.height - h - 14;
    ctx.fillStyle = 'rgba(10,14,24,0.78)';
    roundRect(ctx, x0, y0, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x0, y0, w, h, 8);
    ctx.stroke();
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    const mx = (wx) => x0 + wx * sx;
    const my = (wy) => y0 + wy * sy;
    ctx.fillStyle = '#1668a8';
    ctx.fillRect(mx(BEACH.seaFrom), y0, (WORLD.width - BEACH.seaFrom) * sx, h);
    ctx.fillStyle = '#e8d199';
    ctx.fillRect(mx(BEACH.sandFrom), y0, (BEACH.seaFrom - BEACH.sandFrom) * sx, h);
    ctx.strokeStyle = 'rgba(220,225,235,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID.cols; i += 1) {
      ctx.beginPath(); ctx.moveTo(mx(streetX(i)), y0); ctx.lineTo(mx(streetX(i)), y0 + h); ctx.stroke();
    }
    for (let j = 0; j <= GRID.rows; j += 1) {
      ctx.beginPath(); ctx.moveTo(x0, my(streetY(j))); ctx.lineTo(mx(BEACH.sandFrom), my(streetY(j))); ctx.stroke();
    }
    // Cars as dots, police flashing, the objective in gold, the player as an arrow.
    for (const car of state.cars) {
      if (car.driver === 'police') {
        ctx.fillStyle = Math.floor(state.time * 3) % 2 === 0 ? '#ff2d40' : '#27c4ff';
        ctx.fillRect(mx(car.x) - 2, my(car.y) - 2, 4, 4);
      } else if (car === state.mission.targetCar) {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(mx(car.x) - 2, my(car.y) - 2, 4, 4);
      }
    }
    const target = currentTarget(state);
    if (target && Math.floor(state.time * 2.4) % 2 === 0) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(mx(target.x), my(target.y), 4, 0, Math.PI * 2); ctx.fill();
    }
    const p = state.player;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const pa = p.car ? p.car.angle : p.angle;
    ctx.save();
    ctx.translate(mx(px), my(py));
    ctx.rotate(pa);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHUD(state) {
    const p = state.player;
    const w = state.wanted;
    // Health, top-left.
    ctx.fillStyle = 'rgba(10,14,24,0.66)';
    roundRect(ctx, 14, 14, 224, 30, 7);
    ctx.fill();
    ctx.fillStyle = p.hp > 30 ? '#51cf66' : '#ff5252';
    roundRect(ctx, 18, 18, 216 * Math.max(0, p.hp) / PLAYER.health, 22, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`MARLO  ${Math.ceil(Math.max(0, p.hp))}`, 24, 34);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(state.district, 16, 62);
    // Money and stars, top-right.
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#7CFC98';
    ctx.fillText(`$${p.money}`, canvas.width - 18, 40);
    for (let s = 0; s < 5; s += 1) {
      const cx = canvas.width - 30 - s * 30;
      ctx.fillStyle = s < w.stars ? '#ffd166' : 'rgba(255,255,255,0.22)';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      star(ctx, cx, 62, 11, true);
    }
    if (w.bust > 0.02) {
      ctx.fillStyle = 'rgba(10,14,24,0.66)';
      roundRect(ctx, canvas.width - 190, 78, 172, 14, 6);
      ctx.fill();
      ctx.fillStyle = '#ff5252';
      roundRect(ctx, canvas.width - 188, 80, 168 * w.bust, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('BUSTED?', canvas.width - 104, 74);
    }
    // Objective banner, top-centre.
    const objective = currentObjective(state);
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(objective).width;
    ctx.fillStyle = 'rgba(10,14,24,0.66)';
    roundRect(ctx, canvas.width / 2 - tw / 2 - 14, 12, tw + 28, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(objective, canvas.width / 2, 32);
    // Weapon and speed, bottom-right.
    ctx.textAlign = 'right';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS', canvas.width - 18, canvas.height - 20);
    if (p.car) {
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.32)} km/h`, canvas.width - 18, canvas.height - 50);
    }
    // The contextual prompt.
    if (state.prompt) {
      ctx.font = 'bold 16px system-ui, sans-serif';
      const pw = ctx.measureText(state.prompt).width;
      ctx.fillStyle = 'rgba(10,14,24,0.7)';
      roundRect(ctx, canvas.width / 2 - pw / 2 - 12, canvas.height - 118, pw + 24, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(state.prompt, canvas.width / 2, canvas.height - 97);
    }
    // Dialogue, bottom-centre. The box grows with the wrapped line count so
    // a three-line speech is never clipped.
    const line = state.dialogue[0];
    if (line) {
      const bw = Math.min(620, canvas.width - 60);
      ctx.font = '15px system-ui, sans-serif';
      const lines = splitLines(line.text, bw - 28);
      const bh = 40 + lines.length * 19;
      const by = canvas.height - 24 - bh;
      const bx = canvas.width / 2 - bw / 2;
      ctx.fillStyle = 'rgba(8,10,18,0.82)';
      roundRect(ctx, bx, by, bw, bh, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,209,102,0.5)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, bx, by, bw, bh, 9);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#ffd166';
      ctx.fillText(line.speaker.toUpperCase(), bx + 14, by + 22);
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = '#f1f3f5';
      lines.forEach((t, i) => ctx.fillText(t, bx + 14, by + 44 + i * 19));
    }
    if (state.toast && state.toastT > 0) {
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8787';
      ctx.fillText(state.toast, canvas.width / 2, 76);
    }
    drawMinimap(state);
  }

  function splitLines(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function wrapText(text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, ly);
  }

  function drawVignetteAndDusk(state) {
    const dusk = duskAmount(state);
    if (dusk > 0.02) {
      ctx.fillStyle = `rgba(24,20,54,${0.30 * dusk})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(255,110,60,${0.07 * dusk})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawTitle(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, 'rgba(8,8,24,0.42)');
    grad.addColorStop(0.55, 'rgba(8,8,24,0.18)');
    grad.addColorStop(1, 'rgba(8,8,24,0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.shadowColor = '#ff5da2';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('CORAL', canvas.width / 2 - 128, canvas.height * 0.30);
    ctx.fillStyle = '#ff5da2';
    ctx.fillText('BAY', canvas.width / 2 + 168, canvas.height * 0.30);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText('one city, one wheelman, every neon light for sale', canvas.width / 2, canvas.height * 0.30 + 38);
    const items = state.menuItems;
    ctx.font = 'bold 20px system-ui, sans-serif';
    for (let i = 0; i < items.length; i += 1) {
      const r = menuItemRect(i, canvas.width, canvas.height);
      ctx.fillStyle = i === state.menuIndex ? 'rgba(255,93,162,0.85)' : 'rgba(10,14,24,0.72)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 9);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(items[i], r.x + r.w / 2, r.y + 28);
    }
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('WASD drive & walk · mouse aim · click fight · E enter car · Shift sprint · P pause · M mute', canvas.width / 2, canvas.height - 22);
  }

  function drawOverlay(state, title, sub, color) {
    ctx.fillStyle = 'rgba(6,8,16,0.62)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(title, canvas.width / 2, canvas.height * 0.42);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = '#f1f3f5';
    ctx.fillText(sub, canvas.width / 2, canvas.height * 0.42 + 44);
  }

  function drawHelp(state) {
    ctx.fillStyle = 'rgba(6,8,16,0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillText('HOW TO PLAY', canvas.width / 2, canvas.height * 0.24);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#f1f3f5';
    const lines = [
      'WASD / arrows — walk and drive · Shift — sprint',
      'Mouse — aim · Click — punch or shoot',
      'E — get into / out of a car · Space — handbrake',
      'Follow the gold star: meet Dario, run his three jobs, own the bay.',
      'Crimes raise your stars when someone sees them. Police bust you by',
      'staying close while you are slow — break their sight to cool down.',
      'Busted costs 15% of your cash; wasted costs 10%. The game saves itself.',
      '',
      'Click or press Enter to go back',
    ];
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height * 0.24 + 52 + i * 30));
  }

  /** Paint one frame: the world, then the layer the current screen calls for. */
  function draw(state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGround(state);
    drawBuildings(state);
    drawProps(state);
    drawMarker(state);
    for (const car of state.cars) drawCar(state, car);
    for (const ped of state.peds) drawPerson(state, ped.x, ped.y, ped.shirt, ped.skin, ped.angle, ped.walkPhase, false, ped.dead);
    const p = state.player;
    if (!p.car) drawPerson(state, p.x, p.y, '#f8f9fa', '#e0ac69', p.angle, p.walkPhase, true, false);
    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);
    state.fx.draw(ctx);
    ctx.restore();
    drawVignetteAndDusk(state);
    if (state.screen === SCREEN_TITLE) {
      drawTitle(state);
    } else if (state.screen === SCREEN_HELP) {
      drawHelp(state);
    } else {
      drawHUD(state);
      if (state.screen === SCREEN_PAUSE) drawOverlay(state, 'PAUSED', 'Press P or click to keep playing', '#22d3ee');
      if (state.screen === SCREEN_BUSTED) drawOverlay(state, 'BUSTED', 'The patrol takes 15% of your cash. You walk out of the Comisaría.', '#ff5252');
      if (state.screen === SCREEN_WASTED) drawOverlay(state, 'WASTED', 'Hospital San Coral patches you up for 10% of your cash.', '#ff5252');
    }
  }

  return { draw, resize };
}
