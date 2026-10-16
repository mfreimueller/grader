import { SettingsPluginConsentStore } from '../../../src/main/plugins/SettingsPluginConsentStore';
import type { Settings } from '../../../src/main/settings';

describe('SettingsPluginConsentStore', () => {
  let settings: Settings;
  let saved: Settings[];
  let store: SettingsPluginConsentStore;

  beforeEach(() => {
    settings = {};
    saved = [];
    store = new SettingsPluginConsentStore(
      () => settings,
      (next) => {
        settings = next;
        saved.push(next);
      },
    );
  });

  describe('get', () => {
    it('returns undefined for a plugin nobody decided about', () => {
      expect(store.get('at.example.tool')).toBeUndefined();
    });

    it('returns what was stored', () => {
      settings = {
        plugins: {
          'at.example.tool': { enabled: true, grantedPermissions: ['storage'], grantedNetwork: ['https://api.github.com'] },
        },
      };

      expect(store.get('at.example.tool')).toEqual({
        enabled: true,
        grantedPermissions: ['storage'],
        grantedNetwork: ['https://api.github.com'],
      });
    });

    it('reads settings written before network consent existed as no granted origins', () => {
      settings = { plugins: { 'at.example.tool': { enabled: true, grantedPermissions: ['storage'] } } };

      expect(store.get('at.example.tool')).toEqual({ enabled: true, grantedPermissions: ['storage'], grantedNetwork: [] });
    });

    it('drops granted origins that are not valid, and normalises the others', () => {
      settings = {
        plugins: {
          'at.example.tool': {
            enabled: true,
            grantedPermissions: [],
            grantedNetwork: ['HTTPS://API.github.com:443', 'http://example.com', '*', 42 as never],
          },
        },
      };

      expect(store.get('at.example.tool')?.grantedNetwork).toEqual(['https://api.github.com']);
    });

    it('treats granted origins that are not a list as none', () => {
      settings = {
        plugins: { 'at.example.tool': { enabled: true, grantedPermissions: [], grantedNetwork: 'https://x.com' as never } },
      };

      expect(store.get('at.example.tool')?.grantedNetwork).toEqual([]);
    });

    it('drops permissions that do not exist, so a hand-edited file cannot grant more than is defined', () => {
      settings = {
        plugins: { 'at.example.tool': { enabled: true, grantedPermissions: ['storage', 'root', 42 as never], grantedNetwork: [] } },
      };

      expect(store.get('at.example.tool')?.grantedPermissions).toEqual(['storage']);
    });

    it.each([
      ['an entry that is not an object', 'yes'],
      ['an entry without enabled', { grantedPermissions: ['storage'], grantedNetwork: [] }],
      ['an enabled that is not a boolean', { enabled: 'true', grantedPermissions: [], grantedNetwork: [] }],
      ['permissions that are not a list', { enabled: true, grantedPermissions: 'storage' }],
    ])('ignores %s', (_label, entry) => {
      settings = { plugins: { 'at.example.tool': entry as never } };

      expect(store.get('at.example.tool')).toBeUndefined();
    });

    it('does not look through the prototype chain', () => {
      expect(store.get('constructor')).toBeUndefined();
      expect(store.get('__proto__')).toBeUndefined();
    });
  });

  describe('set', () => {
    it('stores the decision in the settings', () => {
      store.set('at.example.tool', { enabled: true, grantedPermissions: ['course:read'], grantedNetwork: [] });

      expect(settings.plugins).toEqual({
        'at.example.tool': { enabled: true, grantedPermissions: ['course:read'], grantedNetwork: [] },
      });
      expect(store.get('at.example.tool')).toEqual({ enabled: true, grantedPermissions: ['course:read'], grantedNetwork: [] });
    });

    it('keeps the decisions about other plugins and the other settings', () => {
      settings = {
        dbPath: '/data/grdr.db',
        mcpEnabled: true,
        plugins: { 'at.example.other': { enabled: false, grantedPermissions: [], grantedNetwork: [] } },
      };

      store.set('at.example.tool', { enabled: true, grantedPermissions: [], grantedNetwork: [] });

      expect(settings).toEqual({
        dbPath: '/data/grdr.db',
        mcpEnabled: true,
        plugins: {
          'at.example.other': { enabled: false, grantedPermissions: [], grantedNetwork: [] },
          'at.example.tool': { enabled: true, grantedPermissions: [], grantedNetwork: [] },
        },
      });
    });

    it('replaces an earlier decision about the same plugin', () => {
      store.set('at.example.tool', { enabled: true, grantedPermissions: ['storage'], grantedNetwork: [] });
      store.set('at.example.tool', { enabled: false, grantedPermissions: ['storage'], grantedNetwork: [] });

      expect(store.get('at.example.tool')?.enabled).toBe(false);
    });

    it('writes the settings exactly once', () => {
      store.set('at.example.tool', { enabled: true, grantedPermissions: [], grantedNetwork: [] });

      expect(saved).toHaveLength(1);
    });

    it('does not change the settings object it was given', () => {
      const before: Settings = { plugins: {} };
      settings = before;

      store.set('at.example.tool', { enabled: true, grantedPermissions: [], grantedNetwork: [] });

      expect(before.plugins).toEqual({});
    });
  });
});
