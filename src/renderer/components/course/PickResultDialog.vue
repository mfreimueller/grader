<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="`${fullName} wurde ausgewählt`">
      <div class="avatar" :style="{ background: student.color ?? 'var(--color-primary)' }">{{ initials }}</div>
      <h3>{{ fullName }}</h3>
      <p class="count">Aufruf Nr. {{ student.pickCount }}</p>

      <p class="label">Mitarbeit eintragen (optional)</p>
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
import type { StudentPickDto } from '../../../shared/types';

const props = defineProps<{ student: StudentPickDto; courseId: string }>();
defineEmits<{ close: [] }>();

const symbols = [
  { value: 'PLUS', icon: '+', label: 'Plus' },
  { value: 'WELLE', icon: '~', label: 'Welle' },
  { value: 'MINUS', icon: '−', label: 'Minus' },
];

const selected = ref<string | null>(null);
const performanceId = ref<string | null>(null);
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
  saving.value = true;
  saved.value = false;
  error.value = '';
  try {
    if (selected.value === symbol && performanceId.value) {
      const removed = await window.grdr.grade.deletePerformance(performanceId.value);
      if (!removed.ok) {
        error.value = removed.error.message;
        return;
      }
      selected.value = null;
      performanceId.value = null;
      return;
    }
    const result = await window.grdr.picker.recordMitarbeit({
      courseId: props.courseId,
      studentId: props.student.studentId,
      symbol,
      date: today(),
    });
    if (!result.ok) {
      error.value = result.error.message;
      return;
    }
    selected.value = symbol;
    performanceId.value = result.value.performanceId;
    saved.value = true;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.';
  } finally {
    saving.value = false;
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
  font-size: 13px;
  margin-bottom: 8px;
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
</style>
