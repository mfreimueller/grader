// State of the casino that lasts as long as the plugin window is open, also across skin changes.
import { shallowRef } from 'vue';
import { EMPTY_SCORE, type Score } from '../core/casino';
import type { Shoe } from '../core/blackjack';

/** Students who won a pass; they are not drawn again in this session. */
export const passed = shallowRef<ReadonlySet<string>>(new Set());
export const score = shallowRef<Score>(EMPTY_SCORE);
/** The shoe stays on the table from hand to hand; null until the first deal. */
export const shoe = shallowRef<Shoe | null>(null);

export function markPassed(studentId: string): void {
  passed.value = new Set([...passed.value, studentId]);
}
