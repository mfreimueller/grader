<template>
  <section class="gradeflow-settings" aria-labelledby="gradeflow-settings-label" data-testid="gradeflow-settings">
    <label id="gradeflow-settings-label" class="form-label">Gradeflow</label>
    <p class="hint">Grenzen für einen Bewertungslauf. Wird eine Grenze erreicht, stoppt der Lauf und es wird nichts vorgeschlagen.</p>

    <div class="row">
      <label class="field">
        Max. Kosten pro Lauf (USD)
        <input v-model.number="s.form.maxBudgetUsd" type="number" min="0.1" max="50" step="0.1" data-testid="gradeflow-budget" />
        <span v-if="s.problems.value.maxBudgetUsd" class="error-msg">{{ s.problems.value.maxBudgetUsd }}</span>
      </label>
      <label class="field">
        Max. Dauer (Minuten)
        <input v-model.number="s.form.timeoutMinutes" type="number" min="1" max="120" step="1" data-testid="gradeflow-timeout" />
        <span v-if="s.problems.value.timeoutMinutes" class="error-msg">{{ s.problems.value.timeoutMinutes }}</span>
      </label>
      <button type="button" class="btn btn-secondary" data-testid="gradeflow-settings-save" @click="s.save()">Speichern</button>
    </div>

    <p v-if="s.message.value" class="success-msg">{{ s.message.value }}</p>
    <p v-if="s.error.value" class="error-msg">{{ s.error.value }}</p>
  </section>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useGradeflowSettings } from '../controllers/useGradeflowSettings';

const props = defineProps<{ visible: boolean }>();

const s = useGradeflowSettings(window.grdr.gradeflow);

watch(
  () => props.visible,
  (open) => {
    if (open) void s.load();
  },
  { immediate: true },
);
</script>

<style scoped>
.form-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--color-text); }
.hint { font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px; }
.row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.field input { width: 150px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 14px; background: var(--color-bg); color: var(--color-text); }
.btn { padding: 8px 16px; border-radius: 6px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text); font-size: 14px; cursor: pointer; font-weight: 500; }
.error-msg { color: var(--color-danger); font-size: 12px; }
.success-msg { color: var(--color-success); margin-top: 8px; font-size: 13px; }
</style>
