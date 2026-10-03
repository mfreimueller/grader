<template>
  <div class="picker">
    <p v-if="loading" class="hint">Lade Schüler...</p>
    <p v-else-if="students.length === 0" class="hint">
      In dieser Klasse gibt es keine Schüler, die ausgewählt werden können.
    </p>

    <template v-else>
      <div class="controls">
        <button class="btn btn-primary" :disabled="picking || wheelStudents.length === 0" @click="pickRandom">
          {{ picking ? 'Wähle aus...' : 'Zufällig auswählen' }}
        </button>
        <label class="toggle">
          <input v-model="fairMode" type="checkbox" :disabled="picking" />
          Fair-Modus
        </label>
        <button class="btn btn-secondary" :disabled="picking" @click="confirmingReset = true">
          Zähler zurücksetzen
        </button>
      </div>
      <p class="hint">
        Fair-Modus: Es werden nur Schüler mit den wenigsten Aufrufen ausgewählt. Ein Klick auf ein Segment ruft den Schüler direkt auf.
      </p>
      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="layout">
        <StudentWheel
          ref="wheel"
          :students="wheelStudents"
          :disabled="picking"
          aria-label="Schülerauswahl"
          @segment-click="pickStudent"
        />

        <table class="counts">
          <thead>
            <tr>
              <th>Farbe</th>
              <th>Name</th>
              <th>Aufrufe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in students" :key="s.studentId">
              <td>
                <input
                  type="color"
                  :value="s.color ?? '#9ca3af'"
                  :aria-label="`Farbe für ${s.lastName} ${s.firstName}`"
                  @change="changeColor(s, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>{{ s.lastName }} {{ s.firstName }}</td>
              <td>
                <input
                  class="count-input"
                  type="number"
                  min="0"
                  step="1"
                  :value="s.pickCount"
                  :aria-label="`Aufrufe für ${s.lastName} ${s.firstName}`"
                  @change="changeCount(s, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td>
                <button class="btn btn-small btn-secondary" :disabled="picking" @click="pickStudent(s.studentId)">
                  Aufrufen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <PickResultDialog v-if="result" :student="result" :course-id="course.id" @close="result = null" />

    <div v-if="confirmingReset" class="overlay" @click.self="confirmingReset = false">
      <div class="confirm-dialog">
        <p>Alle Aufrufzähler dieses Kurses auf 0 zurücksetzen?</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="confirmingReset = false">Abbrechen</button>
          <button class="btn btn-danger" @click="reset">Zurücksetzen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { CourseDto, RosterEntryDto, StudentPickDto } from '../../../shared/types';
import StudentWheel from './StudentWheel.vue';
import PickResultDialog from './PickResultDialog.vue';

const props = defineProps<{ course: CourseDto }>();

const SPIN_MS = 6000;

const students = ref<RosterEntryDto[]>([]);
const loading = ref(true);
const picking = ref(false);
const error = ref('');
// Session-only on purpose: resets to "fair" whenever the tab is opened again.
const fairMode = ref(true);
const result = ref<StudentPickDto | null>(null);
const confirmingReset = ref(false);
const wheel = ref<InstanceType<typeof StudentWheel> | null>(null);

const wheelStudents = computed(() => students.value.filter((s) => !fairMode.value || s.inFairPool));

onMounted(async () => {
  await load();
  loading.value = false;
});

async function load(): Promise<void> {
  const loaded = await window.grdr.picker.list(props.course.id);
  if (loaded.ok) {
    students.value = loaded.value;
  } else {
    error.value = loaded.error.message;
  }
}

async function pickRandom(): Promise<void> {
  error.value = '';
  picking.value = true;
  try {
    const picked = await window.grdr.picker.pickRandom(props.course.id, fairMode.value);
    if (!picked.ok) {
      error.value = picked.error.message;
      return;
    }
    // The winner is decided up front; the wheel only plays the result back. The roster is refreshed
    // afterwards because a new count can move students in or out of the fair pool shown on the wheel.
    await wheel.value?.spinTo(picked.value.studentId, SPIN_MS);
    await load();
    result.value = picked.value;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Auswahl fehlgeschlagen.';
  } finally {
    picking.value = false;
  }
}

async function pickStudent(studentId: string): Promise<void> {
  error.value = '';
  picking.value = true;
  try {
    const picked = await window.grdr.picker.pickStudent(props.course.id, studentId);
    if (!picked.ok) {
      error.value = picked.error.message;
      return;
    }
    await load();
    result.value = picked.value;
  } finally {
    picking.value = false;
  }
}

async function changeCount(student: RosterEntryDto, raw: string): Promise<void> {
  error.value = '';
  const updated = await window.grdr.picker.setCount(props.course.id, student.studentId, Number(raw));
  if (!updated.ok) error.value = updated.error.message;
  await load();
}

async function changeColor(student: RosterEntryDto, color: string): Promise<void> {
  error.value = '';
  const updated = await window.grdr.student.setColor(student.studentId, color);
  if (!updated.ok) error.value = updated.error.message;
  await load();
}

async function reset(): Promise<void> {
  confirmingReset.value = false;
  error.value = '';
  const done = await window.grdr.picker.reset(props.course.id);
  if (!done.ok) error.value = done.error.message;
  await load();
}
</script>

<style scoped>
.picker {
  padding: 4px 0;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.hint {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  margin: 8px 0 16px;
}

.error-msg {
  color: var(--color-danger);
  font-size: 13px;
  margin-bottom: 12px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
  gap: 24px;
  align-items: start;
}

.counts {
  width: 100%;
  border-collapse: collapse;
}

.counts th,
.counts td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}

.count-input {
  width: 64px;
  padding: 4px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
}

input[type='color'] {
  width: 32px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: none;
  cursor: pointer;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 24px;
  width: 360px;
  max-width: 90vw;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
