// Juice: the short-lived sights that sell an action — impact sparks, tyre and engine smoke,
// muzzle flashes, a bullet's tracer line, and little floating texts when money changes hands.
// Everything is a plain particle with a life; nothing here touches the rules of the game.

/** Create the effects pool the game state carries. */
export function createEffects() {
  const particles = [];
  const texts = [];
  const flashes = [];
  const tracers = [];

  return {
    /** A burst of sparks or debris at a point. */
    burst(x, y, count, color, speed) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 0.32 + Math.random() * 0.3, maxLife: 0.6, size: 2 + Math.random() * 2.4,
          color, gravity: 130, smoke: false,
        });
      }
    },
    /** A puff of grey smoke that rises and thins (tyre smoke, a dying engine). */
    smoke(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 16, vy: -22 - Math.random() * 20,
          life: 0.7 + Math.random() * 0.6, maxLife: 1.3, size: 5 + Math.random() * 7,
          color: 'rgba(120,120,128,0.5)', gravity: -30, smoke: true,
        });
      }
    },
    /** A muzzle flash: a bright star that lives for a frame or two. */
    flash(x, y) {
      flashes.push({ x, y, life: 0.05 });
    },
    /** A bullet's path, drawn for a blink. */
    tracer(x1, y1, x2, y2) {
      tracers.push({ x1, y1, x2, y2, life: 0.07 });
    },
    /** A floating label that rises and fades ("+$300", "BUSTED" is a screen, not this). */
    text(x, y, str, color = '#ffd166') {
      texts.push({ x, y, str, color, life: 1.4 });
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.smoke) p.size += 9 * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.life -= dt;
        t.y -= 26 * dt;
        if (t.life <= 0) texts.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        flashes[i].life -= dt;
        if (flashes[i].life <= 0) flashes.splice(i, 1);
      }
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) tracers.splice(i, 1);
      }
    },
    /** Paint everything, in world space (the caller has translated by the camera). */
    draw(ctx) {
      for (const t of tracers) {
        ctx.strokeStyle = 'rgba(255,240,180,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.x1, t.y1);
        ctx.lineTo(t.x2, t.y2);
        ctx.stroke();
      }
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife + 0.25));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const f of flashes) {
        ctx.fillStyle = 'rgba(255,214,90,0.9)';
        ctx.beginPath();
        for (let s = 0; s < 8; s += 1) {
          const a = (s / 8) * Math.PI * 2;
          const r = s % 2 === 0 ? 15 : 6;
          const px = f.x + Math.cos(a) * r;
          const py = f.y + Math.sin(a) * r;
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const t of texts) {
        ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
  };
}
