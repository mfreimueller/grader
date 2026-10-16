/** A calendar day without a time or time zone, written `YYYY-MM-DD`. These strings compare correctly with `<` and `>`. */

const FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDay(value: string): boolean {
  if (!FORMAT.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  // Rolled-over dates such as 2026-02-30 parse fine but come back as another day.
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The day on the wall clock of the machine, not the UTC day. */
export function localCalendarDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
