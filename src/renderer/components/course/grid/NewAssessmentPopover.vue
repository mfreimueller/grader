<template>
  <FloatingPanel :anchor="anchor" @close="emit('close')">
    <form class="popover" role="dialog" aria-label="Neue Leistung für alle Schüler" @submit.prevent="submit">
      <h4>Neue Leistung (alle Schüler)</h4>

      <label>
        Titel <span class="required">*</span>
        <input v-model="title" type="text" required data-autofocus autocomplete="off" />
      </label>

      <label>
        Kategorie <span class="required">*</span>
        <select v-model="categoryId" required @change="onCategoryChange">
          <option value="" disabled>— Kategorie wählen —</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.title }}</option>
        </select>
      </label>

      <label v-if="isNumeric">
        max. Punkte <span class="required">*</span>
        <input v-model.number="maxPoints" type="number" min="1" step="1" required />
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">Abbrechen</button>
        <button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? 'Wird angelegt…' : 'Hinzufügen' }}</button>
      </div>
    </form>
  </FloatingPanel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AssessmentCategoryDto } from '../../../../shared/types';
import type { NewAssessmentInput } from '../../../controllers/useSessionGrid';
import type { PanelAnchor } from '../../../utils/panelAnchor';
import FloatingPanel from './FloatingPanel.vue';

const props = defineProps<{ categories: readonly AssessmentCategoryDto[]; anchor: PanelAnchor; error: string; busy: boolean }>();
const emit = defineEmits<{ submit: [input: NewAssessmentInput]; close: [] }>();

const DEFAULT_MAX_POINTS = 10;

const title = ref('');
const categoryId = ref('');
const maxPoints = ref<number>(DEFAULT_MAX_POINTS);

const isNumeric = computed(() => props.categories.find((c) => c.id === categoryId.value)?.gradingType === 'NUMERIC');

function onCategoryChange(): void {
  maxPoints.value = DEFAULT_MAX_POINTS;
}

function submit(): void {
  const input: NewAssessmentInput = { title: title.value.trim(), categoryId: categoryId.value };
  if (isNumeric.value) input.maxPoints = maxPoints.value;
  if (input.title !== '' && input.categoryId !== '') emit('submit', input);
}
</script>

<style scoped>
.popover {
  width: 300px;
  padding: 14px 16px;
}

h4 {
  margin: 0 0 10px;
  font-size: 13px;
}

label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.required {
  color: var(--color-danger);
}

input,
select {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 4px;
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: var(--color-surface);
  font: inherit;
  font-size: 13px;
  color: var(--color-text);
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
}

.error {
  margin: 0 0 8px;
  color: var(--color-danger);
  font-size: 12px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.btn {
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}
</style>
