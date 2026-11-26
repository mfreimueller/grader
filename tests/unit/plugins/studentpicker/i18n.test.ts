import { describeError, t } from '../../../../plugins/studentpicker/src/i18n';

describe('t', () => {
  it('returns the German text', () => {
    expect(t('app.title')).toBe('Zufallsauswahl');
  });

  it('fills in parameters', () => {
    expect(t('result.count', { n: 3 })).toBe('Aufruf Nr. 3');
    expect(t('result.selected', { name: 'Anna Bauer' })).toBe('Anna Bauer wurde ausgewählt');
  });

  it('fills in a parameter that appears more than once', () => {
    expect(t('table.countFor', { name: 'X' })).toBe('Aufrufe für X');
  });

  it('names the Adventkalender the Austrian way and its doors', () => {
    expect(t('skin.advent')).toBe('Adventkalender');
    expect(t('advent.door', { n: 7 })).toBe('Türchen 7');
    expect(t('advent.doorOpen', { n: 7, name: 'Anna Bauer' })).toBe('Türchen 7: Anna Bauer');
    expect(t('advent.hint')).toContain('Türchen anklicken');
  });

  it('shows the key itself for a text that does not exist, so the gap is visible', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
    expect(t('app')).toBe('app'); // a group is not a text
  });

  it('keeps a placeholder it has no value for', () => {
    expect(t('result.count')).toBe('Aufruf Nr. {n}');
  });
});

describe('describeError', () => {
  it.each([
    'PERMISSION_DENIED',
    'NOT_FOUND',
    'VALIDATION',
    'NOT_IN_COURSE',
    'INTERNAL',
  ] as const)('explains %s in German', (code) => {
    const text = describeError({ code, message: 'english detail' });

    expect(text).not.toContain('english detail');
    expect(text).not.toBe(`errors.${code}`);
  });

  it('shows the message of an error it does not know', () => {
    expect(describeError({ code: 'SOMETHING_NEW' as never, message: 'detail' })).toBe('detail');
  });
});
