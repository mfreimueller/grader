<template>
  <FloatingPanel :anchor="anchor" @close="emit('close')">
    <form class="popover" role="dialog" aria-label="Art der Leistung ändern" @submit.prevent="submit">
      <h4>Art ändern</h4>
      <p class="subject">{{ column.title }}</p>

      <label>
        Kategorie
        <select v-model="categoryId" data-autofocus>
          <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.title }}</option>
        </select>
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="actions">
        <button type="button" class="btn btn-secondary" @click="emit('close')">Abbrechen</button>
        <button type="submit" class="btn btn-primary" :disabled="busy">{{ busy ? 'Wird geändert…' : 'Ändern' }}</button>
      </div>
    </form>
  </FloatingPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { AssessmentCategoryDto } from '../../../../shared/types';
import type { GridColumn } from '../../../utils/sessionGridModel';
import type { PanelAnchor } from '../../../utils/panelAnchor';
import FloatingPanel from './FloatingPanel.vue';

const props = defineProps<{
  column: GridColumn;
  /** The categories with the grading type of the column, the current one included. */
  categories: readonly AssessmentCategoryDto[];
  anchor: PanelAnchor;
  error: string;
  busy: boolean;
}>();
const emit = defineEmits<{ submit: [categoryId: string]; close: [] }>();

const categoryId = ref(props.column.categoryId);

function submit(): void {
  emit('submit', categoryId.value);
}
</script>

<style scoped>
.popover {
  width: 280px;
  padding: 14px 16px;
}

h4 {
  margin: 0 0 4px;
  font-size: 13px;
}

.subject {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

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
