import { useJideSettings } from '../../../src/renderer/controllers/useJideSettings';
import type { JideResultDto, JideSettingsDto } from '../../../src/shared/jide-api';

const ok = <T>(value: T): JideResultDto<T> => ({ ok: true, value });
const settings = (patch: Partial<JideSettingsDto> = {}): JideSettingsDto => ({
  baseUrl: 'https://jide.example.at',
  hasKey: true,
  encryptionAvailable: true,
  ...patch,
});

function setup() {
  const api = {
    getSettings: jest.fn().mockResolvedValue(ok(settings())),
    setSettings: jest.fn().mockResolvedValue(ok(settings())),
    clearSettings: jest.fn().mockResolvedValue(ok(settings({ baseUrl: '', hasKey: false }))),
    test: jest.fn().mockResolvedValue(ok({ courseCount: 2 })),
  };
  return { api, s: useJideSettings(api) };
}

describe('useJideSettings', () => {
  it('loads the address, never a key', async () => {
    const { s } = setup();
    await s.load();
    expect(s.form).toEqual({ baseUrl: 'https://jide.example.at', apiKey: '' });
    expect(s.stored.value.hasKey).toBe(true);
  });

  it('tests the values of the form without saving', async () => {
    const { api, s } = setup();
    s.form.baseUrl = ' https://neu.example.at ';
    s.form.apiKey = ' jide_abc ';
    await s.test();
    expect(api.test).toHaveBeenCalledWith({ baseUrl: 'https://neu.example.at', apiKey: 'jide_abc' });
    expect(api.setSettings).not.toHaveBeenCalled();
    expect(s.message.value).toBe('Verbindung steht: 2 Kurse sichtbar.');
  });

  it('says one course in the singular', async () => {
    const { api, s } = setup();
    api.test.mockResolvedValue(ok({ courseCount: 1 }));
    await s.test();
    expect(s.message.value).toBe('Verbindung steht: 1 Kurs sichtbar.');
  });

  it('shows the error of a failed test', async () => {
    const { api, s } = setup();
    api.test.mockResolvedValue({ ok: false, error: { name: 'JideApiError', message: 'J;DE ist nicht erreichbar.' } });
    await s.test();
    expect(s.error.value).toBe('J;DE ist nicht erreichbar.');
    expect(s.message.value).toBe('');
  });

  it('saves and empties the key field afterwards', async () => {
    const { api, s } = setup();
    s.form.baseUrl = 'https://jide.example.at';
    s.form.apiKey = 'jide_abc';
    await s.save();
    expect(api.setSettings).toHaveBeenCalledWith({ baseUrl: 'https://jide.example.at', apiKey: 'jide_abc' });
    expect(s.form.apiKey).toBe('');
    expect(s.message.value).toBe('J;DE-Einstellungen gespeichert.');
  });

  it('removes the connection', async () => {
    const { s } = setup();
    await s.clear();
    expect(s.stored.value.hasKey).toBe(false);
    expect(s.form.baseUrl).toBe('');
    expect(s.message.value).toBe('J;DE-Verbindung entfernt.');
  });

  it('does not stay busy after a failure', async () => {
    const { api, s } = setup();
    api.setSettings.mockResolvedValue({ ok: false, error: { name: 'ValidationError', message: 'x' } });
    await s.save();
    expect(s.busy.value).toBe(false);
  });
});
