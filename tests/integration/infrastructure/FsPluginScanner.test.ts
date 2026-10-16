import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FsPluginScanner } from '../../../src/infrastructure/plugins/FsPluginScanner';
import type { ScannedPlugin } from '../../../src/domain/plugin/PluginScanner';

const validManifest = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'at.example.tool',
  name: 'Tool',
  version: '1.0.0',
  apiVersion: 1,
  entry: 'index.html',
  launch: ['course'],
  permissions: ['course:read'],
  network: [],
  ...overrides,
});

function writePlugin(
  root: string,
  dirName: string,
  manifest: Record<string, unknown> | string | null,
  options: { entryFile?: string | null } = {},
): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  if (manifest !== null) {
    const text = typeof manifest === 'string' ? manifest : JSON.stringify(manifest);
    fs.writeFileSync(path.join(dir, 'plugin.json'), text);
  }
  const entryFile = options.entryFile === undefined ? 'index.html' : options.entryFile;
  if (entryFile !== null) {
    fs.mkdirSync(path.dirname(path.join(dir, entryFile)), { recursive: true });
    fs.writeFileSync(path.join(dir, entryFile), '<html></html>');
  }
  return dir;
}

function faultyOf(plugins: ScannedPlugin[], name: string): Extract<ScannedPlugin, { status: 'faulty' }> {
  const found = plugins.find((p) => p.status === 'faulty' && p.name === name);
  if (!found || found.status !== 'faulty') throw new Error(`no faulty plugin named ${name}`);
  return found;
}

describe('FsPluginScanner', () => {
  let tmp: string;
  let bundledRoot: string;
  let userRoot: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grdr-plugins-'));
    bundledRoot = path.join(tmp, 'bundled');
    userRoot = path.join(tmp, 'user');
    fs.mkdirSync(bundledRoot);
    fs.mkdirSync(userRoot);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const scan = (): Promise<ScannedPlugin[]> =>
    new FsPluginScanner({ bundled: bundledRoot, user: userRoot }).scan();

  describe('valid plugins', () => {
    it('lists a bundled plugin with its manifest and directory', async () => {
      const dir = writePlugin(bundledRoot, 'tool', validManifest());

      const plugins = await scan();

      expect(plugins).toHaveLength(1);
      const plugin = plugins[0];
      expect(plugin?.status).toBe('ok');
      if (plugin?.status !== 'ok') return;
      expect(plugin.source).toBe('bundled');
      expect(plugin.directory).toBe(dir);
      expect(plugin.manifest.id.value).toBe('at.example.tool');
      expect(plugin.overrides).toBe(false);
    });

    it('lists a user plugin', async () => {
      writePlugin(userRoot, 'tool', validManifest());

      const plugins = await scan();

      expect(plugins[0]?.status === 'ok' && plugins[0].source).toBe('user');
    });

    it('accepts an entry inside a sub directory', async () => {
      writePlugin(bundledRoot, 'tool', validManifest({ entry: 'app/index.html' }), {
        entryFile: 'app/index.html',
      });

      const plugins = await scan();

      expect(plugins[0]?.status).toBe('ok');
    });

    it('returns plugins sorted by directory name', async () => {
      writePlugin(bundledRoot, 'b-tool', validManifest({ id: 'at.example.b' }));
      writePlugin(bundledRoot, 'a-tool', validManifest({ id: 'at.example.a' }));

      const plugins = await scan();

      expect(plugins.map((p) => p.status === 'ok' && p.manifest.id.value)).toEqual([
        'at.example.a',
        'at.example.b',
      ]);
    });

    it('ignores plain files and hidden directories in a root', async () => {
      fs.writeFileSync(path.join(bundledRoot, '.DS_Store'), '');
      fs.writeFileSync(path.join(bundledRoot, 'README.md'), '');
      writePlugin(bundledRoot, '.hidden', validManifest({ id: 'at.example.hidden' }));

      expect(await scan()).toEqual([]);
    });
  });

  describe('missing roots', () => {
    it('returns an empty list when a root does not exist', async () => {
      const scanner = new FsPluginScanner({
        bundled: path.join(tmp, 'nope'),
        user: path.join(tmp, 'also-nope'),
      });

      expect(await scanner.scan()).toEqual([]);
    });

    it('returns an empty list when no roots are configured', async () => {
      expect(await new FsPluginScanner({ bundled: null, user: null }).scan()).toEqual([]);
    });
  });

  describe('faulty plugins', () => {
    it('reports a directory without plugin.json', async () => {
      writePlugin(userRoot, 'broken', null);

      const faulty = faultyOf(await scan(), 'broken');

      expect(faulty.error).toMatch(/plugin\.json/);
      expect(faulty.source).toBe('user');
    });

    it('reports plugin.json that is not valid JSON', async () => {
      writePlugin(userRoot, 'broken', '{ not json');

      expect(faultyOf(await scan(), 'broken').error).toMatch(/JSON/);
    });

    it('reports a manifest of the wrong shape', async () => {
      writePlugin(userRoot, 'broken', validManifest({ name: undefined }));

      expect(faultyOf(await scan(), 'broken').error).toMatch(/name/);
    });

    it('reports a manifest that is not an object', async () => {
      writePlugin(userRoot, 'broken', '[1, 2]');

      expect(faultyOf(await scan(), 'broken').status).toBe('faulty');
    });

    it('reports an invalid id', async () => {
      writePlugin(userRoot, 'broken', validManifest({ id: 'Not Valid' }));

      expect(faultyOf(await scan(), 'broken').error).toMatch(/PluginId/);
    });

    it('reports an api version this Grader does not support', async () => {
      writePlugin(userRoot, 'broken', validManifest({ apiVersion: 2 }));

      expect(faultyOf(await scan(), 'broken').error).toMatch(/API version 2/);
    });

    it('reports a network origin that is not allowed', async () => {
      writePlugin(userRoot, 'broken', validManifest({ network: ['http://example.com'] }));

      expect(faultyOf(await scan(), 'broken').error).toMatch(/network/i);
    });

    it('reports an entry that escapes the directory', async () => {
      writePlugin(userRoot, 'broken', validManifest({ entry: '../index.html' }), { entryFile: null });

      expect(faultyOf(await scan(), 'broken').error).toMatch(/entry/i);
    });

    it('reports an entry file that does not exist', async () => {
      writePlugin(userRoot, 'broken', validManifest(), { entryFile: null });

      expect(faultyOf(await scan(), 'broken').error).toMatch(/index\.html/);
    });

    it('reports an entry that leaves the directory through a symlink', async () => {
      const outside = path.join(tmp, 'outside');
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, 'index.html'), 'secret');
      const dir = writePlugin(userRoot, 'broken', validManifest({ entry: 'link/index.html' }), {
        entryFile: null,
      });
      fs.symlinkSync(outside, path.join(dir, 'link'));

      expect(faultyOf(await scan(), 'broken').error).toMatch(/outside/i);
    });

    it('does not let one faulty plugin hide the others', async () => {
      writePlugin(userRoot, 'broken', '{ not json');
      writePlugin(userRoot, 'good', validManifest({ id: 'at.example.good' }));

      const plugins = await scan();

      expect(plugins.map((p) => p.status).sort()).toEqual(['faulty', 'ok']);
    });
  });

  describe('overriding and duplicates', () => {
    it('lets a user plugin override a bundled plugin with the same id', async () => {
      writePlugin(bundledRoot, 'tool', validManifest({ version: '1.0.0' }));
      writePlugin(userRoot, 'tool-newer', validManifest({ version: '2.0.0' }));

      const plugins = await scan();

      expect(plugins).toHaveLength(1);
      const plugin = plugins[0];
      expect(plugin?.status === 'ok' && plugin.source).toBe('user');
      expect(plugin?.status === 'ok' && plugin.manifest.version).toBe('2.0.0');
      expect(plugin?.status === 'ok' && plugin.overrides).toBe(true);
    });

    it('keeps the bundled plugin when the user plugin with the same id is faulty', async () => {
      writePlugin(bundledRoot, 'tool', validManifest());
      writePlugin(userRoot, 'tool-broken', validManifest({ apiVersion: 99 }));

      const plugins = await scan();

      const ok = plugins.filter((p) => p.status === 'ok');
      expect(ok).toHaveLength(1);
      expect(ok[0]?.source).toBe('bundled');
      expect(plugins.filter((p) => p.status === 'faulty')).toHaveLength(1);
    });

    it('reports the second plugin as faulty when two in one root share an id', async () => {
      writePlugin(userRoot, 'a-first', validManifest());
      writePlugin(userRoot, 'b-second', validManifest());

      const plugins = await scan();

      expect(plugins.filter((p) => p.status === 'ok')).toHaveLength(1);
      expect(faultyOf(plugins, 'b-second').error).toMatch(/at\.example\.tool/);
    });
  });
});
