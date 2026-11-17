<template>
  <div class="overlay" @click.self="emit('close')">
    <form class="dialog editor" style="--dialog-width: 480px" role="dialog" aria-modal="true" :aria-label="t('casino.settingsTitle')" @submit.prevent="save">
      <h2>{{ t('casino.settingsTitle') }}</h2>
      <label>
        {{ t('casino.dealerName') }}
        <input v-model="draft.dealerName" :maxlength="MAX_TEXT_LENGTH" data-testid="casino-dealer-name">
      </label>
      <label>
        {{ t('casino.winText') }}
        <input v-model="draft.winText" :maxlength="MAX_TEXT_LENGTH" data-testid="casino-win-text">
      </label>
      <label>
        {{ t('casino.loseText') }}
        <input v-model="draft.loseText" :maxlength="MAX_TEXT_LENGTH" data-testid="casino-lose-text">
      </label>
      <label>
        {{ t('casino.pushRule') }}
        <select v-model="draft.pushRule" data-testid="casino-push-rule">
          <option v-for="rule in PUSH_RULES" :key="rule" :value="rule">{{ t(`casino.pushRules.${rule}`) }}</option>
        </select>
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="actions">
        <button type="button" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" class="primary" data-testid="casino-settings-save" :disabled="saving">{{ t('casino.save') }}</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { casinoSettingsValid, MAX_TEXT_LENGTH, PUSH_RULES, type CasinoSettings } from '../../core/casino';
import { t } from '../../i18n';

const props = defineProps<{ settings: CasinoSettings; persist: (next: CasinoSettings) => Promise<string | null> }>();
const emit = defineEmits<{ close: [] }>();

const draft = reactive<CasinoSettings>({ ...props.settings });
const error = ref('');
const saving = ref(false);

async function save(): Promise<void> {
  if (!casinoSettingsValid(draft)) {
    error.value = t('casino.textInvalid', { n: MAX_TEXT_LENGTH });
    return;
  }
  saving.value = true;
  const next: CasinoSettings = {
    dealerName: draft.dealerName.trim(),
    winText: draft.winText.trim(),
    loseText: draft.loseText.trim(),
    pushRule: draft.pushRule,
  };
  const problem = await props.persist(next);
  saving.value = false;
  if (problem) error.value = problem;
  else emit('close');
}
</script>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
