import { PluginCatalogService } from '../../../src/application/PluginCatalogService';
import { PluginConsent, PluginConsentStore } from '../../../src/domain/plugin/PluginConsentStore';
import { PluginManifest, PluginManifestInput } from '../../../src/domain/plugin/PluginManifest';
import type { PluginScanner, ScannedPlugin } from '../../../src/domain/plugin/PluginScanner';
import { NotFoundError, ValidationError } from '../../../src/shared/errors';
import type { Result } from '../../../src/domain/shared/Result';

const aManifest = (overrides: Partial<PluginManifestInput> = {}): PluginManifest => {
  const manifest = PluginManifest.create({
    id: 'at.example.tool',
    name: 'Tool',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions: ['course:read', 'storage'],
    network: [],
    ...overrides,
  });
  if (!manifest.ok) throw manifest.error;
  return manifest.value;
};

const okPlugin = (
  source: 'bundled' | 'user',
  overrides: Partial<PluginManifestInput> = {},
  overridesBundled = false,
): ScannedPlugin => ({
  status: 'ok',
  source,
  directory: `/plugins/${overrides.id ?? 'at.example.tool'}`,
  manifest: aManifest(overrides),
  overrides: overridesBundled,
});

const faultyPlugin = (name: string, error: string): ScannedPlugin => ({
  status: 'faulty',
  source: 'user',
  directory: `/plugins/${name}`,
  name,
  error,
});

class FakeConsentStore implements PluginConsentStore {
  readonly entries = new Map<string, PluginConsent>();
  get(pluginId: string): PluginConsent | undefined {
    return this.entries.get(pluginId);
  }
  set(pluginId: string, consent: PluginConsent): void {
    this.entries.set(pluginId, consent);
  }
}

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

describe('PluginCatalogService', () => {
  let scanned: ScannedPlugin[];
  let consent: FakeConsentStore;
  let catalog: PluginCatalogService;

  beforeEach(() => {
    scanned = [];
    consent = new FakeConsentStore();
    const scanner: PluginScanner = { scan: () => Promise.resolve(scanned) };
    catalog = new PluginCatalogService(scanner, consent);
  });

  describe('list', () => {
    it('describes a plugin', async () => {
      scanned = [okPlugin('user', { description: 'Does things', launch: ['course'] }, true)];

      const [info] = await catalog.list();

      expect(info).toEqual({
        id: 'at.example.tool',
        directoryName: 'at.example.tool',
        name: 'Tool',
        version: '1.0.0',
        description: 'Does things',
        source: 'user',
        overrides: true,
        status: 'disabled',
        permissions: ['course:read', 'storage'],
        network: [],
        launch: ['course'],
        error: null,
      });
    });

    it('reports a faulty plugin with its error and without an id', async () => {
      scanned = [faultyPlugin('broken', 'plugin.json not found')];

      const [info] = await catalog.list();

      expect(info).toMatchObject({
        id: null,
        directoryName: 'broken',
        name: 'broken',
        status: 'faulty',
        error: 'plugin.json not found',
        permissions: [],
        launch: [],
      });
    });

    it('sorts the plugins by name', async () => {
      scanned = [
        okPlugin('bundled', { id: 'at.example.c', name: 'charlie' }),
        okPlugin('bundled', { id: 'at.example.a', name: 'Alpha' }),
        okPlugin('bundled', { id: 'at.example.b', name: 'bravo' }),
      ];

      expect((await catalog.list()).map((p) => p.name)).toEqual(['Alpha', 'bravo', 'charlie']);
    });

    describe('status of a bundled plugin', () => {
      it('is enabled without any decision', async () => {
        scanned = [okPlugin('bundled')];

        expect((await catalog.list())[0]?.status).toBe('enabled');
      });

      it('is disabled once the user switched it off', async () => {
        scanned = [okPlugin('bundled')];
        consent.set('at.example.tool', { enabled: false, grantedPermissions: [], grantedNetwork: [] });

        expect((await catalog.list())[0]?.status).toBe('disabled');
      });

      it('stays enabled when an update asks for more permissions', async () => {
        scanned = [okPlugin('bundled', { permissions: ['course:read', 'storage', 'assessment:impromptu'] })];
        consent.set('at.example.tool', { enabled: true, grantedPermissions: ['course:read'], grantedNetwork: [] });

        expect((await catalog.list())[0]?.status).toBe('enabled');
      });
    });

    describe('status of a user plugin', () => {
      it('is disabled until the user enables it', async () => {
        scanned = [okPlugin('user')];

        expect((await catalog.list())[0]?.status).toBe('disabled');
      });

      it('is enabled once the user accepted all its permissions', async () => {
        scanned = [okPlugin('user')];
        consent.set('at.example.tool', { enabled: true, grantedPermissions: ['storage', 'course:read'], grantedNetwork: [] });

        expect((await catalog.list())[0]?.status).toBe('enabled');
      });

      it('is enabled when it needs fewer permissions than were accepted', async () => {
        scanned = [okPlugin('user', { permissions: ['storage'] })];
        consent.set('at.example.tool', { enabled: true, grantedPermissions: ['course:read', 'storage'], grantedNetwork: [] });

        expect((await catalog.list())[0]?.status).toBe('enabled');
      });

      it('needs consent again when an update asks for another permission', async () => {
        scanned = [okPlugin('user', { permissions: ['course:read', 'storage', 'assessment:impromptu'] })];
        consent.set('at.example.tool', { enabled: true, grantedPermissions: ['course:read', 'storage'], grantedNetwork: [] });

        expect((await catalog.list())[0]?.status).toBe('needs-consent');
      });

      it('is enabled when all its network origins were accepted', async () => {
        scanned = [okPlugin('user', { network: ['https://api.github.com'] })];
        consent.set('at.example.tool', {
          enabled: true,
          grantedPermissions: ['storage', 'course:read'],
          grantedNetwork: ['https://api.github.com'],
        });

        expect((await catalog.list())[0]?.status).toBe('enabled');
      });

      it('needs consent again when an update asks for another network origin', async () => {
        scanned = [okPlugin('user', { network: ['https://api.github.com', 'https://example.org'] })];
        consent.set('at.example.tool', {
          enabled: true,
          grantedPermissions: ['storage', 'course:read'],
          grantedNetwork: ['https://api.github.com'],
        });

        expect((await catalog.list())[0]?.status).toBe('needs-consent');
      });

      it('needs consent for a network origin when the settings predate network consent', async () => {
        scanned = [okPlugin('user', { network: ['https://api.github.com'] })];
        consent.set('at.example.tool', { enabled: true, grantedPermissions: ['storage', 'course:read'], grantedNetwork: [] });

        expect((await catalog.list())[0]?.status).toBe('needs-consent');
      });

      it('lists the network origins of a plugin', async () => {
        scanned = [okPlugin('user', { network: ['https://api.github.com'] })];

        expect((await catalog.list())[0]?.network).toEqual(['https://api.github.com']);
      });

      it('is disabled after the user switched it off, whatever was accepted', async () => {
        scanned = [okPlugin('user')];
        consent.set('at.example.tool', { enabled: false, grantedPermissions: ['course:read', 'storage'], grantedNetwork: [] });

        expect((await catalog.list())[0]?.status).toBe('disabled');
      });

      it('starts disabled when it replaces a bundled plugin the user never decided about', async () => {
        scanned = [okPlugin('user', {}, true)];

        expect((await catalog.list())[0]?.status).toBe('disabled');
      });
    });
  });

  describe('setEnabled', () => {
    it('enables a user plugin when the user accepted exactly its permissions', async () => {
      scanned = [okPlugin('user')];

      const info = valueOf(await catalog.setEnabled('at.example.tool', true, ['storage', 'course:read']));

      expect(info.status).toBe('enabled');
      expect(consent.get('at.example.tool')).toEqual({
        enabled: true,
        grantedPermissions: ['course:read', 'storage'],
        grantedNetwork: [],
      });
    });

    it.each([
      ['a permission is missing', ['course:read']],
      ['an extra permission was accepted', ['course:read', 'storage', 'assessment:impromptu']],
      ['nothing was accepted', []],
      ['an unknown permission was accepted', ['course:read', 'storage', 'root']],
    ])('refuses a user plugin when %s, because it may have changed since it was shown', async (_label, accepted) => {
      scanned = [okPlugin('user')];

      const result = await catalog.setEnabled('at.example.tool', true, accepted);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
      expect(consent.get('at.example.tool')).toBeUndefined();
    });

    it('enables a user plugin with network access when the user accepted exactly its origins', async () => {
      scanned = [okPlugin('user', { network: ['https://api.github.com'] })];

      const info = valueOf(
        await catalog.setEnabled('at.example.tool', true, ['storage', 'course:read'], ['https://api.github.com']),
      );

      expect(info.status).toBe('enabled');
      expect(consent.get('at.example.tool')?.grantedNetwork).toEqual(['https://api.github.com']);
    });

    it.each([
      ['an origin is missing', []],
      ['another origin was accepted', ['https://example.org']],
      ['an extra origin was accepted', ['https://api.github.com', 'https://example.org']],
    ])('refuses a user plugin when %s', async (_label, acceptedNetwork) => {
      scanned = [okPlugin('user', { network: ['https://api.github.com'] })];

      const result = await catalog.setEnabled('at.example.tool', true, ['storage', 'course:read'], acceptedNetwork);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
      expect(consent.get('at.example.tool')).toBeUndefined();
    });

    it('remembers the accepted origins when the plugin is disabled', async () => {
      scanned = [okPlugin('user', { network: ['https://api.github.com'] })];
      await catalog.setEnabled('at.example.tool', true, ['storage', 'course:read'], ['https://api.github.com']);

      await catalog.setEnabled('at.example.tool', false, []);

      expect(consent.get('at.example.tool')?.grantedNetwork).toEqual(['https://api.github.com']);
    });

    it('enables a plugin without permissions with an empty acceptance', async () => {
      scanned = [okPlugin('user', { permissions: [] })];

      expect(valueOf(await catalog.setEnabled('at.example.tool', true, [])).status).toBe('enabled');
    });

    it('enables a bundled plugin without asking for acceptance', async () => {
      scanned = [okPlugin('bundled')];
      consent.set('at.example.tool', { enabled: false, grantedPermissions: [], grantedNetwork: [] });

      const info = valueOf(await catalog.setEnabled('at.example.tool', true, []));

      expect(info.status).toBe('enabled');
      expect(consent.get('at.example.tool')?.enabled).toBe(true);
    });

    it('disables a plugin and remembers what was accepted', async () => {
      scanned = [okPlugin('user')];
      await catalog.setEnabled('at.example.tool', true, ['course:read', 'storage']);

      const info = valueOf(await catalog.setEnabled('at.example.tool', false, []));

      expect(info.status).toBe('disabled');
      expect(consent.get('at.example.tool')).toEqual({
        enabled: false,
        grantedPermissions: ['course:read', 'storage'],
        grantedNetwork: [],
      });
    });

    it('disables a bundled plugin', async () => {
      scanned = [okPlugin('bundled')];

      expect(valueOf(await catalog.setEnabled('at.example.tool', false, [])).status).toBe('disabled');
    });

    it.each([
      ['an unknown plugin', 'at.example.unknown'],
      ['a faulty plugin', 'broken'],
    ])('fails for %s', async (_label, id) => {
      scanned = [faultyPlugin('broken', 'x'), okPlugin('user')];

      const result = await catalog.setEnabled(id, true, []);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });
  });

  describe('launchableFor', () => {
    it('lists the enabled plugins that can be launched from a course, sorted by name', async () => {
      scanned = [
        okPlugin('bundled', { id: 'at.example.b', name: 'Beta' }),
        okPlugin('bundled', { id: 'at.example.a', name: 'Alpha' }),
        okPlugin('user', { id: 'at.example.off', name: 'Off' }),
        faultyPlugin('broken', 'x'),
      ];

      const plugins = await catalog.launchableFor('course');

      expect(plugins.map((p) => p.name)).toEqual(['Alpha', 'Beta']);
    });

    it('leaves out plugins that need consent', async () => {
      scanned = [okPlugin('user', { permissions: ['storage', 'course:read'] })];
      consent.set('at.example.tool', { enabled: true, grantedPermissions: ['storage'], grantedNetwork: [] });

      expect(await catalog.launchableFor('course')).toEqual([]);
    });
  });

  describe('resolve', () => {
    it('returns the manifest and folder of an enabled plugin', async () => {
      scanned = [okPlugin('bundled')];

      const resolved = valueOf(await catalog.resolve('at.example.tool'));

      expect(resolved.manifest.id.value).toBe('at.example.tool');
      expect(resolved.directory).toBe('/plugins/at.example.tool');
    });

    describe('grantedNetwork', () => {
      const origins = ['https://api.github.com', 'https://example.org'];

      it('does not resolve while an origin the manifest asks for is not accepted', async () => {
        scanned = [okPlugin('user', { network: origins })];
        consent.set('at.example.tool', {
          enabled: true,
          grantedPermissions: ['storage', 'course:read'],
          grantedNetwork: ['https://api.github.com', 'https://evil.example.net'],
        });

        // example.org is not accepted yet, so the plugin needs consent and does not resolve at all.
        expect((await catalog.resolve('at.example.tool')).ok).toBe(false);
      });

      it('never exceeds the manifest, even if the settings file lists more', async () => {
        scanned = [okPlugin('user', { network: ['https://api.github.com'] })];
        consent.set('at.example.tool', {
          enabled: true,
          grantedPermissions: ['storage', 'course:read'],
          grantedNetwork: ['https://api.github.com', 'https://evil.example.net'],
        });

        expect(valueOf(await catalog.resolve('at.example.tool')).grantedNetwork).toEqual(['https://api.github.com']);
      });

      it('is empty for a plugin without network access', async () => {
        scanned = [okPlugin('bundled')];

        expect(valueOf(await catalog.resolve('at.example.tool')).grantedNetwork).toEqual([]);
      });

      it('is the manifest list for a bundled plugin, which is first-party', async () => {
        scanned = [okPlugin('bundled', { network: origins })];

        expect(valueOf(await catalog.resolve('at.example.tool')).grantedNetwork).toEqual(origins);
      });
    });

    it('fails with NotFoundError for an unknown plugin', async () => {
      const result = await catalog.resolve('at.example.tool');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it.each([
      ['disabled', () => okPlugin('user'), undefined],
      ['waiting for consent', () => okPlugin('user'), { enabled: true, grantedPermissions: ['storage' as const], grantedNetwork: [] }],
    ])('refuses a plugin that is %s', async (_label, plugin, decision) => {
      scanned = [plugin()];
      if (decision) consent.set('at.example.tool', decision);

      const result = await catalog.resolve('at.example.tool');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });
  });
});
