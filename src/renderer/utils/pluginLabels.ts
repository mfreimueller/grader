import type { PluginInfo, PluginStatus } from '../../shared/plugin-catalog';

const PERMISSION_TEXT: Record<string, string> = {
  'course:read': 'Kurs, Klasse und Namen der Schüler/innen lesen',
  storage: 'Eigene Daten in der Grader-Datenbank speichern',
  'assessment:impromptu': 'Spontane Beurteilungen anlegen und eigene wieder löschen',
  secrets: 'Zugangsdaten (z. B. ein Zugriffstoken) verschlüsselt auf diesem Computer speichern',
};

const STATUS_TEXT: Record<PluginStatus, string> = {
  enabled: 'Aktiv',
  disabled: 'Ausgeschaltet',
  'needs-consent': 'Zustimmung nötig',
  faulty: 'Fehlerhaft',
};

/** What the user agrees to. A permission without a text is shown as such, never silently skipped. */
export function describePermission(permission: string): string {
  return PERMISSION_TEXT[permission] ?? `Unbekannte Berechtigung: ${permission}`;
}

/** One network origin in plain words, e.g. `https://api.github.com` becomes "Verbindet sich mit api.github.com". */
export function describeNetwork(origin: string): string {
  return `Verbindet sich mit ${origin.replace(/^https:\/\//, '')}`;
}

export function statusLabel(status: PluginStatus): string {
  return STATUS_TEXT[status];
}

export function sourceLabel(source: PluginInfo['source']): string {
  return source === 'bundled' ? 'Mitgeliefert' : 'Eigenes Plugin';
}

/**
 * What the on/off button of a plugin does. A user plugin with permissions or network access is not switched on blindly:
 * the user reviews what it may do first (`review`).
 */
export function toggleAction(plugin: PluginInfo): 'enable' | 'disable' | 'review' | 'none' {
  if (plugin.status === 'faulty') return 'none';
  if (plugin.status === 'enabled') return 'disable';
  const asksForAnything = plugin.permissions.length > 0 || plugin.network.length > 0;
  return plugin.source === 'user' && asksForAnything ? 'review' : 'enable';
}
