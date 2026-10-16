import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PluginManifest, PluginManifestInput } from '../../domain/plugin/PluginManifest';
import type { PluginScanner, PluginSource, ScannedPlugin } from '../../domain/plugin/PluginScanner';

const MANIFEST_FILE = 'plugin.json';

const manifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  apiVersion: z.number(),
  entry: z.string(),
  launch: z.array(z.string()),
  permissions: z.array(z.string()).default([]),
  network: z.array(z.string()).default([]),
  window: z.object({ width: z.number(), height: z.number() }).optional(),
});

export interface PluginRoots {
  bundled: string | null;
  user: string | null;
}

type Loaded = { ok: true; manifest: PluginManifest } | { ok: false; error: string };

function isNotFound(error: unknown): boolean {
  // Duck-typed: fs errors do not pass `instanceof Error` inside Jest's vm context.
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

function isInside(parent: string, child: string): boolean {
  return child.startsWith(parent + path.sep);
}

export class FsPluginScanner implements PluginScanner {
  constructor(private readonly roots: PluginRoots) {}

  async scan(): Promise<ScannedPlugin[]> {
    const found = [
      ...(await this.scanRoot(this.roots.bundled, 'bundled')),
      ...(await this.scanRoot(this.roots.user, 'user')),
    ];
    return this.resolveIds(found);
  }

  private async scanRoot(root: string | null, source: PluginSource): Promise<ScannedPlugin[]> {
    if (root === null) return [];

    let names: string[];
    try {
      names = await fs.readdir(root);
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }

    const plugins: ScannedPlugin[] = [];
    for (const name of names.filter((n) => !n.startsWith('.')).sort()) {
      const directory = path.join(root, name);
      if (!(await fs.stat(directory)).isDirectory()) continue;

      const loaded = await this.load(directory);
      plugins.push(
        loaded.ok
          ? { status: 'ok', source, directory, manifest: loaded.manifest, overrides: false }
          : { status: 'faulty', source, directory, name, error: loaded.error },
      );
    }
    return plugins;
  }

  private async load(directory: string): Promise<Loaded> {
    let text: string;
    try {
      text = await fs.readFile(path.join(directory, MANIFEST_FILE), 'utf8');
    } catch (error) {
      if (isNotFound(error)) return { ok: false, error: `${MANIFEST_FILE} not found` };
      throw error;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (error) {
      return { ok: false, error: `${MANIFEST_FILE} is not valid JSON: ${(error as Error).message}` };
    }

    const parsed = manifestSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
      return { ok: false, error: `${MANIFEST_FILE}: ${issues.join('; ')}` };
    }

    const { description, window, ...rest } = parsed.data;
    const input: PluginManifestInput = {
      ...rest,
      ...(description !== undefined ? { description } : {}),
      ...(window !== undefined ? { window } : {}),
    };
    const manifest = PluginManifest.create(input);
    if (!manifest.ok) return { ok: false, error: manifest.error.message };

    const entryError = await this.checkEntry(directory, manifest.value.entry);
    if (entryError !== null) return { ok: false, error: entryError };

    return { ok: true, manifest: manifest.value };
  }

  /** The entry must exist and, after resolving symlinks, still lie inside the plugin folder. */
  private async checkEntry(directory: string, entry: string): Promise<string | null> {
    try {
      const resolved = await fs.realpath(path.join(directory, entry));
      const root = await fs.realpath(directory);
      return isInside(root, resolved) ? null : `Entry file "${entry}" resolves outside of the plugin folder`;
    } catch (error) {
      if (isNotFound(error)) return `Entry file "${entry}" not found`;
      throw error;
    }
  }

  /** A user plugin replaces a bundled one with the same id; any other duplicate is faulty. */
  private resolveIds(found: ScannedPlugin[]): ScannedPlugin[] {
    const result: ScannedPlugin[] = [];
    const indexById = new Map<string, number>();

    for (const plugin of found) {
      if (plugin.status === 'faulty') {
        result.push(plugin);
        continue;
      }

      const id = plugin.manifest.id.value;
      const existingIndex = indexById.get(id);
      const existing = existingIndex === undefined ? undefined : result[existingIndex];

      if (existingIndex === undefined || existing === undefined) {
        indexById.set(id, result.length);
        result.push(plugin);
      } else if (plugin.source === 'user' && existing.source === 'bundled') {
        result[existingIndex] = { ...plugin, overrides: true };
      } else {
        result.push({
          status: 'faulty',
          source: plugin.source,
          directory: plugin.directory,
          name: path.basename(plugin.directory),
          error: `Duplicate plugin id ${id} (already provided by ${existing.directory})`,
        });
      }
    }
    return result;
  }
}
