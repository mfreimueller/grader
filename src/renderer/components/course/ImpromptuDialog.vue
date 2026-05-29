<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>Spontane Leistung — {{ student.lastName }}, {{ student.firstName }}</h3>

      <form @submit.prevent="handleSubmit">
        <label>
          Kategorie <span class="required">*</span>
          <select v-model="categoryId" required @change="onCategoryChange">
            <option value="" disabled>— Kategorie wählen —</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.title }}
            </option>
          </select>
        </label>

        <label>
          Titel
          <input v-model="title" type="text" placeholder="Optional, z.B. Wiederholung" />
        </label>

        <template v-if="selectedCat?.gradingType === 'NUMERIC'">
          <label>
            Punkte
            <input v-model.number="score" type="number" min="0" :max="maxPoints" />
          </label>
          <label>
            max. Punkte <span class="required">*</span>
            <input v-model.number="maxPoints" type="number" min="1" required />
          </label>
        </template>

        <template v-else>
          <label>
            Symbol
            <div class="symbol-group">
              <button
                v-for="sym in symbols"
                :key="sym.value"
                :class="['symbol-btn', { active: symbol === sym.value }]"
                type="button"
                @click="symbol = sym.value"
              >
                {{ sym.icon }}
              </button>
            </div>
          </label>
        </template>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Abbrechen</button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? 'Speichert...' : 'Leistung erfassen' }}
          </button>
        </div>
      </form>

      <p v-if="error" class="error-msg">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { StudentDto, AssessmentCategoryDto } from '../../../shared/types';

const props = defineProps<{
  student: StudentDto;
  categories: AssessmentCategoryDto[];
  courseId: string;
  sessionId: string;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const symbols = [
  { value: 'PLUS', icon: '+', label: 'Plus' },
  { value: 'WELLE', icon: '~', label: 'Welle' },
  { value: 'MINUS', icon: '−', label: 'Minus' },
];

const categoryId = ref('');
const title = ref('');
const score = ref<number | null>(null);
const maxPoints = ref<number>(10);
const symbol = ref<string | null>(null);
const submitting = ref(false);
const error = ref('');

const selectedCat = computed(() =>
  props.categories.find(c => c.id === categoryId.value) ?? null,
);

function onCategoryChange(): void {
  if (selectedCat.value?.gradingType === 'NUMERIC') {
    maxPoints.value = 10;
    symbol.value = null;
  } else {
    maxPoints.value = 10;
    score.value = null;
  }
}

async function handleSubmit(): Promise<void> {
  error.value = '';
  if (!categoryId.value) {
    error.value = 'Bitte eine Kategorie wählen.';
    return;
  }
  submitting.value = true;
  try {
    const cat = selectedCat.value;
    const payload: {
      courseId: string; studentId: string; date: string; categoryId: string; sessionId: string;
      title?: string; score?: number; symbol?: string; maxPoints?: number;
    } = {
      courseId: props.courseId,
      studentId: props.student.id,
      date: new Date().toISOString(),
      categoryId: categoryId.value,
      sessionId: props.sessionId,
      title: title.value || undefined,
    };
    if (cat?.gradingType === 'NUMERIC') {
      payload.maxPoints = maxPoints.value;
      if (score.value !== null) payload.score = score.value;
    } else if (symbol.value) {
      payload.symbol = symbol.value;
    }
    const result = await window.grdr.grade.recordImpromptu(payload);
    if (result.ok) {
      emit('saved');
    } else {
      error.value = result.error.message;
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 24px;
  width: 440px;
  max-width: 90vw;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.required {
  color: var(--color-danger);
}

input, select {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
}

input:focus, select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
}

.symbol-group {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.symbol-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, border-color 0.1s;
}

.symbol-btn:hover {
  background: #f3f4f6;
  border-color: var(--color-primary);
}

.symbol-btn.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.error-msg {
  color: var(--color-danger);
  margin-top: 12px;
  font-size: 13px;
}
</style>
