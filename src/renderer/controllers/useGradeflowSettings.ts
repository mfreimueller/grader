// Controller of the Gradeflow section of the settings: the limits of one run.

import { computed, reactive, ref } from 'vue';
import type { GradeflowResultDto, GradeflowSettingsDto } from '../../shared/gradeflow-api';
import { gradeflowErrorMessage } from '../utils/gradeflowErrors';
import { validateGradeflowSettings } from '../utils/gradeflowSetup';
import { plain } from '../utils/plain';

export interface GradeflowSettingsApi {
  getSettings: () => Promise<GradeflowResultDto<GradeflowSettingsDto>>;
  setSettings: (settings: GradeflowSettingsDto) => Promise<GradeflowResultDto<GradeflowSettingsDto>>;
}

export function useGradeflowSettings(api: GradeflowSettingsApi) {
  const form = reactive<GradeflowSettingsDto>({ maxBudgetUsd: 3, timeoutMinutes: 15 });
  const showProblems = ref(false);
  const message = ref('');
  const error = ref('');

  const problems = computed(() => (showProblems.value ? validateGradeflowSettings(form) : {}));

  async function load(): Promise<void> {
    message.value = '';
    error.value = '';
    showProblems.value = false;
    const result = await api.getSettings();
    if (result.ok) Object.assign(form, result.value);
    else error.value = gradeflowErrorMessage(result.error);
  }

  async function save(): Promise<void> {
    message.value = '';
    error.value = '';
    showProblems.value = true;
    if (Object.keys(validateGradeflowSettings(form)).length > 0) return;
    const result = await api.setSettings(plain({ maxBudgetUsd: form.maxBudgetUsd, timeoutMinutes: form.timeoutMinutes }));
    if (result.ok) message.value = 'Gradeflow-Einstellungen gespeichert.';
    else error.value = gradeflowErrorMessage(result.error);
  }

  return { form, problems, message, error, load, save };
}
