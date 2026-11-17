// Pockets of the casino skin's roulette: one per wheel item (same order as the other skins), all equally wide,
// plus a decorative green zero that is never a target. Angles are radians, clockwise from 12 o'clock.
import type { WheelItem } from './types';

export const ZERO_POCKET_ID = '__zero__';
const JITTER_SHARE = 0.3;

export type PocketColor = 'red' | 'black' | 'green';

export interface Pocket {
  id: string;
  label: string;
  /** 1, 2, … for students, 0 for the zero, null for specials. */
  number: number | null;
  color: PocketColor;
  /** Whether the ball may land here. */
  target: boolean;
}

export function roulettePockets(items: readonly WheelItem[]): Pocket[] {
  const pockets: Pocket[] = [{ id: ZERO_POCKET_ID, label: '0', number: 0, color: 'green', target: false }];
  let number = 0;
  for (const item of items) {
    if (item.special) {
      pockets.push({ id: item.id, label: item.label, number: null, color: 'green', target: true });
      continue;
    }
    number += 1;
    pockets.push({ id: item.id, label: item.label, number, color: number % 2 === 1 ? 'red' : 'black', target: true });
  }
  return pockets;
}

/** Where on the wheelhead the ball comes to rest; `jitter` from -0.5 to 0.5 moves it off the pocket centre. */
export function landingAngle(index: number, count: number, jitter: number): number {
  const width = (2 * Math.PI) / count;
  return (index + 0.5) * width + jitter * JITTER_SHARE * width;
}
