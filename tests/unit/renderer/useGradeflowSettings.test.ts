import type { GradeflowResultDto, GradeflowSettingsDto } from '../../../src/shared/gradeflow-api';
import { useGradeflowSettings } from '../../../src/renderer/controllers/useGradeflowSettings';

const ok = <T>(value: T): GradeflowResultDto<T> => ({ ok: true, value });

function setup(stored: GradeflowResultDto<GradeflowSettingsDto> = ok({ maxBudgetUsd: 3, timeoutMinutes: 15 })) {
  const api = {
    getSettings: jest.fn().mockResolvedValue(stored),
    setSettings: jest.fn((s: GradeflowSettingsDto) => Promise.resolve(ok(s))),
  };
  return { api, s: useGradeflowSettings(api) };
}

describe('useGradeflowSettings', () => {
  it('loads the stored limits into the form', async () => {
    const { s } = setup();

    await s.load();

    expect(s.form).toEqual({ maxBudgetUsd: 3, timeoutMinutes: 15 });
    expect(s.message.value).toBe('');
  });

  it('keeps the defaults of the form when the limits cannot be read', async () => {
    const { s } = setup({ ok: false, error: { name: 'InternalError', message: 'x' } });

    await s.load();

    expect(s.form).toEqual({ maxBudgetUsd: 3, timeoutMinutes: 15 });
    expect(s.error.value).toContain('interner Fehler');
  });

  it('saves valid limits as a plain copy and confirms', async () => {
    const { api, s } = setup();
    await s.load();
    s.form.maxBudgetUsd = 10;
    s.form.timeoutMinutes = 30;

    await s.save();

    expect(api.setSettings).toHaveBeenCalledWith({ maxBudgetUsd: 10, timeoutMinutes: 30 });
    expect(() => structuredClone(api.setSettings.mock.calls[0]?.[0])).not.toThrow();
    expect(s.message.value).toBe('Gradeflow-Einstellungen gespeichert.');
  });

  it('does not nag about values before the teacher tried to save', () => {
    const { s } = setup();
    s.form.maxBudgetUsd = 99;

    expect(s.problems.value).toEqual({});
  });

  it('shows what is wrong and does not call the backend', async () => {
    const { api, s } = setup();
    s.form.maxBudgetUsd = 99;

    await s.save();

    expect(api.setSettings).not.toHaveBeenCalled();
    expect(s.problems.value.maxBudgetUsd).toContain('0,1 und 50');
    expect(s.problems.value.timeoutMinutes).toBeUndefined();
  });

  it('shows a refusal of the backend', async () => {
    const { api, s } = setup();
    api.setSettings.mockResolvedValue({ ok: false, error: { name: 'ValidationError', message: 'too much' } });

    await s.save();

    expect(s.error.value).toBe('too much');
    expect(s.message.value).toBe('');
  });
});
