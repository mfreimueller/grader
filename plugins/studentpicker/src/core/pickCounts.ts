import type { Student } from './types';

/** How often each student was picked, by student id. What is stored in the course's key-value storage. */
export type PickCounts = Record<string, number>;

/** Reads the stored value defensively: anything that is not a whole number from 0 is dropped. */
export function parsePickCounts(stored: unknown): PickCounts {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).filter(([, value]) => Number.isInteger(value) && (value as number) >= 0),
  ) as PickCounts;
}

export function incrementCount(counts: PickCounts, studentId: string): PickCounts {
  return { ...counts, [studentId]: (counts[studentId] ?? 0) + 1 };
}

export function setCount(counts: PickCounts, studentId: string, value: number): PickCounts {
  return { ...counts, [studentId]: value };
}

/** What the user typed into a count field: a whole number from 0, or null. */
export function parseCountInput(input: unknown): number | null {
  if (typeof input === 'number') return Number.isInteger(input) && input >= 0 ? input : null;
  if (typeof input === 'string' && /^\s*\d+\s*$/.test(input)) return Number(input.trim());
  return null;
}

export function applyCounts(students: readonly Omit<Student, 'pickCount'>[], counts: PickCounts): Student[] {
  return students.map((student) => ({ ...student, pickCount: counts[student.id] ?? 0 }));
}
