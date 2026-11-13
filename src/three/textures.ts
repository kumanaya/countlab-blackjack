/* Procedural canvas textures: cards, chips, felt, leather and wood.
 * Everything is generated on the client and cached — no image files. */
import * as THREE from 'three';
import { TABLE } from './layout';

const RED = '#b3122b';
const INK = '#14171c';
const GOLD = '#d8b46a';
const RED_SUITS = new Set(['♥', '♦']);

const cache = new Map<string, THREE.Texture>();

function remember<T extends THREE.Texture>(key: string, build: () => T): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const t = build();
  cache.set(key, t);
  return t;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function toTex(c: HTMLCanvasElement, { srgb = true, repeat = 0, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  t.needsUpdate = true;
  return t;
}

/* Stable PRNG so textures don't change on every reload. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, dots: number, alpha: number, seed = 7) {
  const r = rng(seed);
  for (let i = 0; i < dots; i++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha * 0.8})`;
    ctx.fillRect(r() * w, r() * h, 1.3, 1.3);
  }
}

/* ---------------- vector suits (font-independent) ---------------- */

function suitPath(suit: string): Path2D {
  const p = new Path2D();
  if (suit === '♥') {
    p.moveTo(0, 0.42);
    p.bezierCurveTo(-0.08, 0.3, -0.5, 0.06, -0.5, -0.17);
    p.bezierCurveTo(-0.5, -0.38, -0.33, -0.48, -0.2, -0.48);
    p.bezierCurveTo(-0.09, -0.48, -0.02, -0.4, 0, -0.32);
    p.bezierCurveTo(0.02, -0.4, 0.09, -0.48, 0.2, -0.48);
    p.bezierCurveTo(0.33, -0.48, 0.5, -0.38, 0.5, -0.17);
    p.bezierCurveTo(0.5, 0.06, 0.08, 0.3, 0, 0.42);
  } else if (suit === '♦') {
    p.moveTo(0, -0.5);
    p.quadraticCurveTo(0.2, -0.2, 0.38, 0);
    p.quadraticCurveTo(0.2, 0.2, 0, 0.5);
    p.quadraticCurveTo(-0.2, 0.2, -0.38, 0);
    p.quadraticCurveTo(-0.2, -0.2, 0, -0.5);
  } else if (suit === '♠') {
    p.moveTo(0, -0.5);
    p.bezierCurveTo(0.08, -0.36, 0.5, -0.12, 0.5, 0.1);
    p.bezierCurveTo(0.5, 0.3, 0.33, 0.38, 0.21, 0.38);
    p.bezierCurveTo(0.12, 0.38, 0.05, 0.33, 0.03, 0.27);
    p.quadraticCurveTo(0.06, 0.42, 0.17, 0.5);
    p.lineTo(-0.17, 0.5);
    p.quadraticCurveTo(-0.06, 0.42, -0.03, 0.27);
    p.bezierCurveTo(-0.05, 0.33, -0.12, 0.38, -0.21, 0.38);
    p.bezierCurveTo(-0.33, 0.38, -0.5, 0.3, -0.5, 0.1);
    p.bezierCurveTo(-0.5, -0.12, -0.08, -0.36, 0, -0.5);
  } else {
    p.arc(0, -0.24, 0.21, 0, Math.PI * 2);
    p.moveTo(-0.03, 0.08);
    p.arc(-0.24, 0.08, 0.21, 0, Math.PI * 2);
    p.moveTo(0.45, 0.08);
    p.arc(0.24, 0.08, 0.21, 0, Math.PI * 2);
    p.moveTo(0.05, 0);
    p.lineTo(0.05, 0.28);
    p.quadraticCurveTo(0.07, 0.42, 0.18, 0.5);
    p.lineTo(-0.18, 0.5);
    p.quadraticCurveTo(-0.07, 0.42, -0.05, 0.28);
    p.lineTo(-0.05, 0);
    p.closePath();
  }
  return p;
}

const suitCache = new Map<string, Path2D>();
function drawSuit(ctx: CanvasRenderingContext2D, suit: string, x: number, y: number, size: number, color: string, flip = false) {
  let p = suitCache.get(suit);
  if (!p) {
    p = suitPath(suit);
    suitCache.set(suit, p);
  }
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.rotate(Math.PI);
  ctx.scale(size, size);
  ctx.fillStyle = color;
  ctx.fill(p, 'nonzero');
  ctx.restore();
}

/* ---------------- cards ---------------- */

const CW = 512;
const CH = 712;
let SERIF = '"Georgia", "Times New Roman", serif';

/** Called before generating textures, with the actual family loaded by next/font. */
export function setCanvasSerif(family: string) {
  SERIF = `${family}, "Georgia", "Times New Roman", serif`;
}

// [x 0..1 across the pip column, y 0..1, flipped]
const PIPS: Record<number, [number, number, number?][]> = {
  2: [[0.5, 0], [0.5, 1, 1]],
  3: [[0.5, 0], [0.5, 0.5], [0.5, 1, 1]],
  4: [[0, 0], [1, 0], [0, 1, 1], [1, 1, 1]],
  5: [[0, 0], [1, 0], [0.5, 0.5], [0, 1, 1], [1, 1, 1]],
  6: [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1, 1], [1, 1, 1]],
  7: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1, 1], [1, 1, 1]],
  8: [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75, 1], [0, 1, 1], [1, 1, 1]],
  9: [[0, 0], [1, 0], [0, 0.333], [1, 0.333], [0.5, 0.5], [0, 0.667, 1], [1, 0.667, 1], [0, 1, 1], [1, 1, 1]],
  10: [[0, 0], [1, 0], [0.5, 0.167], [0, 0.333], [1, 0.333], [0, 0.667, 1], [1, 0.667, 1], [0.5, 0.833, 1], [0, 1, 1], [1, 1, 1]],
};

function paper(ctx: CanvasRenderingContext2D, seed: number) {
  ctx.fillStyle = '#f6f1e5';
  ctx.fillRect(0, 0, CW, CH);
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  g.addColorStop(0, 'rgba(255,255,255,.7)');
  g.addColorStop(0.5, 'rgba(250,246,236,0)');
  g.addColorStop(1, 'rgba(214,203,180,.35)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
  grain(ctx, CW, CH, 5200, 0.035, seed);
}

function cornerIndex(ctx: CanvasRenderingContext2D, rank: string, suit: string, color: string) {
  const draw = () => {
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const narrow = rank === '10';
    ctx.font = `700 ${narrow ? 66 : 76}px ${SERIF}`;
    if (narrow) {
      ctx.save();
      ctx.translate(52, 92);
      ctx.scale(0.78, 1);
      ctx.fillText(rank, 0, 0);
      ctx.restore();
    } else ctx.fillText(rank, 52, 92);
    drawSuit(ctx, suit, 52, 132, 46, color);
  };
  draw();
  ctx.save();
  ctx.translate(CW, CH);
  ctx.rotate(Math.PI);
  draw();
  ctx.restore();
}

function courtArt(ctx: CanvasRenderingContext2D, rank: string, suit: string, color: string) {
  const x = 104, y = 64, w = CW - 208, h = CH - 128;
  // framed panel
  ctx.save();
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, 'rgba(216,180,106,.16)');
  bg.addColorStop(0.5, 'rgba(216,180,106,.04)');
  bg.addColorStop(1, 'rgba(216,180,106,.16)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 8);
  ctx.stroke();
  ctx.restore();

  // central diagonal band, mirrored ornament
  const cx = CW / 2;
  const cy = CH / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 8);
  ctx.clip();
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 40, cy + i * 18 + 40);
    ctx.lineTo(x + w + 40, cy + i * 18 - 40);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#f6f1e5';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 74, 74, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  drawSuit(ctx, suit, cx, cy, 70, color);

  for (const flip of [false, true]) {
    ctx.save();
    ctx.translate(cx, cy);
    if (flip) ctx.rotate(Math.PI);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 150px ${SERIF}`;
    ctx.fillText(rank, 0, -170);
    // simple crown for K and Q, staff for J
    ctx.strokeStyle = GOLD;
    ctx.fillStyle = GOLD;
    ctx.lineWidth = 3;
    if (rank === 'K' || rank === 'Q') {
      const n = rank === 'K' ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(-60, -84);
      for (let i = 0; i <= n * 2; i++) {
        const px = -60 + (120 * i) / (n * 2);
        ctx.lineTo(px, i % 2 === 0 ? -112 : -90);
      }
      ctx.lineTo(60, -84);
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
    } else {
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(-64, -98);
      ctx.lineTo(64, -98);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -98, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function cardFaceTexture(rank: string, suit: string) {
  return remember(`face:${rank}${suit}`, () => {
    const [c, ctx] = canvas(CW, CH);
    const color = RED_SUITS.has(suit) ? RED : INK;
    paper(ctx, rank.charCodeAt(0) * 31 + suit.charCodeAt(0));
    cornerIndex(ctx, rank, suit, color);

    if (rank === 'A') {
      const big = suit === '♠' ? 250 : 200;
      drawSuit(ctx, suit, CW / 2, CH / 2, big, color);
      ctx.save();
      ctx.strokeStyle = GOLD;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CW / 2, CH / 2, 165, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(CW / 2, CH / 2, 176, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (rank === 'J' || rank === 'Q' || rank === 'K') {
      courtArt(ctx, rank, suit, color);
    } else {
      const layout = PIPS[Number(rank)];
      const x0 = 168, x1 = CW - 168, y0 = 132, y1 = CH - 132;
      const size = 92;
      for (const [nx, ny, flip] of layout) {
        drawSuit(ctx, suit, x0 + nx * (x1 - x0), y0 + ny * (y1 - y0), size, color, !!flip);
      }
    }
    return toTex(c);
  });
}

export function cardBackTexture() {
  return remember('back', () => {
    const [c, ctx] = canvas(CW, CH);
    const base = ctx.createLinearGradient(0, 0, CW, CH);
    base.addColorStop(0, '#5a0f1f');
    base.addColorStop(0.5, '#7a1528');
    base.addColorStop(1, '#4a0b18');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, CW, CH);

    // gold lattice
    ctx.save();
    ctx.beginPath();
    ctx.rect(30, 30, CW - 60, CH - 60);
    ctx.clip();
    ctx.strokeStyle = 'rgba(216,180,106,.42)';
    ctx.lineWidth = 1.6;
    for (let i = -CH; i < CW + CH; i += 22) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + CH, CH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, CH);
      ctx.lineTo(i + CH, 0);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(216,180,106,.5)';
    for (let yy = 30; yy < CH; yy += 22) {
      for (let xx = 30 + ((yy / 22) % 2) * 11; xx < CW; xx += 22) {
        ctx.beginPath();
        ctx.arc(xx, yy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    const vig = ctx.createRadialGradient(CW / 2, CH / 2, 60, CW / 2, CH / 2, CH * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CW, CH);

    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, CW - 40, CH - 40);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(32, 32, CW - 64, CH - 64);

    // central medallion
    ctx.save();
    ctx.translate(CW / 2, CH / 2);
    ctx.fillStyle = '#4a0b18';
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -120);
    ctx.lineTo(88, 0);
    ctx.lineTo(0, 120);
    ctx.lineTo(-88, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -102);
    ctx.lineTo(72, 0);
    ctx.lineTo(0, 102);
    ctx.lineTo(-72, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = `700 54px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CL', 0, 4);
    ctx.restore();

    grain(ctx, CW, CH, 3000, 0.04, 99);
    return toTex(c);
  });
}

/* ---------------- chips ---------------- */

export interface ChipLook {
  base: string;
  insert: string;
  ink: string;
}

export const CHIP_LOOKS: Record<number, ChipLook> = {
  5: { base: '#b11d2c', insert: '#f3ead7', ink: '#f3ead7' },
  25: { base: '#17704a', insert: '#f3ead7', ink: '#f3ead7' },
  100: { base: '#1a1c22', insert: '#d8b46a', ink: '#d8b46a' },
  500: { base: '#5b2a86', insert: '#f0d48a', ink: '#f0d48a' },
};

export function chipTopTexture(value: number) {
  return remember(`chipTop:${value}`, () => {
    const S = 256;
    const [c, ctx] = canvas(S, S);
    const look = CHIP_LOOKS[value];
    const cx = S / 2;
    ctx.fillStyle = look.base;
    ctx.fillRect(0, 0, S, S);

    // edge inserts
    ctx.save();
    ctx.translate(cx, cx);
    ctx.fillStyle = look.insert;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * Math.PI * 2);
      ctx.fillRect(-14, -cx, 28, 30);
      ctx.restore();
    }
    ctx.restore();

    // inner ring
    ctx.strokeStyle = look.insert;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cx, 84, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    const inner = ctx.createRadialGradient(cx, cx - 20, 10, cx, cx, 76);
    inner.addColorStop(0, '#f8f2e4');
    inner.addColorStop(1, '#e2d6bc');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cx, 72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = look.base === '#1a1c22' ? '#1a1c22' : look.base;
    ctx.font = `700 ${value >= 100 ? 50 : 60}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), cx, cx + 4);
    grain(ctx, S, S, 900, 0.05, value);
    return toTex(c);
  });
}

export function chipEdgeTexture(value: number) {
  return remember(`chipEdge:${value}`, () => {
    const [c, ctx] = canvas(512, 16);
    const look = CHIP_LOOKS[value];
    ctx.fillStyle = look.base;
    ctx.fillRect(0, 0, 512, 16);
    ctx.fillStyle = look.insert;
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * 512 + 512 / 12 - 15;
      ctx.fillRect(x, 0, 30, 16);
    }
    return toTex(c);
  });
}

/* ---------------- felt ---------------- */

function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  font: string,
  color: string,
  spacing = 1
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const widths = [...text].map((ch) => ctx.measureText(ch).width * spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  // text centered on the lowest point of the arc (angle π/2 on canvas), read from the player's seat
  let angle = Math.PI / 2 + total / radius / 2;
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    angle -= w / radius / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.rotate(angle - Math.PI / 2);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
    angle -= w / radius / 2;
  }
  ctx.restore();
}

/** Felt mapped from world coordinates (x,z) → (u,v). */
export function feltTexture(h17 = false) {
  return remember(`felt-${h17}`, () => {
    const PX = 300; // pixels per world unit
    const W = Math.round(TABLE.feltBox.w * PX);
    const H = Math.round(TABLE.feltBox.h * PX);
    const [c, ctx] = canvas(W, H);
    const toX = (x: number) => (x - TABLE.feltBox.x0) * PX;
    const toY = (z: number) => (z - TABLE.feltBox.z0) * PX;

    const cx = toX(0);
    const cy = toY(TABLE.arcZ);
    const base = ctx.createRadialGradient(cx, toY(0.4), 50, cx, toY(0.4), W * 0.62);
    base.addColorStop(0, '#13644a');
    base.addColorStop(0.6, '#0d4a37');
    base.addColorStop(1, '#073024');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // felt fibers
    const r = rng(42);
    for (let i = 0; i < 120000; i++) {
      const x = r() * W;
      const y = r() * H;
      const a = r() * Math.PI;
      const l = 2 + r() * 5;
      ctx.strokeStyle = r() > 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(120,220,170,.045)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }

    const gold = 'rgba(222,190,118,.82)';
    const goldSoft = 'rgba(222,190,118,.38)';

    // insurance band
    ctx.strokeStyle = goldSoft;
    ctx.lineWidth = 3;
    for (const rr of [TABLE.textArcs.inner - 0.11, TABLE.textArcs.inner + 0.11]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr * PX, Math.PI * 0.22, Math.PI * 0.78);
      ctx.stroke();
    }
    arcText(ctx, h17 ? 'DEALER HITS SOFT 17  ◆  INSURANCE PAYS 2 TO 1' : 'DEALER MUST STAND ON ALL 17  ◆  INSURANCE PAYS 2 TO 1', cx, cy, TABLE.textArcs.inner * PX, `600 30px ${SERIF}`, gold, 1.1);
    arcText(ctx, 'BLACKJACK PAYS 3 TO 2', cx, cy, TABLE.textArcs.outer * PX, `700 72px ${SERIF}`, gold, 1.18);

    // inner gold border following the rail
    ctx.strokeStyle = goldSoft;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, (TABLE.rx - 0.16) * PX, (TABLE.rz - 0.16) * PX, 0, 0, Math.PI);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, (TABLE.rx - 0.22) * PX, (TABLE.rz - 0.22) * PX, 0, 0, Math.PI);
    ctx.stroke();

    // betting circles
    for (const bx of TABLE.betSpots) {
      const x = toX(bx);
      const y = toY(TABLE.betZ);
      ctx.strokeStyle = gold;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, 0.27 * PX, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = goldSoft;
      ctx.beginPath();
      ctx.arc(x, y, 0.235 * PX, 0, Math.PI * 2);
      ctx.stroke();
    }

    // monogram
    ctx.save();
    ctx.translate(cx, toY(-0.42));
    ctx.strokeStyle = goldSoft;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(34, 0);
    ctx.lineTo(0, 46);
    ctx.lineTo(-34, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = goldSoft;
    ctx.font = `700 34px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CL', 0, 2);
    ctx.restore();

    // edge vignette
    const vig = ctx.createRadialGradient(cx, toY(0.2), W * 0.2, cx, toY(0.2), W * 0.6);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    return toTex(c, { aniso: 16 });
  });
}

/* ---------------- leather and wood ---------------- */

export function leatherBump() {
  return remember('leatherBump', () => {
    const S = 512;
    const [c, ctx] = canvas(S, S);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, S, S);
    const r = rng(11);
    for (let i = 0; i < 9000; i++) {
      const v = Math.floor(90 + r() * 80);
      ctx.fillStyle = `rgba(${v},${v},${v},.5)`;
      ctx.beginPath();
      ctx.arc(r() * S, r() * S, 1 + r() * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTex(c, { srgb: false, repeat: 1 });
  });
}

export function woodTexture() {
  return remember('wood', () => {
    const W = 1024;
    const H = 256;
    const [c, ctx] = canvas(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3b1d10');
    g.addColorStop(0.5, '#4a2614');
    g.addColorStop(1, '#341a0e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const r = rng(5);
    for (let i = 0; i < 260; i++) {
      const y = r() * H;
      const amp = 2 + r() * 6;
      const freq = 0.004 + r() * 0.01;
      const ph = r() * 10;
      ctx.strokeStyle = r() > 0.5 ? `rgba(20,8,3,${0.15 + r() * 0.25})` : `rgba(140,80,40,${0.08 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r() * 1.8;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const yy = y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph) * amp * 0.3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    const t = toTex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
}

/* ---------------- soft glow (bokeh, flash) ---------------- */

export function glowTexture() {
  return remember('glow', () => {
    const S = 128;
    const [c, ctx] = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return toTex(c);
  });
}

export function bokehTexture() {
  return remember('bokeh', () => {
    const S = 128;
    const [c, ctx] = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,.55)');
    g.addColorStop(0.8, 'rgba(255,255,255,.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.fill();
    return toTex(c);
  });
}
