// The Adventkalender: 24 doors in a shuffled layout. A door that was opened keeps what came out of it.
import type { DrawResult } from './draw';
import type { Special, Student } from './types';

export const ADVENT_KEY = 'adventCalendar';
export const DOOR_COUNT = 24;

/** What a door shows. The name or label is copied, so the door stays readable when the student is absent today or the special is gone. */
export type DoorContent =
  | { kind: 'student'; studentId: string; name: string }
  | { kind: 'special'; specialId: string; label: string; color: string };

export interface AdventCalendar {
  /** Layout position to door number: a permutation of 1 to 24. */
  order: number[];
  /** The open doors by number. */
  doors: Record<number, DoorContent>;
}

export type OpenDoorResult =
  | { ok: true; calendar: AdventCalendar }
  | { ok: false; error: 'no-such-door' | 'already-open' };

/** A shuffled calendar (Fisher-Yates, decided by `random`) with all doors closed. */
export function createCalendar(random: () => number): AdventCalendar {
  const order = Array.from({ length: DOOR_COUNT }, (_, i) => i + 1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return { order, doors: {} };
}

/** Reads the stored calendar. Anything unusable gives a fresh one; a single broken door is just dropped. */
export function parseCalendar(stored: unknown, random: () => number): AdventCalendar {
  if (!isRecord(stored) || !isPermutation(stored.order)) return createCalendar(random);
  const doors: Record<number, DoorContent> = {};
  if (isRecord(stored.doors)) {
    for (const [key, value] of Object.entries(stored.doors)) {
      const door = Number(key);
      const content = parseContent(value);
      if (isDoor(door) && content) doors[door] = content;
    }
  }
  return { order: stored.order, doors };
}

/** The calendar with that door open; the given one stays as it is. */
export function openDoor(calendar: AdventCalendar, door: number, content: DoorContent): OpenDoorResult {
  if (!isDoor(door)) return { ok: false, error: 'no-such-door' };
  if (calendar.doors[door]) return { ok: false, error: 'already-open' };
  return { ok: true, calendar: { order: calendar.order, doors: { ...calendar.doors, [door]: content } } };
}

/** A door gives exactly one result, so "spin again" has no place here. */
export function adventSpecials(specials: readonly Special[]): Special[] {
  return specials.filter((s) => s.kind !== 'spin-again');
}

/** What a draw puts behind the door, with the name copied as it is today. */
export function doorContent(result: DrawResult, students: readonly Student[]): DoorContent {
  if (result.kind === 'special') {
    return { kind: 'special', specialId: result.special.id, label: result.special.label, color: result.special.color };
  }
  const student = students.find((s) => s.id === result.studentId);
  const name = student ? `${student.firstName} ${student.lastName}` : result.studentId;
  return { kind: 'student', studentId: result.studentId, name };
}

function isDoor(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= DOOR_COUNT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPermutation(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== DOOR_COUNT) return false;
  const seen = new Set<unknown>(value);
  return seen.size === DOOR_COUNT && value.every((n) => typeof n === 'number' && isDoor(n));
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function parseContent(value: unknown): DoorContent | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'student' && text(value.studentId) && text(value.name)) {
    return { kind: 'student', studentId: value.studentId, name: value.name };
  }
  if (value.kind === 'special' && text(value.specialId) && text(value.label) && isColor(value.color)) {
    return { kind: 'special', specialId: value.specialId, label: value.label, color: value.color };
  }
  return null;
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
