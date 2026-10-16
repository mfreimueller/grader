import {
  PluginManifest,
  PluginManifestInput,
  SUPPORTED_API_VERSION,
} from '../../../../src/domain/plugin/PluginManifest';

const aManifestInput = (overrides?: Partial<PluginManifestInput>): PluginManifestInput => ({
  id: 'at.example.tool',
  name: 'Tool',
  version: '1.0.0',
  description: 'A tool',
  apiVersion: SUPPORTED_API_VERSION,
  entry: 'index.html',
  launch: ['course'],
  permissions: ['course:read', 'storage'],
  network: [],
  ...overrides,
});

const errorOf = (input: PluginManifestInput): string => {
  const result = PluginManifest.create(input);
  if (result.ok) throw new Error('expected the manifest to be rejected');
  return result.error.message;
};

describe('PluginManifest', () => {
  describe('create', () => {
    it('creates a manifest from valid input', () => {
      const result = PluginManifest.create(aManifestInput());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.id.value).toBe('at.example.tool');
      expect(result.value.name).toBe('Tool');
      expect(result.value.version).toBe('1.0.0');
      expect(result.value.description).toBe('A tool');
      expect(result.value.entry).toBe('index.html');
      expect(result.value.launch).toEqual(['course']);
      expect(result.value.permissions).toEqual(['course:read', 'storage']);
    });

    it('defaults the description to an empty string', () => {
      const input = aManifestInput();
      delete input.description;

      const result = PluginManifest.create(input);

      expect(result.ok && result.value.description).toBe('');
    });

    it('trims the name', () => {
      const result = PluginManifest.create(aManifestInput({ name: '  Tool  ' }));

      expect(result.ok && result.value.name).toBe('Tool');
    });

    it('rejects an empty name', () => {
      expect(errorOf(aManifestInput({ name: '   ' }))).toMatch(/name/i);
    });

    it('rejects an invalid id', () => {
      expect(errorOf(aManifestInput({ id: 'Not Valid' }))).toMatch(/PluginId/);
    });

    it.each(['1', '1.0', 'v1.0.0', '1.0.0.0', 'latest', ''])(
      'rejects the version %p',
      (version) => {
        expect(errorOf(aManifestInput({ version }))).toMatch(/version/i);
      },
    );

    it.each(['1.0.0', '0.12.3', '2.0.0-beta.1'])('accepts the version %p', (version) => {
      expect(PluginManifest.create(aManifestInput({ version })).ok).toBe(true);
    });

    it('rejects an api version newer than the supported one', () => {
      const message = errorOf(aManifestInput({ apiVersion: SUPPORTED_API_VERSION + 1 }));

      expect(message).toMatch(/Grader/);
    });

    it('rejects an older, unknown api version', () => {
      expect(PluginManifest.create(aManifestInput({ apiVersion: 0 })).ok).toBe(false);
    });

    it.each([
      ['an absolute path', '/etc/passwd'],
      ['a parent segment', '../index.html'],
      ['a nested parent segment', 'app/../../index.html'],
      ['a backslash', 'app\\index.html'],
      ['a url', 'https://example.com/index.html'],
      ['a scheme', 'file:index.html'],
      ['an empty path', ''],
      ['a dot segment', './index.html'],
    ])('rejects an entry with %s', (_label, entry) => {
      expect(errorOf(aManifestInput({ entry }))).toMatch(/entry/i);
    });

    it('accepts a nested entry', () => {
      const result = PluginManifest.create(aManifestInput({ entry: 'app/index.html' }));

      expect(result.ok && result.value.entry).toBe('app/index.html');
    });

    it('rejects an empty launch list', () => {
      expect(errorOf(aManifestInput({ launch: [] }))).toMatch(/launch/i);
    });

    it('rejects an unknown launch target', () => {
      expect(errorOf(aManifestInput({ launch: ['course', 'student'] }))).toMatch(/launch/i);
    });

    it('rejects an unknown permission', () => {
      const message = errorOf(aManifestInput({ permissions: ['storage', 'attendance:write'] }));

      expect(message).toMatch(/attendance:write/);
    });

    it('removes duplicate permissions', () => {
      const result = PluginManifest.create(
        aManifestInput({ permissions: ['storage', 'storage', 'course:read'] }),
      );

      expect(result.ok && result.value.permissions).toEqual(['storage', 'course:read']);
    });

    it('accepts a plugin without permissions', () => {
      const result = PluginManifest.create(aManifestInput({ permissions: [] }));

      expect(result.ok && result.value.permissions).toEqual([]);
    });

    describe('network', () => {
      it('defaults to no origins', () => {
        const result = PluginManifest.create(aManifestInput());

        expect(result.ok && result.value.network).toEqual([]);
      });

      it('accepts https origins and exposes them as manifest.network', () => {
        const result = PluginManifest.create(
          aManifestInput({ network: ['https://api.github.com', 'https://example.org:8443'] }),
        );

        expect(result.ok && result.value.network).toEqual(['https://api.github.com', 'https://example.org:8443']);
      });

      it('normalises case, the default port and surrounding blanks', () => {
        const result = PluginManifest.create(
          aManifestInput({ network: [' HTTPS://API.GitHub.com:443 ', 'https://example.org:8443'] }),
        );

        expect(result.ok && result.value.network).toEqual(['https://api.github.com', 'https://example.org:8443']);
      });

      it('removes duplicates after normalising', () => {
        const result = PluginManifest.create(
          aManifestInput({ network: ['https://api.github.com', 'https://API.github.com:443'] }),
        );

        expect(result.ok && result.value.network).toEqual(['https://api.github.com']);
      });

      it('accepts ten origins and rejects eleven', () => {
        const origins = (n: number): string[] => Array.from({ length: n }, (_, i) => `https://host${i}.example.com`);

        expect(PluginManifest.create(aManifestInput({ network: origins(10) })).ok).toBe(true);
        expect(errorOf(aManifestInput({ network: origins(11) }))).toMatch(/at most 10/);
      });

      it.each([
        ['plain http', 'http://example.com'],
        ['a path', 'https://example.com/api'],
        ['a trailing slash', 'https://example.com/'],
        ['a query', 'https://example.com?x=1'],
        ['a wildcard', 'https://*.example.com'],
        ['a wildcard only', '*'],
        ['no scheme', 'example.com'],
        ['an IPv4 literal', 'https://192.168.0.1'],
        ['an IPv6 literal', 'https://[::1]'],
        ['localhost', 'https://localhost'],
        ['a single label host', 'https://intranet'],
        ['user info', 'https://user:pw@example.com'],
        ['a port out of range', 'https://example.com:70000'],
        ['port zero', 'https://example.com:0'],
        ['an empty string', ''],
        ['a websocket', 'wss://example.com'],
      ])('rejects %s', (_label, origin) => {
        expect(errorOf(aManifestInput({ network: [origin] }))).toMatch(/network/i);
      });
    });

    describe('window', () => {
      it('uses default dimensions when none are given', () => {
        const result = PluginManifest.create(aManifestInput());

        expect(result.ok && result.value.window).toEqual({ width: 1000, height: 700 });
      });

      it('keeps dimensions inside the allowed range', () => {
        const result = PluginManifest.create(aManifestInput({ window: { width: 900, height: 600 } }));

        expect(result.ok && result.value.window).toEqual({ width: 900, height: 600 });
      });

      it('clamps dimensions that are too small', () => {
        const result = PluginManifest.create(aManifestInput({ window: { width: 10, height: 10 } }));

        expect(result.ok && result.value.window).toEqual({ width: 400, height: 300 });
      });

      it('clamps dimensions that are too large', () => {
        const result = PluginManifest.create(
          aManifestInput({ window: { width: 99999, height: 99999 } }),
        );

        expect(result.ok && result.value.window).toEqual({ width: 2400, height: 1600 });
      });

      it('rounds fractional dimensions', () => {
        const result = PluginManifest.create(
          aManifestInput({ window: { width: 800.6, height: 600.2 } }),
        );

        expect(result.ok && result.value.window).toEqual({ width: 801, height: 600 });
      });

      it('falls back to the defaults for non-finite dimensions', () => {
        const result = PluginManifest.create(
          aManifestInput({ window: { width: Number.NaN, height: Number.POSITIVE_INFINITY } }),
        );

        expect(result.ok && result.value.window).toEqual({ width: 1000, height: 700 });
      });
    });
  });

  describe('permits', () => {
    it('is true for a declared permission', () => {
      const result = PluginManifest.create(aManifestInput());

      expect(result.ok && result.value.permits('storage')).toBe(true);
    });

    it('is false for a permission the plugin did not declare', () => {
      const result = PluginManifest.create(aManifestInput());

      expect(result.ok && result.value.permits('assessment:impromptu')).toBe(false);
    });
  });
});
