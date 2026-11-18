// Demo mode: a sample sketch and hand-built SVG stand-ins for the seven diagrams,
// so the full sequential flow (progress, retries, cards) can be seen without an API key.
import { sleep, withBackoff } from './retry.js';

const INK = '#141414';
const OLIVE = '#5A5A40';
const PAPER = '#FBFBF7';
const PROG = { lobby: '#C9826B', library: '#C9B27A', work: '#9AA889', cafe: '#8FA3B5', amenity: '#A898B0', core: '#3A3A36' };

const SIZES = { '1:1': [1200, 1200], '4:3': [1280, 960], '3:4': [960, 1280], '16:9': [1600, 900] };

// Isometric projection
function P(ox, oy, k) {
  return (x, y, z) => [ox + (x - y) * 0.866 * k, oy + (x + y) * 0.5 * k - z * k];
}
const pts = (arr) => arr.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');

function box(p, x, y, z, w, d, h, { top = '#fff', left = '#EEEDE6', right = '#E1DFD5', stroke = INK, sw = 2, op = 1, dash } = {}) {
  const a = (X, Y, Z) => p(X, Y, Z);
  const st = `stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" opacity="${op}"${dash ? ` stroke-dasharray="${dash}"` : ''}`;
  return `
  <polygon points="${pts([a(x, y + d, z), a(x + w, y + d, z), a(x + w, y + d, z + h), a(x, y + d, z + h)])}" fill="${left}" ${st}/>
  <polygon points="${pts([a(x + w, y, z), a(x + w, y + d, z), a(x + w, y + d, z + h), a(x + w, y, z + h)])}" fill="${right}" ${st}/>
  <polygon points="${pts([a(x, y, z + h), a(x + w, y, z + h), a(x + w, y + d, z + h), a(x, y + d, z + h)])}" fill="${top}" ${st}/>`;
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * amt)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}
const colored = (hex, extra = {}) => ({ top: hex, left: shade(hex, 0.88), right: shade(hex, 0.76), ...extra });

function label(x, y, text, { size = 18, anchor = 'start', fill = INK, weight = 600, spacing = 2.4 } = {}) {
  return `<text x="${x}" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" text-anchor="${anchor}" fill="${fill}">${text}</text>`;
}

function frame(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${PAPER}"/>
  ${body}
  ${label(48, h - 44, title, { size: 16, fill: '#8A8A7A' })}
  ${label(w - 48, h - 44, 'ARCHIVISION · DEMO', { size: 16, fill: '#8A8A7A', anchor: 'end' })}
</svg>`;
}

// The building: an L-shaped terraced block with a tower, used by every view.
function building(p, opts = {}) {
  const c = opts.colors;
  return [
    box(p, 0, 0, 0, 10, 6, 3, c ? colored(c[0]) : {}),
    box(p, 0, 6, 0, 4, 5, 3, c ? colored(c[0]) : {}),
    box(p, 0, 0, 3, 8, 6, 3, c ? colored(c[1]) : {}),
    box(p, 0, 6, 3, 4, 3, 3, c ? colored(c[1]) : {}),
    box(p, 0, 0, 6, 5, 6, 3, c ? colored(c[2]) : {}),
    box(p, 0, 0, 9, 3, 4, 4, c ? colored(c[3]) : {}),
  ].join('');
}

const DIAGRAMS = {
  birdseye([w, h]) {
    const p = P(w * 0.5, h * 0.6, 26);
    const trees = [[-6, 2], [-5, 8], [-3, 13], [12, -3], [14, 3], [13, 9], [6, 13], [9, 12]]
      .map(([x, y]) => {
        const [cx, cy] = p(x, y, 0);
        return `<ellipse cx="${cx}" cy="${cy + 6}" rx="22" ry="9" fill="#000" opacity=".08"/><circle cx="${cx}" cy="${cy - 18}" r="22" fill="#9AA889" stroke="${INK}" stroke-width="1.5"/><circle cx="${cx - 6}" cy="${cy - 24}" r="9" fill="#B7C1A4"/>`;
      })
      .join('');
    const ground = `<polygon points="${pts([p(-9, -6, 0), p(17, -6, 0), p(17, 16, 0), p(-9, 16, 0)])}" fill="#E7E9DD" stroke="#C9CBBE" stroke-width="1.5"/>
      <polygon points="${pts([p(-2, -2, 0), p(13, -2, 0), p(13, 14, 0), p(-2, 14, 0)])}" fill="#F2F2EC" stroke="#C9CBBE"/>
      <polyline points="${pts([p(-9, 4, 0), p(-2, 4, 0), p(-2, 12, 0), p(17, 12, 0)])}" fill="none" stroke="#fff" stroke-width="10"/>`;
    const shadow = `<polygon points="${pts([p(10, 0, 0), p(15, 2, 0), p(15, 8, 0), p(10, 6, 0)])}" fill="#000" opacity=".07"/>`;
    return frame(w, h, "01 · BIRD'S-EYE VIEW · 45°", ground + shadow + trees + building(p));
  },

  program([w, h]) {
    const p = P(w * 0.52, h * 0.5, 40);
    const legend = [['LOBBY', PROG.lobby], ['LIBRARY', PROG.library], ['CO-WORK', PROG.work], ['ROOF CAFÉ', PROG.cafe]]
      .map(([n, c], i) => `<rect x="60" y="${80 + i * 40}" width="22" height="22" rx="4" fill="${c}" stroke="${INK}" stroke-width="1.5"/>${label(98, 98 + i * 40, n, { size: 17 })}`)
      .join('');
    return frame(w, h, '02 · PROGRAM DIAGRAM', building(p, { colors: [PROG.lobby, PROG.library, PROG.work, PROG.cafe] }) + legend);
  },

  exploded([w, h]) {
    const p = P(w * 0.36, h * 0.74, 26);
    const levels = [
      [PROG.lobby, 'GROUND · LOBBY + GALLERY', 0, (z) => box(p, 0, 0, z, 10, 6, 1, colored(PROG.lobby)) + box(p, 0, 6, z, 4, 5, 1, colored(PROG.lobby))],
      [PROG.library, 'L1 · READING ROOMS', 1, (z) => box(p, 0, 0, z, 8, 6, 1, colored(PROG.library)) + box(p, 0, 6, z, 4, 3, 1, colored(PROG.library))],
      [PROG.work, 'L2 · CO-WORKING', 2, (z) => box(p, 0, 0, z, 5, 6, 1, colored(PROG.work))],
      [PROG.cafe, 'L3 · ROOF CAFÉ', 3, (z) => box(p, 0, 0, z, 3, 4, 1, colored(PROG.cafe))],
    ];
    let out = '';
    const gap = 7;
    for (const [, name, i, draw] of levels) {
      const z = i * gap;
      out += draw(z);
      const [lx, ly] = p(10, 0, z + 0.5);
      out += `<line x1="${lx + 10}" y1="${ly}" x2="${w - 300}" y2="${ly}" stroke="${INK}" stroke-width="1"/>${label(w - 290, ly + 6, name, { size: 16 })}`;
    }
    // guide lines + core arrow
    for (const [x, y] of [[0, 0], [0, 6]]) {
      const [x1, y1] = p(x, y, 0);
      const [, y2] = p(x, y, 3 * gap + 1);
      out += `<line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y2}" stroke="${INK}" stroke-width="1" stroke-dasharray="5 6" opacity=".5"/>`;
    }
    const [cx, cyB] = p(1.5, 2, 1);
    const [, cyT] = p(1.5, 2, 3 * gap + 1);
    out += `<line x1="${cx}" y1="${cyB}" x2="${cx}" y2="${cyT + 14}" stroke="${INK}" stroke-width="4"/><polygon points="${cx - 10},${cyT + 18} ${cx + 10},${cyT + 18} ${cx},${cyT}" fill="${INK}"/>`;
    const [ax, ay] = p(3, 3, gap + 1);
    const [bx, by] = p(7, 3, gap + 1);
    out += `<line x1="${ax}" y1="${ay}" x2="${bx - 8}" y2="${by - 4}" stroke="${OLIVE}" stroke-width="4"/><circle cx="${bx}" cy="${by}" r="7" fill="${OLIVE}"/>`;
    return frame(w, h, '03 · PROGRAMMATIC EXPLODED AXONOMETRIC', out);
  },

  urban([w, h]) {
    const p = P(w * 0.5, h * 0.3, 18);
    const rnd = mulberry(7);
    let out = '';
    const blocks = [];
    for (let gx = -2; gx <= 2; gx++)
      for (let gy = -2; gy <= 2; gy++) {
        if (gx === 0 && gy === 0) continue;
        if (gx === 1 && gy === -1) continue; // park
        blocks.push([gx, gy]);
      }
    blocks.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    const park = `<polygon points="${pts([p(14, -14, 0), p(26, -14, 0), p(26, -2, 0), p(14, -2, 0)])}" fill="#E4E5DC" stroke="#9A9A92" stroke-dasharray="3 4"/>`;
    out += park;
    for (const [gx, gy] of blocks) {
      if (gx === 0 && gy === 0) continue;
      const x = gx * 14, y = gy * 14;
      const hh = 2 + Math.floor(rnd() * 7);
      out += box(p, x, y, 0, 6, 12, hh, { stroke: '#8A8A84', sw: 1.2 });
      out += box(p, x + 7, y, 0, 5, 12, 2 + Math.floor(rnd() * 5), { stroke: '#8A8A84', sw: 1.2 });
    }
    out += building(P(...p(1, 1, 0), 18), {}).replace(/fill="#(fff|EEEDE6|E1DFD5)"/g, (m, c) => `fill="${c === 'fff' ? '#2A2A28' : c === 'EEEDE6' ? INK : '#000'}"`);
    // routes
    const [r1x, r1y] = p(-30, 6, 0), [r2x, r2y] = p(30, 6, 0);
    const [r3x, r3y] = p(6, -30, 0), [r4x, r4y] = p(6, 30, 0);
    out += `<line x1="${r1x}" y1="${r1y}" x2="${r2x}" y2="${r2y}" stroke="${INK}" stroke-width="2" stroke-dasharray="10 8"/>`;
    out += `<line x1="${r3x}" y1="${r3y}" x2="${r4x}" y2="${r4y}" stroke="${INK}" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>`;
    out += `<g transform="translate(${w - 110},110)"><circle r="34" fill="none" stroke="${INK}" stroke-width="1.5"/><polygon points="0,-28 10,8 0,2 -10,8" fill="${INK}"/>${label(0, -44, 'N', { anchor: 'middle', size: 16 })}</g>`;
    out += `<g transform="translate(60,${h - 110})"><rect width="200" height="8" fill="none" stroke="${INK}"/><rect width="50" height="8" fill="${INK}"/><rect x="100" width="50" height="8" fill="${INK}"/>${label(0, 32, '0', { size: 13 })}${label(200, 32, '100 M', { size: 13, anchor: 'end' })}</g>`;
    return frame(w, h, '04 · URBAN CONTEXT', out);
  },

  section([w, h]) {
    const g = h * 0.74, s = 52, x0 = w * 0.18;
    let out = `<rect x="0" y="${g}" width="${w}" height="${h - g}" fill="url(#earth)"/>`;
    out += `<defs><pattern id="earth" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="14" stroke="#B8B6AA" stroke-width="1.5"/></pattern></defs>`;
    out += `<line x1="0" y1="${g}" x2="${w}" y2="${g}" stroke="${INK}" stroke-width="5"/>`;
    const slab = (x, y, len) => `<rect x="${x}" y="${y - 7}" width="${len}" height="14" fill="${INK}"/>`;
    const wall = (x, y1, y2) => `<rect x="${x - 6}" y="${y2}" width="12" height="${y1 - y2}" fill="${INK}"/>`;
    const L = [0, 3.5, 7, 10.5, 14.5];
    const lens = [10, 10, 8, 5, 3];
    for (let i = 0; i < L.length; i++) {
      const y = g - L[i] * s / 1.2;
      out += slab(x0, y, lens[i] * 100);
      out += label(x0 - 30, y + 6, `+${L[i].toFixed(2)}`, { size: 15, anchor: 'end', weight: 500, spacing: 0.5 });
      out += `<polygon points="${x0 - 22},${y} ${x0 - 14},${y - 8} ${x0 - 6},${y}" fill="${INK}"/>`;
      if (i < L.length - 1) {
        const yn = g - L[i + 1] * s / 1.2;
        out += wall(x0, y, yn) + wall(x0 + lens[i + 1] * 100, y, yn);
      }
    }
    // atrium void + stair
    out += `<rect x="${x0 + 320}" y="${g - 7 * s / 1.2 + 7}" width="160" height="${7 * s / 1.2 - 14}" fill="#EFEDE4"/>`;
    for (let i = 0; i < 8; i++) out += `<line x1="${x0 + 560 + i * 18}" y1="${g - i * 7}" x2="${x0 + 578 + i * 18}" y2="${g - i * 7}" stroke="${INK}" stroke-width="2"/>`;
    // beyond lines
    for (let i = 1; i < 10; i++) out += `<line x1="${x0 + i * 100}" y1="${g}" x2="${x0 + i * 100}" y2="${g - 3.5 * s / 1.2}" stroke="#B5B3A8" stroke-width="1"/>`;
    // figures
    const fig = (x, y) => `<circle cx="${x}" cy="${y - 52}" r="7" fill="${INK}"/><rect x="${x - 6}" y="${y - 44}" width="12" height="44" rx="5" fill="${INK}"/>`;
    out += fig(x0 + 150, g - 7) + fig(x0 + 420, g - 7) + fig(x0 + 650, g - 3.5 * s / 1.2 - 7) + fig(x0 + 220, g - 10.5 * s / 1.2 - 7);
    // sun rays + air
    for (let i = 0; i < 4; i++) out += `<line x1="${w - 150 - i * 40}" y1="60" x2="${x0 + 460 - i * 40}" y2="${g - 7 * s / 1.2}" stroke="${OLIVE}" stroke-width="1.5" stroke-dasharray="8 6"/>`;
    out += `<path d="M ${x0 + 60} ${g - 40} C ${x0 + 300} ${g - 120}, ${x0 + 380} ${g - 260}, ${x0 + 400} ${g - 380}" fill="none" stroke="${OLIVE}" stroke-width="2.5"/><polygon points="${x0 + 392},${g - 372} ${x0 + 408},${g - 372} ${x0 + 401},${g - 392}" fill="${OLIVE}"/>`;
    out += label(x0 + 40, g - 70, 'LOBBY', { size: 15 }) + label(x0 + 620, g - 3.5 * s / 1.2 - 70, 'READING', { size: 15 }) + label(x0 + 340, g - 7 * s / 1.2 - 70, 'CO-WORK', { size: 15 });
    return frame(w, h, '05 · ARCHITECTURAL SECTION A–A', out);
  },

  floors([w, h]) {
    const p = P(w * 0.4, h * 0.8, 24);
    const fl = [
      ['L0', 'LOBBY + GALLERY', '840 M²', [[PROG.lobby, 7], [PROG.amenity, 3]]],
      ['L1', 'LIBRARY', '760 M²', [[PROG.library, 8], [PROG.core, 2]]],
      ['L2', 'CO-WORKING', '520 M²', [[PROG.work, 5]]],
      ['L3', 'ROOF CAFÉ', '210 M²', [[PROG.cafe, 3]]],
    ];
    let out = '';
    fl.forEach(([lv, name, area, zones], i) => {
      const z = i * 7;
      let x = 0;
      for (const [c, len] of zones) {
        out += box(p, x, 0, z, len, 6, 0.6, colored(c));
        x += len;
      }
      const [lx, ly] = p(x, 0, z + 0.3);
      out += `<circle cx="${lx}" cy="${ly}" r="4" fill="${INK}"/><line x1="${lx}" y1="${ly}" x2="${w - 300}" y2="${ly}" stroke="${INK}" stroke-width="1"/>`;
      out += label(w - 290, ly - 4, `${lv} — ${name}`, { size: 16 }) + label(w - 290, ly + 20, area, { size: 14, fill: '#8A8A7A', weight: 500 });
    });
    // bar chart
    const total = 2330, bx = 60, by = 140, bh = h - 360;
    let acc = 0;
    [[PROG.lobby, 840], [PROG.library, 760], [PROG.work, 520], [PROG.cafe, 210]].forEach(([c, a]) => {
      const seg = (a / total) * bh;
      out += `<rect x="${bx}" y="${by + bh - acc - seg}" width="34" height="${seg}" fill="${c}" stroke="${INK}" stroke-width="1.5"/>`;
      out += label(bx + 46, by + bh - acc - seg / 2 + 5, `${Math.round((a / total) * 100)}%`, { size: 14, weight: 500, spacing: 0.5 });
      acc += seg;
    });
    out += label(bx, by - 20, 'PROGRAM SHARE', { size: 13, fill: '#8A8A7A' });
    return frame(w, h, '06 · FLOOR ANALYSIS', out);
  },

  massing([w, h]) {
    const cell = (Math.min(w, h) - 150 - 2 * 24) / 3;
    const ox = (w - (3 * cell + 48)) / 2;
    const steps = ['SITE', 'ENVELOPE', 'EXTRUDE', 'SUBTRACT', 'SHIFT', 'LIFT', 'PUNCTURE', 'TERRACE', 'FINAL FORM'];
    let out = '';
    steps.forEach((name, i) => {
      const r = Math.floor(i / 3), c = i % 3;
      const x = ox + c * (cell + 24), y = 48 + r * (cell + 24);
      out += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="14" fill="#fff" stroke="#DEDCD2"/>`;
      const p = P(x + cell * 0.5, y + cell * 0.55, cell / 30);
      out += `<polygon points="${pts([p(-2, -2, 0), p(12, -2, 0), p(12, 13, 0), p(-2, 13, 0)])}" fill="#F1F0EA" stroke="#B8B6AA" stroke-dasharray="${i === 0 ? '6 5' : '0'}"/>`;
      const hi = colored(OLIVE);
      const parts = {
        1: box(p, 0, 0, 0, 10, 11, 12, { top: 'none', left: 'none', right: 'none', stroke: OLIVE, dash: '6 5' }),
        2: box(p, 0, 0, 0, 10, 11, 9, hi),
        3: box(p, 0, 0, 0, 10, 6, 9) + box(p, 0, 6, 0, 4, 5, 9, hi),
        4: box(p, 0, 0, 0, 10, 6, 6) + box(p, 0, 6, 0, 4, 5, 6) + box(p, 0, 0, 6, 8, 6, 3, hi),
        5: box(p, 0, 0, 0, 10, 6, 6) + box(p, 0, 6, 0, 4, 5, 6) + box(p, 0, 0, 6, 5, 6, 3) + box(p, 0, 0, 9, 3, 4, 4, hi),
        6: box(p, 0, 0, 0, 10, 6, 3) + box(p, 0, 6, 0, 4, 5, 3) + box(p, 0, 0, 3, 8, 6, 3, hi) + box(p, 0, 0, 6, 5, 6, 3) + box(p, 0, 0, 9, 3, 4, 4),
        7: box(p, 0, 0, 0, 10, 6, 3) + box(p, 0, 6, 0, 4, 5, 3) + box(p, 0, 0, 3, 8, 6, 3) + box(p, 0, 6, 3, 4, 3, 3, hi) + box(p, 0, 0, 6, 5, 6, 3) + box(p, 0, 0, 9, 3, 4, 4),
        8: building(p),
      };
      out += parts[i] ?? '';
      out += label(x + 18, y + cell - 18, `${String(i + 1).padStart(2, '0')} ${name}`, { size: 15 });
    });
    return frame(w, h + 0, '07 · MASSING EVOLUTION', out);
  },
};

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const svgUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * Simulates one generation: a 2.5–4s "model" latency, and a single simulated
 * 429 on the exploded axonometric so the backoff path is visible.
 */
export async function generateDemoDiagram({ task, signal, onRetry, runId }) {
  let failedOnce = false;
  return withBackoff(
    async () => {
      await sleep(2500 + Math.random() * 1500, signal);
      if (task.id === 'exploded' && !failedOnce && runId % 2 === 1) {
        failedOnce = true;
        const err = new Error('429 rate_limit_error (simulated in demo mode)');
        err.status = 429;
        throw err;
      }
      const size = SIZES[task.aspect] ?? SIZES['1:1'];
      return { dataUrl: svgUrl(DIAGRAMS[task.id](size)), mimeType: 'image/svg+xml', note: 'demo' };
    },
    { signal, onRetry, isRetryable: (e) => e.status === 429 },
  );
}

const SKETCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<rect width="1200" height="900" fill="#FDFCF6"/>
<g fill="none" stroke="#1d1d1b" stroke-linecap="round" stroke-linejoin="round">
<path d="M250 610 L600 760 L960 590 L615 455 Z" stroke-width="4"/>
<path d="M248 612 L246 420 L612 280 L612 455" stroke-width="4"/>
<path d="M246 420 L600 565 L602 760" stroke-width="4"/>
<path d="M600 565 L880 445 L880 625" stroke-width="3.5"/>
<path d="M612 280 L880 380 L880 445" stroke-width="3.5"/>
<path d="M246 420 L245 300 L470 215 L470 330" stroke-width="3.5"/>
<path d="M245 300 L430 375 L430 495" stroke-width="3.5"/>
<path d="M430 375 L560 320 L560 340" stroke-width="3"/>
<path d="M300 300 L300 200 L420 155 L420 250 M300 200 L360 225 L360 320 M360 225 L470 182" stroke-width="3"/>
<path d="M300 520 L300 470 M340 537 L340 487 M380 553 L380 503 M640 690 L640 620 M690 668 L690 598 M740 645 L740 575" stroke-width="2" opacity=".6"/>
<path d="M150 700 Q 400 820 700 840 T 1100 760" stroke-width="2" stroke-dasharray="10 12" opacity=".5"/>
<path d="M160 640 L230 640 M195 610 L195 670" stroke-width="2" opacity=".5"/>
</g>
<text x="80" y="110" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#1d1d1b">harbour library — massing study 03</text>
<text x="80" y="150" font-family="Georgia, serif" font-style="italic" font-size="24" fill="#6b6b5e">terraces step down to the water, tower marks the corner</text>
</svg>`;

/** Rasterises the bundled sample sketch to a JPEG image object, same shape as fileToImage(). */
export async function loadSampleSketch() {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = svgUrl(SKETCH_SVG);
  });
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  canvas.getContext('2d').drawImage(img, 0, 0, 1200, 900);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  return {
    dataUrl,
    base64: dataUrl.split(',')[1],
    mimeType: 'image/jpeg',
    width: 1200,
    height: 900,
    name: 'harbour-library-sketch.jpg',
    size: Math.round((dataUrl.length * 3) / 4),
  };
}
