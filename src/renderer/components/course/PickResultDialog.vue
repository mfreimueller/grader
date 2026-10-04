<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="`${fullName} wurde ausgewählt`">
      <div class="avatar" :style="{ background: student.color ?? 'var(--color-primary)' }">{{ initials }}</div>
      <h3>{{ fullName }}</h3>
      <p class="count">Aufruf Nr. {{ student.pickCount }}</p>

      <label class="label" for="pick-category">Spontane Leistung eintragen (optional)</label>
      <select id="pick-category" v-model="categoryId" class="category-select" :disabled="saving" @change="changeCategory">
        <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.title }}</option>
      </select>
      <div class="symbol-group">
        <button
          v-for="sym in symbols"
          :key="sym.value"
          :class="['symbol-btn', { active: selected === sym.value }]"
          :disabled="saving"
          :title="sym.label"
          :aria-pressed="selected === sym.value"
          @click="choose(sym.value)"
        >
          {{ sym.icon }}
        </button>
      </div>
      <p v-if="saved" class="status">Gespeichert.</p>
      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="modal-actions">
        <button class="btn btn-primary" @click="$emit('close')">Schließen</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AssessmentCategoryRefDto, StudentPickDto } from '../../../shared/types';

const props = defineProps<{
  student: StudentPickDto;
  courseId: string;
  /** All categories of the course; only the tertiary ones (+ / ~ / −) can be graded here. */
  assessmentCategories: AssessmentCategoryRefDto[];
}>();
defineEmits<{ close: [] }>();

const symbols = [
  { value: 'PLUS', icon: '+', label: 'Plus' },
  { value: 'WELLE', icon: '~', label: 'Welle' },
  { value: 'MINUS', icon: '−', label: 'Minus' },
];

const categories = computed(() => props.assessmentCategories.filter((c) => c.gradingType === 'TERTIARY'));
const categoryId = ref(
  (categories.value.find((c) => c.title === 'Mitarbeit') ?? categories.value[0])?.id ?? '',
);

const selected = ref<string | null>(null);
// The impromptu assessment created for the current entry; deleting it undoes the entry.
const assessmentId = ref<string | null>(null);
const saving = ref(false);
const saved = ref(false);
const error = ref('');

const fullName = computed(() => `${props.student.firstName} ${props.student.lastName}`);
const initials = computed(
  () => `${props.student.firstName.charAt(0)}${props.student.lastName.charAt(0)}`.toUpperCase(),
);

function today(): string {
  return new Date().toLocaleDateString('sv-SE');
}

// Picking a symbol is optional; clicking the selected one again undoes the entry.
async function choose(symbol: string): Promise<void> {
  if (saving.value) return;
  await run(async () => {
    if (selected.value === symbol) {
      await removeEntry();
      return;
    }
    await replaceEntry(symbol);
  });
}

// Moving an existing entry to another category re-records it there.
async function changeCategory(): Promise<void> {
  if (saving.value || !selected.value) return;
  const symbol = selected.value;
  await run(() => replaceEntry(symbol));
}

async function run(action: () => Promise<void>): Promise<void> {
  saving.value = true;
  saved.value = false;
  error.value = '';
  try {
    await action();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.';
  } finally {
    saving.value = false;
  }
}

async function removeEntry(): Promise<void> {
  if (assessmentId.value) {
    const removed = await window.grdr.assessment.delete(assessmentId.value);
    if (!removed.ok) {
      error.value = removed.error.message;
      return;
    }
  }
  selected.value = null;
  assessmentId.value = null;
}

async function replaceEntry(symbol: string): Promise<void> {
  await removeEntry();
  if (error.value) return;
  const result = await window.grdr.picker.recordMitarbeit({
    courseId: props.courseId,
    studentId: props.student.studentId,
    symbol,
    date: today(),
    categoryId: categoryId.value,
  });
  if (!result.ok) {
    error.value = result.error.message;
    return;
  }
  selected.value = symbol;
  assessmentId.value = result.value.assessmentId;
  saved.value = true;
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
  width: 360px;
  max-width: 90vw;
  text-align: center;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 26px;
  font-weight: 700;
}

h3 {
  font-size: 20px;
  margin-bottom: 4px;
}

.count {
  color: var(--color-text-secondary, #666);
  font-size: 13px;
  margin-bottom: 16px;
}

.label {
  display: block;
  font-size: 13px;
  margin-bottom: 8px;
}

.category-select {
  width: 100%;
  margin-bottom: 12px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
}

.symbol-group {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.symbol-btn {
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}

.symbol-btn:hover {
  border-color: var(--color-primary);
}

.symbol-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.status {
  font-size: 13px;
  margin-top: 8px;
}

.error-msg {
  color: var(--color-danger);
  font-size: 13px;
  margin-top: 8px;
}

.modal-actions {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-danger {
  background: var(--color-danger);
  color: #fff;
}
</style>
