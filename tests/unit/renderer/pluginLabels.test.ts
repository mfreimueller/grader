import {
  describeNetwork,
  describePermission,
  sourceLabel,
  statusLabel,
  toggleAction,
} from '../../../src/renderer/utils/pluginLabels';
import type { PluginInfo } from '../../../src/shared/plugin-catalog';

const aPlugin = (overrides: Partial<PluginInfo> = {}): PluginInfo => ({
  id: 'at.example.tool',
  directoryName: 'tool',
  name: 'Tool',
  version: '1.0.0',
  description: '',
  source: 'user',
  overrides: false,
  status: 'disabled',
  permissions: ['storage'],
  network: [],
  launch: ['course'],
  error: null,
  ...overrides,
});

describe('pluginLabels', () => {
  describe('describePermission', () => {
    it.each([
      ['course:read', 'Kurs, Klasse und Namen der Schüler/innen lesen'],
      ['storage', 'Eigene Daten in der Grader-Datenbank speichern'],
      ['assessment:impromptu', 'Spontane Beurteilungen anlegen und eigene wieder löschen'],
      ['secrets', 'Zugangsdaten (z. B. ein Zugriffstoken) verschlüsselt auf diesem Computer speichern'],
    ])('explains %s in plain German', (permission, text) => {
      expect(describePermission(permission)).toBe(text);
    });

    it('does not hide a permission it does not know', () => {
      expect(describePermission('attendance:write')).toBe('Unbekannte Berechtigung: attendance:write');
    });
  });

  describe('describeNetwork', () => {
    it.each([
      ['https://api.github.com', 'Verbindet sich mit api.github.com'],
      ['https://example.org:8443', 'Verbindet sich mit example.org:8443'],
    ])('names the host of %s', (origin, text) => {
      expect(describeNetwork(origin)).toBe(text);
    });

    it('shows an origin it does not understand as it is', () => {
      expect(describeNetwork('ftp://x')).toBe('Verbindet sich mit ftp://x');
    });
  });

  describe('statusLabel', () => {
    it.each([
      ['enabled', 'Aktiv'],
      ['disabled', 'Ausgeschaltet'],
      ['needs-consent', 'Zustimmung nötig'],
      ['faulty', 'Fehlerhaft'],
    ] as const)('names %s', (status, label) => {
      expect(statusLabel(status)).toBe(label);
    });
  });

  describe('sourceLabel', () => {
    it('tells bundled plugins from the user\'s own', () => {
      expect(sourceLabel('bundled')).toBe('Mitgeliefert');
      expect(sourceLabel('user')).toBe('Eigenes Plugin');
    });
  });

  describe('toggleAction', () => {
    it('switches an enabled plugin off', () => {
      expect(toggleAction(aPlugin({ status: 'enabled' }))).toBe('disable');
    });

    it('switches a disabled bundled plugin on without asking', () => {
      expect(toggleAction(aPlugin({ source: 'bundled', status: 'disabled' }))).toBe('enable');
    });

    it('lets the user review the permissions of a user plugin before it is switched on', () => {
      expect(toggleAction(aPlugin({ status: 'disabled' }))).toBe('review');
    });

    it('asks again when an update needs more permissions', () => {
      expect(toggleAction(aPlugin({ status: 'needs-consent' }))).toBe('review');
    });

    it('switches a user plugin without permissions on directly, there is nothing to review', () => {
      expect(toggleAction(aPlugin({ status: 'disabled', permissions: [] }))).toBe('enable');
    });

    it('lets the user review a user plugin that only wants network access', () => {
      const plugin = aPlugin({ status: 'disabled', permissions: [], network: ['https://api.github.com'] });

      expect(toggleAction(plugin)).toBe('review');
    });

    it('offers nothing for a faulty plugin', () => {
      expect(toggleAction(aPlugin({ status: 'faulty', id: null }))).toBe('none');
    });
  });
});
