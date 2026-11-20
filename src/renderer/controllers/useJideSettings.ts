// Controller of the J;DE section of the settings: address and API key, test, save, remove.
// The key is only ever typed into the form; it is never read back from the main process.

import { reactive, ref } from 'vue';
import type { JideResultDto, JideSettingsDto, JideSettingsInput, JideTestResultDto } from '../../shared/jide-api';

export interface JideSettingsApi {
  getSettings: () => Promise<JideResultDto<JideSettingsDto>>;
  setSettings: (input: JideSettingsInput) => Promise<JideResultDto<JideSettingsDto>>;
  clearSettings: () => Promise<JideResultDto<JideSettingsDto>>;
  test: (input: JideSettingsInput) => Promise<JideResultDto<JideTestResultDto>>;
}

export const describeTest = ({ courseCount }: JideTestResultDto): string =>
  courseCount === 1 ? 'Verbindung steht: 1 Kurs sichtbar.' : `Verbindung steht: ${courseCount} Kurse sichtbar.`;

export function useJideSettings(api: JideSettingsApi) {
  const form = reactive({ baseUrl: '', apiKey: '' });
  const stored = ref<JideSettingsDto>({ baseUrl: '', hasKey: false, encryptionAvailable: true });
  const busy = ref(false);
  const message = ref('');
  const error = ref('');

  const input = (): JideSettingsInput => ({ baseUrl: form.baseUrl.trim(), apiKey: form.apiKey.trim() });

  function adopt(settings: JideSettingsDto): void {
    stored.value = settings;
    form.baseUrl = settings.baseUrl;
    form.apiKey = '';
  }

  /** Runs a call that fills `error` on failure; resolves to its value or null. */
  async function guarded<T>(call: () => Promise<JideResultDto<T>>): Promise<T | null> {
    message.value = '';
    error.value = '';
    busy.value = true;
    try {
      const result = await call();
      if (result.ok) return result.value;
      error.value = result.error.message;
      return null;
    } finally {
      busy.value = false;
    }
  }

  async function load(): Promise<void> {
    const settings = await guarded(() => api.getSettings());
    if (settings !== null) adopt(settings);
  }

  async function test(): Promise<void> {
    const result = await guarded(() => api.test(input()));
    if (result !== null) message.value = describeTest(result);
  }

  async function save(): Promise<void> {
    const settings = await guarded(() => api.setSettings(input()));
    if (settings === null) return;
    adopt(settings);
    message.value = 'J;DE-Einstellungen gespeichert.';
  }

  async function clear(): Promise<void> {
    const settings = await guarded(() => api.clearSettings());
    if (settings === null) return;
    adopt(settings);
    message.value = 'J;DE-Verbindung entfernt.';
  }

  return { form, stored, busy, message, error, load, test, save, clear };
}
