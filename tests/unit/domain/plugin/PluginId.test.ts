import { PluginId } from '../../../../src/domain/plugin/PluginId';

describe('PluginId', () => {
  describe('create', () => {
    it.each([
      'at.mfreimueller.studentpicker',
      'org.example.wheel-2',
      'a.b',
      'com.school1.tool',
    ])('accepts %p', (raw) => {
      const result = PluginId.create(raw);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.value).toBe(raw);
    });

    it.each([
      ['an empty string', ''],
      ['a single segment', 'slotmachine'],
      ['upper case letters', 'At.Example.Tool'],
      ['a leading dot', '.at.example'],
      ['a trailing dot', 'at.example.'],
      ['an empty segment', 'at..example'],
      ['a slash', 'at.example/../x'],
      ['whitespace', 'at.exam ple'],
      ['an underscore', 'at.exam_ple'],
      ['a hyphen at the start of the namespace', '-at.example'],
    ])('rejects %s', (_label, raw) => {
      expect(PluginId.create(raw).ok).toBe(false);
    });

    it('rejects ids longer than 100 characters', () => {
      const raw = `at.${'a'.repeat(98)}`;

      expect(raw.length).toBe(101);
      expect(PluginId.create(raw).ok).toBe(false);
    });

    it('accepts ids of exactly 100 characters', () => {
      const raw = `at.${'a'.repeat(97)}`;

      expect(raw.length).toBe(100);
      expect(PluginId.create(raw).ok).toBe(true);
    });
  });

  describe('equals', () => {
    it('is true for the same id', () => {
      const a = PluginId.create('at.example.tool');
      const b = PluginId.create('at.example.tool');

      expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });
  });
});
