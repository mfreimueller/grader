import type { Special, Student, WheelItem } from './types';

/** Dark or white text, whichever reads better on the given `#rrggbb` background (WCAG relative luminance). */
export function labelColor(background: string): string {
  const channel = (offset: number): number => {
    const value = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.4 ? '#111827' : '#ffffff';
}

/** Students by last name, with the specials spread evenly between them. */
export function layoutItems(students: readonly Student[], specials: readonly Special[]): WheelItem[] {
  const sorted = [...students].sort(
    (a, b) => a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de'),
  );
  const studentItems: WheelItem[] = sorted.map((s) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName.charAt(0)}.`,
    color: s.color,
    special: false,
    kind: null,
  }));
  const specialItems: WheelItem[] = specials.map((s) => ({ id: s.id, label: s.label, color: s.color, special: true, kind: s.kind }));

  const total = studentItems.length + specialItems.length;
  const specialSlots = new Map<number, WheelItem>();
  specialItems.forEach((item, j) => specialSlots.set(Math.floor(((j + 0.5) * total) / specialItems.length), item));

  const result: WheelItem[] = [];
  let nextStudent = 0;
  for (let slot = 0; slot < total; slot++) {
    result.push(specialSlots.get(slot) ?? studentItems[nextStudent++]!);
  }
  return result;
}
