<template>
  <div class="classes-view">
    <div class="toolbar">
      <h2>Klassen</h2>
      <div class="toolbar-actions">
        <button class="btn btn-primary" @click="openCreate">+ Klasse anlegen</button>
        <button class="btn btn-secondary" :disabled="classes.length === 0" @click="showRollover = true">
          Schuljahreswechsel
        </button>
        <button class="btn btn-secondary" :disabled="importingDigigrade" @click="importDigigrade">
          {{ importingDigigrade ? 'Importiere...' : 'digigrade-Import' }}
        </button>
        <button class="btn btn-secondary" @click="importCsv" :disabled="importing">
          {{ importing ? 'Importiere...' : 'CSV importieren' }}
        </button>
      </div>
    </div>

    <p v-if="digigradeError" class="delete-error">{{ digigradeError }}</p>

    <div v-if="loading" class="loading">Lade Klassen...</div>

    <div v-else-if="classes.length === 0" class="empty">
      Noch keine Klassen angelegt.
    </div>

    <div v-else class="grouped-list">
      <div v-for="(group, schoolYear) in grouped" :key="schoolYear" class="year-group">
        <h3 class="year-header">{{ schoolYear }}</h3>
        <div class="class-card" v-for="klasse in group" :key="klasse.id">
          <span class="class-name">{{ klasse.name }}</span>
          <div class="class-actions">
            <button class="btn-icon" title="Bearbeiten" @click="editClass(klasse)">✏️</button>
            <button class="btn-icon btn-danger-icon" title="Löschen" @click="confirmDelete(klasse)">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <ClassFormModal
      v-if="showCreate"
      :class-item="null"
      @close="showCreate = false"
      @saved="onSaved"
    />
    <ClassFormModal
      v-if="showEdit && editingClass"
      :class-item="editingClass"
      @close="showEdit = false"
      @saved="onSaved"
    />

    <SchoolYearRolloverModal
      v-if="showRollover"
      @close="showRollover = false"
      @done="onRolloverDone"
    />

    <CsvFormatDialog
      v-if="showCsvFormat"
      title="CSV importieren"
      :columns="[
        { name: 'Klasse', desc: 'z.B. 4A' },
        { name: 'Schuljahr', desc: 'z.B. 2025/26' },
        { name: 'Nachname', desc: '' },
        { name: 'Vorname', desc: '' },
      ]"
      example="4A;2025/26;Mustermann;Max"
      @confirm="(hasHeader: boolean) => proceedImportCsv(hasHeader)"
      @cancel="cancelCsvImport"
    />

    <Teleport to="body">
      <div v-if="importResult" class="overlay" @click.self="importResult = null">
        <div class="confirm-dialog">
          <h3>CSV-Import abgeschlossen</h3>
          <ul class="import-stats">
            <li><strong>{{ importResult.classesCreated }}</strong> Klassen angelegt</li>
            <li><strong>{{ importResult.studentsCreated }}</strong> Schüler angelegt</li>
            <li><strong>{{ importResult.studentsUpdated }}</strong> Schüler aktualisiert</li>
          </ul>
          <div v-if="importResult.warnings.length > 0" class="import-warnings">
            <h4>Warnungen ({{ importResult.warnings.length }})</h4>
            <ul>
              <li v-for="(w, i) in importResult.warnings" :key="i">{{ w }}</li>
            </ul>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" @click="importResult = null">OK</button>
          </div>
        </div>
      </div>
      <div v-if="digigradeResult" class="overlay" @click.self="digigradeResult = null">
        <div class="confirm-dialog">
          <h3>digigrade-Import abgeschlossen</h3>
          <ul class="import-stats">
            <li><strong>{{ digigradeResult.classes.created }}</strong> Klassen angelegt, {{ digigradeResult.classes.skipped }} vorhanden</li>
            <li><strong>{{ digigradeResult.students.created }}</strong> Schüler angelegt, {{ digigradeResult.students.skipped }} vorhanden</li>
            <li><strong>{{ digigradeResult.courses.created }}</strong> Kurse angelegt, {{ digigradeResult.courses.skipped }} übersprungen</li>
            <li><strong>{{ digigradeResult.sessionsCreated }}</strong> Sitzungen, <strong>{{ digigradeResult.performancesCreated }}</strong> Leistungen</li>
          </ul>
          <div v-if="digigradeResult.warnings.length > 0" class="import-warnings">
            <h4>Warnungen ({{ digigradeResult.warnings.length }})</h4>
            <ul>
              <li v-for="(w, i) in digigradeResult.warnings" :key="i">{{ w }}</li>
            </ul>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" @click="digigradeResult = null">OK</button>
          </div>
        </div>
      </div>
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="confirm-dialog">
          <p>{{ deleting.name }} ({{ deleting.schoolYear }}) wirklich löschen?</p>
          <p v-if="dependents" class="delete-hint">
            Dabei werden {{ dependents.students }} Schüler und {{ dependents.courses }} Kurse
            mit in den Papierkorb verschoben und können dort wiederhergestellt werden.
          </p>
          <p v-if="deleteError" class="delete-error">{{ deleteError }}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="deleting = null">Abbrechen</button>
            <button class="btn btn-danger" @click="doDelete" :disabled="deletingSubmitting">
              {{ deletingSubmitting ? 'Lösche...' : 'Löschen' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { SchoolClassDto, ImportResultDto, DigigradeImportResultDto } from '../../shared/types';
import SchoolYearRolloverModal from '../components/classes/SchoolYearRolloverModal.vue';
import ClassFormModal from '../components/classes/ClassFormModal.vue';
import CsvFormatDialog from '../components/CsvFormatDialog.vue';

const classes = ref<SchoolClassDto[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const showEdit = ref(false);
const editingClass = ref<SchoolClassDto | null>(null);
const deleting = ref<SchoolClassDto | null>(null);
const deleteError = ref('');
const dependents = ref<{ students: number; courses: number } | null>(null);
const deletingSubmitting = ref(false);
const importing = ref(false);
const importResult = ref<ImportResultDto | null>(null);
const showCsvFormat = ref(false);
const showRollover = ref(false);
const importingDigigrade = ref(false);
const digigradeResult = ref<DigigradeImportResultDto | null>(null);
const digigradeError = ref('');

const grouped = computed(() => {
  const groups: Record<string, SchoolClassDto[]> = {};
  for (const c of classes.value) {
    if (!groups[c.schoolYear]) groups[c.schoolYear] = [];
    groups[c.schoolYear].push(c);
  }
  return groups;
});

onMounted(async () => {
  await loadClasses();
  loading.value = false;
});

async function loadClasses(): Promise<void> {
  console.log('load classes');
  classes.value = await window.grdr.class.list();
  console.log('new classes', classes.value);
}

async function importDigigrade(): Promise<void> {
  digigradeError.value = '';
  importingDigigrade.value = true;
  try {
    const outcome = await window.grdr.digigrade.import();
    if (!outcome) return;
    if (outcome.ok) {
      digigradeResult.value = outcome.value;
      await loadClasses();
    } else {
      digigradeError.value = outcome.error.message;
    }
  } finally {
    importingDigigrade.value = false;
  }
}

async function onRolloverDone(): Promise<void> {
  showRollover.value = false;
  await loadClasses();
}

function openCreate(): void {
  showCreate.value = true;
}

function editClass(klasse: SchoolClassDto): void {
  editingClass.value = klasse;
  showEdit.value = true;
}

async function confirmDelete(klasse: SchoolClassDto): Promise<void> {
  deleteError.value = '';
  dependents.value = null;
  deleting.value = klasse;
  const result = await window.grdr.class.dependents(klasse.id);
  if (result.ok) dependents.value = result.value;
}

async function doDelete(): Promise<void> {
  if (!deleting.value) return;
  deleteError.value = '';
  deletingSubmitting.value = true;
  try {
    const result = await window.grdr.class.delete(deleting.value.id);
    if (result.ok) {
      deleting.value = null;
      await loadClasses();
    } else {
      deleteError.value = result.error.message;
    }
  } catch (e: unknown) {
    deleteError.value = (e as Error)?.message || 'Löschen fehlgeschlagen.';
  } finally {
    deletingSubmitting.value = false;
  }
}

function importCsv(): void {
  showCsvFormat.value = true;
}

function cancelCsvImport(): void {
  showCsvFormat.value = false;
}

async function proceedImportCsv(hasHeader: boolean): Promise<void> {
  showCsvFormat.value = false;
  importing.value = true;
  try {
    const result = await window.grdr.student.importCsv(hasHeader);
    if (result.ok) {
      importResult.value = result.value;
      await loadClasses();
    } else {
      importResult.value = {
        classesCreated: 0,
        studentsCreated: 0,
        studentsUpdated: 0,
        warnings: [result.error.message],
      };
    }
  } catch (e: unknown) {
    importResult.value = {
      classesCreated: 0,
      studentsCreated: 0,
      studentsUpdated: 0,
      warnings: [(e as Error)?.message || 'Import fehlgeschlagen'],
    };
  } finally {
    importing.value = false;
  }
}

async function onSaved(): Promise<void> {
  showCreate.value = false;
  showEdit.value = false;
  editingClass.value = null;
  await loadClasses();
}
</script>

<style scoped>
.classes-view {
  max-width: 720px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
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

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-danger {
  background: var(--color-danger);
  color: #fff;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 4px;
}

.btn-icon:hover {
  background: #f3f4f6;
}

.btn-danger-icon:hover {
  background: #fee2e2;
}

.loading, .empty {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 32px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  text-align: center;
}

.grouped-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.year-group {
  background: var(--color-surface);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.year-header {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  padding: 10px 14px;
  background: #f9fafb;
  border-bottom: 1px solid var(--color-border);
  margin: 0;
}

.class-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
}

.class-card:hover {
  background: #f9fafb;
}

.class-name {
  font-weight: 500;
}

.class-actions {
  display: flex;
  gap: 4px;
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
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

.confirm-dialog p {
  margin-bottom: 16px;
  font-size: 15px;
}

.delete-hint {
  font-size: 13px;
  color: var(--color-text-secondary, #666);
  margin-top: 8px;
}

.delete-error {
  color: var(--color-danger);
  font-size: 13px;
}

.import-stats {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}

.import-stats li {
  padding: 4px 0;
  font-size: 14px;
}

.import-warnings {
  background: #fff8e1;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
  max-height: 200px;
  overflow-y: auto;
}

.import-warnings h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #92400e;
}

.import-warnings ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #92400e;
}

.import-warnings li {
  margin-bottom: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
