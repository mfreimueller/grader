import fs from 'node:fs';
import path from 'node:path';
import { IPC } from '../../../src/shared/ipc-channels';

// A sandboxed preload cannot require src/shared/ipc-channels.ts, so each preload carries its own copy of the
// channel names. These tests keep the copies from drifting away from the real ones.

function inlinedChannels(file: string): Record<string, string> {
  const source = fs.readFileSync(path.join(__dirname, '../../../src/preload', file), 'utf8');
  const block = /const IPC = \{([\s\S]*?)\} as const;/.exec(source);
  if (!block?.[1]) throw new Error(`no IPC block in ${file}`);
  return Object.fromEntries([...block[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
}

const shared: Record<string, string> = IPC;
const names = (prefix: string, exclude?: string): string[] =>
  Object.keys(shared).filter((k) => k.startsWith(prefix) && (!exclude || !k.startsWith(exclude)));

describe('preload channel names', () => {
  describe('preload.ts', () => {
    const inlined = inlinedChannels('preload.ts');

    it('uses the names of the shared constants for every channel it declares', () => {
      for (const [key, value] of Object.entries(inlined)) {
        expect([key, shared[key]]).toEqual([key, value]);
      }
    });

    it('declares every plugin management channel', () => {
      expect(names('PLUGIN_', 'PLUGIN_HOST_').sort()).toEqual(Object.keys(inlined).filter((k) => k.startsWith('PLUGIN_')).sort());
    });

    it('does not carry the bridge channels, which belong to plugin windows only', () => {
      expect(Object.keys(inlined).filter((k) => k.startsWith('PLUGIN_HOST_'))).toEqual([]);
    });
  });

  describe('plugin-preload.ts', () => {
    const inlined = inlinedChannels('plugin-preload.ts');

    it('uses the names of the shared constants for every channel it declares', () => {
      for (const [key, value] of Object.entries(inlined)) {
        expect([key, shared[key]]).toEqual([key, value]);
      }
    });

    it('declares exactly the bridge channels', () => {
      expect(Object.keys(inlined).sort()).toEqual(names('PLUGIN_HOST_').sort());
    });
  });
});
