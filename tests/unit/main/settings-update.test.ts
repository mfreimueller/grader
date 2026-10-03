import { withDbPath } from '../../../src/main/settings-update';

describe('withDbPath', () => {
  it('keeps unrelated settings when the database path is set', () => {
    const result = withDbPath({ mcpEnabled: true, mcpPort: 5000 }, '/data/2026.db');

    expect(result.settings).toEqual({ mcpEnabled: true, mcpPort: 5000, dbPath: '/data/2026.db' });
  });

  it('reports changed when the path differs from the stored one', () => {
    const result = withDbPath({ dbPath: '/data/2025.db' }, '/data/2026.db');

    expect(result.changed).toBe(true);
    expect(result.settings.dbPath).toBe('/data/2026.db');
  });

  it('reports changed when no path was stored before', () => {
    expect(withDbPath({}, '/data/2026.db').changed).toBe(true);
  });

  it('reports unchanged when the path equals the stored one', () => {
    const current = { dbPath: '/data/2026.db', mcpEnabled: true };
    const result = withDbPath(current, '/data/2026.db');

    expect(result.changed).toBe(false);
    expect(result.settings).toEqual(current);
  });

  it('does not mutate the input settings', () => {
    const current = { mcpEnabled: true };
    withDbPath(current, '/data/2026.db');

    expect(current).toEqual({ mcpEnabled: true });
  });
});
