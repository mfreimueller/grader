import {
  PLUGIN_PERMISSIONS,
  parsePluginPermission,
} from '../../../../src/domain/plugin/PluginPermission';

describe('PluginPermission', () => {
  describe('parsePluginPermission', () => {
    it('knows the secrets permission', () => {
      expect(PLUGIN_PERMISSIONS).toContain('secrets');
    });

    it('knows the assessment:read permission', () => {
      expect(PLUGIN_PERMISSIONS).toContain('assessment:read');
    });

    it.each([...PLUGIN_PERMISSIONS])('accepts %p', (raw) => {
      const result = parsePluginPermission(raw);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(raw);
    });

    it.each(['', 'storage ', 'Storage', 'attendance:write', 'course:write'])(
      'rejects %p',
      (raw) => {
        expect(parsePluginPermission(raw).ok).toBe(false);
      },
    );
  });
});
