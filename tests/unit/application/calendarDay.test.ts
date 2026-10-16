import { isCalendarDay, localCalendarDay } from '../../../src/application/calendarDay';

describe('calendarDay', () => {
  describe('localCalendarDay', () => {
    it('formats the local calendar day as YYYY-MM-DD', () => {
      expect(localCalendarDay(new Date(2026, 9, 12, 8, 30))).toBe('2026-10-12');
    });

    it('pads month and day', () => {
      expect(localCalendarDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    });

    it('stays on the same day late in the evening and just after midnight', () => {
      expect(localCalendarDay(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
      expect(localCalendarDay(new Date(2027, 0, 1, 0, 0, 1))).toBe('2027-01-01');
    });
  });

  describe('isCalendarDay', () => {
    it.each(['2026-10-12', '2024-02-29', '2000-01-01', '2026-12-31'])('accepts %p', (value) => {
      expect(isCalendarDay(value)).toBe(true);
    });

    it.each([
      '',
      '12.10.2026',
      '2026-1-2',
      '2026-13-01',
      '2026-00-10',
      '2026-02-30',
      '2025-02-29',
      '2026-10-32',
      '2026-10-12T00:00:00.000Z',
      ' 2026-10-12',
      'heute',
    ])('rejects %p', (value) => {
      expect(isCalendarDay(value)).toBe(false);
    });
  });
});
