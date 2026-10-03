import type { Settings } from './settings';

export interface DbPathUpdate {
  settings: Settings;
  changed: boolean;
}

export function withDbPath(current: Settings, dbPath: string): DbPathUpdate {
  if (current.dbPath === dbPath) {
    return { settings: current, changed: false };
  }
  return { settings: { ...current, dbPath }, changed: true };
}
