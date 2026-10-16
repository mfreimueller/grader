// The confetti that rains when a spin ends on a student, after the Figma frame
// "Course Page — Schülerauswahl Ergebnis (Dialog + Konfetti)": thin rounded strips, a few wider chips and dots.
import { WHEEL_PALETTE } from './wheelGeometry';

export const CONFETTI_COLORS: readonly string[] = [...WHEEL_PALETTE, '#facc15', '#ffffff'];

export type ConfettiShape = 'strip' | 'chip' | 'dot';

export interface ConfettiPiece {
  id: number;
  shape: ConfettiShape;
  /** px */
  width: number;
  /** px */
  height: number;
  color: string;
  /** Start position in percent of the window width. */
  left: number;
  delayMs: number;
  durationMs: number;
  /** Start angle in degrees. */
  rotation: number;
  /** Turns while falling, in degrees; negative turns the other way. */
  spin: number;
  /** Sideways drift while falling, in px. */
  drift: number;
  opacity: number;
}

/** `count` pieces, decided by `random` (Math.random in the app) so the tests can pin them down. */
export function confettiPieces(count: number, random: () => number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, id) => {
    const kind = random();
    const shape: ConfettiShape = kind < 0.6 ? 'strip' : kind < 0.8 ? 'chip' : 'dot';
    const size = random();
    const [width, height] = shape === 'strip' ? [3 + size * 2, 14 + size * 7] : shape === 'chip' ? [13, 6] : [7, 7];
    return {
      id,
      shape,
      width,
      height,
      color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)]!,
      left: random() * 100,
      delayMs: random() * 900,
      durationMs: 2600 + random() * 1600,
      rotation: random() * 360,
      spin: (random() - 0.5) * 1440,
      drift: (random() - 0.5) * 160,
      opacity: 0.85 + random() * 0.15,
    };
  });
}
