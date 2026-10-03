<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>Schuljahreswechsel</h3>

      <p v-if="loading" class="hint">Lade Klassen...</p>
      <p v-else-if="rows.length === 0" class="hint">Es sind keine Klassen vorhanden.</p>

      <template v-else-if="!confirming">
        <label class="year-field">
          Neues Schuljahr
          <input v-model="targetSchoolYear" type="text" placeholder="z.B. 2026/27" />
        </label>

        <table class="rollover-table">
          <thead>
            <tr>
              <th>Aktuell</th>
              <th>Neuer Name</th>
              <th class="col-drop">Abgänger/in</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" :class="{ dropped: row.drop }">
              <td>{{ row.name }} <span class="year">({{ row.schoolYear }})</span></td>
              <td>
                <input v-model="row.newName" type="text" :disabled="row.drop" :aria-label="`Neuer Name für ${row.name}`" />
              </td>
              <td class="col-drop">
                <input v-model="row.drop" type="checkbox" :aria-label="`${row.name} entfernen`" />
              </td>
            </tr>
          </tbody>
        </table>
        <p class="hint">
          Klassen mit Haken werden samt Schülern und Kursen in den Papierkorb verschoben und können dort wiederhergestellt werden.
        </p>

        <label class="check">
          <input v-model="archiveCourses" type="checkbox" />
          Alle Kurse archivieren (Neustart ohne Kurse und Noten)
        </label>
      </template>

      <template v-else>
        <p>
          <strong>{{ renamedCount }}</strong> Klasse(n) werden in das Schuljahr
          <strong>{{ targetSchoolYear }}</strong> übernommen,
          <strong>{{ droppedCount }}</strong> Klasse(n) werden entfernt.
        </p>
        <p v-if="archiveCourses">Alle verbleibenden Kurse werden archiviert.</p>
        <p class="hint">Diese Änderung wird in einem Schritt durchgeführt.</p>
      </template>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="modal-actions">
        <button class="btn btn-secondary" :disabled="submitting" @click="confirming ? (confirming = false) : $emit('close')">
          {{ confirming ? 'Zurück' : 'Abbrechen' }}
        </button>
        <button
          v-if="!confirming"
          class="btn btn-primary"
          :disabled="rows.length === 0 || !targetSchoolYear.trim()"
          @click="confirming = true"
        >
          Weiter
        </button>
        <button v-else class="btn btn-primary" :disabled="submitting" @click="apply">
          {{ submitting ? 'Wird durchgeführt...' : 'Durchführen' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface Row {
  id: string;
  name: string;
  schoolYear: string;
  newName: string;
  drop: boolean;
}

const emit = defineEmits<{
  close: [];
  done: [];
}>();

const loading = ref(true);
const submitting = ref(false);
const confirming = ref(false);
const error = ref('');
const targetSchoolYear = ref('');
const archiveCourses = ref(true);
const rows = ref<Row[]>([]);

const droppedCount = computed(() => rows.value.filter((r) => r.drop).length);
const renamedCount = computed(() => rows.value.length - droppedCount.value);

onMounted(async () => {
  try {
    const preview = await window.grdr.schoolYear.preview();
    targetSchoolYear.value = preview.targetSchoolYear;
    rows.value = preview.classes.map((c) => ({
      id: c.id,
      name: c.name,
      schoolYear: c.schoolYear,
      newName: c.suggestedName ?? c.name,
      drop: false,
    }));
  } finally {
    loading.value = false;
  }
});

async function apply(): Promise<void> {
  error.value = '';
  submitting.value = true;
  try {
    const result = await window.grdr.schoolYear.rollover({
      targetSchoolYear: targetSchoolYear.value.trim(),
      archiveCourses: archiveCourses.value,
      entries: rows.value.map((r) => ({
        classId: r.id,
        action: r.drop ? { type: 'drop' as const } : { type: 'rename' as const, newName: r.newName },
      })),
    });
    if (!result.ok) {
      error.value = result.error.message;
      confirming.value = false;
      return;
    }
    emit('done');
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Schuljahreswechsel fehlgeschlagen.';
    confirming.value = false;
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
  width: 560px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

h3 {
  margin-bottom: 16px;
  font-size: 18px;
}

.year-field {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
}

input[type='text'] {
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

.rollover-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}

.rollover-table th,
.rollover-table td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}

.rollover-table td input[type='text'] {
  margin-top: 0;
}

.col-drop {
  width: 90px;
  text-align: center !important;
}

.dropped td:not(.col-drop) {
  opacity: 0.5;
  text-decoration: line-through;
}

.year {
  color: var(--color-text-secondary, #666);
  font-size: 12px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
}

.hint {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  margin: 8px 0;
}

.error-msg {
  color: var(--color-danger);
  font-size: 13px;
  margin-top: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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
