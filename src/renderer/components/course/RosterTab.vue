<template>
  <div class="roster">
    <p v-if="loading" class="hint">Lade Schüler...</p>
    <p v-else-if="entries.length === 0" class="hint">In dieser Klasse gibt es keine Schüler.</p>

    <template v-else>
      <div class="controls">
        <span class="summary">{{ includedCount }} von {{ entries.length }} Schülern nehmen am Kurs teil</span>
        <button class="btn btn-secondary btn-small" :disabled="busy" @click="setAll(true)">Alle auswählen</button>
        <button class="btn btn-secondary btn-small" :disabled="busy" @click="setAll(false)">Keine auswählen</button>
      </div>
      <p class="hint">
        Nicht ausgewählte Schüler verschwinden aus Beurteilung, Sitzungen, Schülerauswahl und Berichten dieses Kurses.
        Bereits erfasste Leistungen bleiben erhalten und kommen zurück, sobald der Schüler wieder ausgewählt wird.
      </p>
      <p v-if="error" class="error-msg">{{ error }}</p>

      <ul class="roster-list">
        <li v-for="entry in entries" :key="entry.studentId" :class="{ excluded: !entry.included }">
          <label>
            <input
              type="checkbox"
              :checked="entry.included"
              :disabled="busy"
              @change="onToggle(entry, $event.target as HTMLInputElement)"
            />
            <span class="swatch" :style="{ background: entry.color ?? 'transparent' }" aria-hidden="true"></span>
            <span class="name">{{ entry.lastName }} {{ entry.firstName }}</span>
            <span v-if="entry.entryCount > 0" class="entries">{{ entry.entryCount }} Einträge</span>
          </label>
        </li>
      </ul>
    </template>

    <div v-if="confirming" class="overlay" @click.self="cancel">
      <div class="confirm-dialog" role="dialog" aria-modal="true">
        <p>
          <strong>{{ confirming.lastName }} {{ confirming.firstName }}</strong> hat in diesem Kurs
          {{ confirming.entryCount }} Einträge (Leistungen und Noten).
        </p>
        <p class="hint">Die Einträge werden ausgeblendet, aber nicht gelöscht.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="cancel">Abbrechen</button>
          <button class="btn btn-primary" @click="confirmExclude">Aus dem Kurs nehmen</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { CourseDto, CourseRosterEntryDto } from '../../../shared/types';

const props = defineProps<{ course: CourseDto }>();

const entries = ref<CourseRosterEntryDto[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const confirming = ref<CourseRosterEntryDto | null>(null);

const includedCount = computed(() => entries.value.filter((e) => e.included).length);

onMounted(async () => {
  await load();
  loading.value = false;
});

async function load(): Promise<void> {
  const result = await window.grdr.roster.list(props.course.id);
  if (result.ok) {
    entries.value = result.value;
  } else {
    error.value = result.error.message;
  }
}

async function onToggle(entry: CourseRosterEntryDto, checkbox: HTMLInputElement): Promise<void> {
  if (!checkbox.checked && entry.entryCount > 0) {
    // Vue does not re-render an unchanged :checked binding, so put the box back by hand until confirmed.
    checkbox.checked = true;
    confirming.value = entry;
    return;
  }
  await apply(entry.studentId, checkbox.checked);
}

async function apply(studentId: string, included: boolean): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const result = await window.grdr.roster.setIncluded(props.course.id, studentId, included);
    if (!result.ok) error.value = result.error.message;
    await load();
  } finally {
    busy.value = false;
  }
}

async function confirmExclude(): Promise<void> {
  const entry = confirming.value;
  confirming.value = null;
  if (entry) await apply(entry.studentId, false);
}

function cancel(): void {
  confirming.value = null;
}

async function setAll(included: boolean): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const result = await window.grdr.roster.setAll(props.course.id, included);
    if (!result.ok) error.value = result.error.message;
    await load();
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.roster {
  max-width: 560px;
  padding: 4px 0;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.summary {
  font-size: 14px;
  font-weight: 600;
  margin-right: auto;
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

.roster-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.roster-list li {
  border-bottom: 1px solid var(--color-border);
}

.roster-list label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  cursor: pointer;
  font-size: 14px;
}

.excluded .name {
  color: var(--color-text-secondary, #666);
  text-decoration: line-through;
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
}

.entries {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
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
  width: 380px;
  max-width: 90vw;
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
