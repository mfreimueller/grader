// Canvas painting of the roulette: the static bowl and the turning wheelhead. Ported from ClassroomCasino's
// js/roulette.js; the wheelhead shows a number per pocket and, unlike a real wheel, the student's name.
import type { Pocket, PocketColor } from '../core/rouletteGeometry';

const TAU = Math.PI * 2;
const COLORS: Record<PocketColor, string> = { red: '#a5141f', black: '#151312', green: '#0c6a3b' };
/** The wheel fills this share of its square canvas, so the drop shadow below it is not cut off at the edge. */
export const WHEEL_FILL = 0.94;
/** Radii as a share of the wheel radius. */
export const RAD = { head: 0.785, numbers: 0.7, pockets: 0.595, turret: 0.18, track: 0.878, pocketBall: 0.648 };

const NUM_FONT = '"Oswald", "Arial Narrow", sans-serif';
const NAME_FONT = '"Instrument Sans", system-ui, sans-serif';

function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ring(c: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  c.beginPath();
  c.arc(cx, cy, outer, 0, TAU);
  c.arc(cx, cy, inner, 0, TAU, true);
  c.closePath();
}

function radial(c: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number, stops: [number, string][]): CanvasGradient {
  const g = c.createRadialGradient(cx, cy, r0, cx, cy, r1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

function grain(c: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, seed: number, lines: number): void {
  const rnd = seeded(seed);
  c.save();
  ring(c, cx, cy, outer, inner);
  c.clip();
  for (let k = 0; k < lines; k++) {
    const r = inner + rnd() * (outer - inner);
    const a0 = rnd() * TAU;
    c.strokeStyle = rnd() < 0.6 ? `rgba(20,6,2,${0.06 + rnd() * 0.12})` : `rgba(255,190,140,${0.03 + rnd() * 0.05})`;
    c.lineWidth = 0.5 + rnd() * 1.2;
    c.beginPath();
    c.arc(cx, cy, r, a0, a0 + 0.3 + rnd() * 2);
    c.stroke();
  }
  c.restore();
}

/** The parts that never move: wooden rim, ball track and diamonds. */
export function paintBowl(c: CanvasRenderingContext2D, size: number, dpr: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = cx * WHEEL_FILL;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, size, size);

  c.save();
  c.shadowColor = 'rgba(0,0,0,0.6)';
  c.shadowBlur = R * 0.06;
  c.shadowOffsetY = R * 0.04;
  c.fillStyle = '#2a1209';
  c.beginPath();
  c.arc(cx, cy, R * 0.985, 0, TAU);
  c.fill();
  c.restore();

  c.fillStyle = radial(c, cx, cy, R * 0.9, R * 0.99, [[0, '#4a200e'], [0.5, '#7e3c1c'], [1, '#3a180a']]);
  ring(c, cx, cy, R * 0.985, R * 0.925);
  c.fill();
  grain(c, cx, cy, R * 0.985, R * 0.925, 7, 110);

  c.strokeStyle = '#b8913f';
  c.lineWidth = Math.max(1.5, R * 0.009);
  c.beginPath();
  c.arc(cx, cy, R * 0.925, 0, TAU);
  c.stroke();

  c.fillStyle = radial(c, cx, cy, R * 0.835, R * 0.921, [[0, '#2a1207'], [0.45, '#5b2911'], [1, '#8e4824']]);
  ring(c, cx, cy, R * 0.921, R * 0.835);
  c.fill();
  c.fillStyle = radial(c, cx, cy, R * 0.79, R * 0.835, [[0, '#160803'], [1, '#3c1a0a']]);
  ring(c, cx, cy, R * 0.835, R * 0.788);
  c.fill();

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const upright = i % 2 === 0;
    const long = R * (upright ? 0.05 : 0.038);
    const short = R * 0.02;
    c.save();
    c.translate(cx + Math.sin(a) * R * 0.812, cy - Math.cos(a) * R * 0.812);
    c.rotate(a + (upright ? 0 : Math.PI / 2));
    const g = c.createLinearGradient(-short, 0, short, 0);
    g.addColorStop(0, '#8d8d8d');
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(1, '#9a9a9a');
    c.fillStyle = g;
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -long / 2);
    c.lineTo(short / 2, 0);
    c.lineTo(0, long / 2);
    c.lineTo(-short / 2, 0);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  c.strokeStyle = 'rgba(0,0,0,0.75)';
  c.lineWidth = R * 0.012;
  c.beginPath();
  c.arc(cx, cy, R * 0.79, 0, TAU);
  c.stroke();
}

/** The wheelhead with pockets, numbers and names; drawn unrotated, the canvas itself is turned. */
export function paintHead(c: CanvasRenderingContext2D, size: number, dpr: number, pockets: readonly Pocket[], highlight: number): void {
  const cx = size / 2;
  const cy = size / 2;
  const R = cx * WHEEL_FILL;
  const r0 = R * RAD.head;
  const r1 = R * RAD.numbers;
  const r2 = R * RAD.pockets;
  const r3 = R * RAD.turret;
  const w = TAU / pockets.length;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, size, size);

  const sector = (ra: number, rb: number, a0: number, a1: number): void => {
    c.beginPath();
    c.arc(cx, cy, ra, a0, a1);
    c.arc(cx, cy, rb, a1, a0, true);
    c.closePath();
  };
  const circle = (r: number, color: string, width: number): void => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.stroke();
  };

  c.fillStyle = '#120c09';
  c.beginPath();
  c.arc(cx, cy, r0, 0, TAU);
  c.fill();

  pockets.forEach((pocket, i) => {
    const a0 = i * w - Math.PI / 2;
    c.fillStyle = COLORS[pocket.color];
    sector(r0, r2, a0, a0 + w + 0.002);
    c.fill();
  });
  c.fillStyle = radial(c, cx, cy, r1, r0, [[0, 'rgba(0,0,0,0.2)'], [0.5, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.25)']]);
  ring(c, cx, cy, r0, r1);
  c.fill();
  c.fillStyle = radial(c, cx, cy, r2, r1, [[0, 'rgba(0,0,0,0.5)'], [0.25, 'rgba(0,0,0,0.1)'], [0.7, 'rgba(0,0,0,0.14)'], [1, 'rgba(0,0,0,0.65)']]);
  ring(c, cx, cy, r1, r2);
  c.fill();

  // The cone: wood veneer, darker than on a real wheel so the names on it stay readable.
  c.fillStyle = radial(c, cx, cy, r3, r2, [[0, '#3a1809'], [0.45, '#5a2a12'], [1, '#43200c']]);
  ring(c, cx, cy, r2, r3);
  c.fill();
  grain(c, cx, cy, r2, r3, 11, 90);

  for (let i = 0; i < pockets.length; i++) {
    const a = i * w - Math.PI / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    c.strokeStyle = '#c9a24a';
    c.lineWidth = Math.max(1, R * 0.0035);
    c.beginPath();
    c.moveTo(cx + cos * r1, cy + sin * r1);
    c.lineTo(cx + cos * r0, cy + sin * r0);
    c.stroke();
    c.strokeStyle = '#6f6f6f';
    c.lineWidth = Math.max(2, R * 0.01);
    c.beginPath();
    c.moveTo(cx + cos * r2, cy + sin * r2);
    c.lineTo(cx + cos * r1, cy + sin * r1);
    c.stroke();
    c.strokeStyle = '#f0f0f0';
    c.lineWidth = Math.max(1, R * 0.004);
    c.stroke();
  }
  circle(r0 - R * 0.004, '#c9a24a', Math.max(1.5, R * 0.008));
  circle(r1, '#cfcfcf', Math.max(1.5, R * 0.006));
  circle(r2, '#9a9a9a', Math.max(2, R * 0.012));
  circle(r2, '#f2f2f2', Math.max(1, R * 0.004));

  if (highlight >= 0) {
    const a0 = highlight * w - Math.PI / 2;
    sector(r0 - R * 0.006, r3 + R * 0.01, a0 + 0.004, a0 + w - 0.004);
    c.strokeStyle = '#f3d98c';
    c.lineWidth = Math.max(2, R * 0.009);
    c.stroke();
  }

  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const numSize = Math.min(R * 0.058, 2 * ((r0 + r1) / 2) * Math.sin(w / 2) * 0.66);
  c.font = `500 ${numSize}px ${NUM_FONT}`;
  c.fillStyle = '#ffffff';
  pockets.forEach((pocket, i) => {
    c.save();
    c.translate(cx, cy);
    c.rotate((i + 0.5) * w);
    c.fillText(pocket.number === null ? '★' : String(pocket.number), 0, -(r0 + r1) / 2);
    c.restore();
  });

  // Names read from the pocket towards the centre, along the radius.
  const nameSize = Math.max(8, Math.min(R * 0.05, 2 * ((r2 + r3) / 2) * Math.sin(w / 2) * 0.7));
  const nameLength = r2 - r3 - R * 0.06;
  c.font = `600 ${nameSize}px ${NAME_FONT}`;
  c.textAlign = 'right';
  pockets.forEach((pocket, i) => {
    if (!pocket.target) return;
    c.save();
    c.translate(cx, cy);
    c.rotate((i + 0.5) * w - Math.PI / 2);
    c.fillStyle = i === highlight ? '#f3d98c' : 'rgba(243,236,221,0.92)';
    c.shadowColor = 'rgba(0,0,0,0.8)';
    c.shadowBlur = 3;
    c.fillText(fit(c, pocket.label, nameLength), r2 - R * 0.025, 0);
    c.restore();
  });

  paintTurret(c, cx, cy, R, r3);
}

function fit(c: CanvasRenderingContext2D, text: string, width: number): string {
  if (c.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && c.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function paintTurret(c: CanvasRenderingContext2D, cx: number, cy: number, R: number, r3: number): void {
  c.fillStyle = radial(c, cx, cy, 0, r3, [[0, '#f2f2f2'], [0.55, '#b5b5b5'], [0.85, '#858585'], [1, '#4a4a4a']]);
  c.beginPath();
  c.arc(cx, cy, r3, 0, TAU);
  c.fill();
  for (let k = 0; k < 4; k++) {
    c.save();
    c.translate(cx, cy);
    c.rotate((k * Math.PI) / 2 + Math.PI / 4);
    const arm = c.createLinearGradient(-R * 0.022, 0, R * 0.022, 0);
    arm.addColorStop(0, '#7f7f7f');
    arm.addColorStop(0.45, '#ffffff');
    arm.addColorStop(1, '#6f6f6f');
    c.fillStyle = arm;
    c.beginPath();
    c.moveTo(-R * 0.024, -R * 0.06);
    c.lineTo(-R * 0.011, -R * 0.16);
    c.lineTo(R * 0.011, -R * 0.16);
    c.lineTo(R * 0.024, -R * 0.06);
    c.closePath();
    c.fill();
    c.restore();
  }
  c.fillStyle = radial(c, cx, cy, 0, R * 0.085, [[0, '#ffffff'], [0.55, '#b0b0b0'], [1, '#565656']]);
  c.beginPath();
  c.arc(cx, cy, R * 0.08, 0, TAU);
  c.fill();
}

export interface BallPaint {
  /** Untilted canvas the ball is painted on, with its size in CSS pixels. */
  width: number;
  height: number;
  /** Wheel centre on that canvas. */
  cx: number;
  cy: number;
  R: number;
  /** Absolute angle, radius share and height above the wheel. */
  abs: number;
  r: number;
  h: number;
  project: (x: number, y: number, h: number) => { x: number; y: number; s: number };
  tiltCos: number;
}

export function paintBall(c: CanvasRenderingContext2D, dpr: number, b: BallPaint): void {
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, b.width, b.height);
  const x = Math.sin(b.abs) * b.r * b.R;
  const y = -Math.cos(b.abs) * b.r * b.R;
  const br = b.R * 0.026;

  const sp = b.project(x + b.h * 0.25, y + b.h * 0.45, 0);
  const sr = br * sp.s * (1.25 + b.h / (b.R * 0.12));
  c.save();
  c.translate(b.cx + sp.x, b.cy + sp.y);
  c.scale(1, b.tiltCos);
  const dark = Math.max(0.12, 0.55 - b.h / (b.R * 0.2));
  c.fillStyle = radial(c, 0, 0, 0, sr, [[0, `rgba(0,0,0,${dark})`], [0.55, `rgba(0,0,0,${dark * 0.45})`], [1, 'rgba(0,0,0,0)']]);
  c.beginPath();
  c.arc(0, 0, sr, 0, TAU);
  c.fill();
  c.restore();

  const p = b.project(x, y, b.h + br);
  const rad = br * p.s;
  const bx = b.cx + p.x;
  const by = b.cy + p.y;
  const g = c.createRadialGradient(bx - rad * 0.35, by - rad * 0.45, rad * 0.05, bx, by, rad);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#eeebe2');
  g.addColorStop(1, '#a29c90');
  c.fillStyle = g;
  c.beginPath();
  c.arc(bx, by, rad, 0, TAU);
  c.fill();
}
