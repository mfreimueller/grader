<template>
  <div class="sessions-tab">
    <div class="section-header">
      <h3>Sitzungen</h3>
      <div class="section-header-actions">
        <button class="btn btn-secondary" @click="handleImportCsv" :disabled="importing">
          {{ importing ? 'Importiere...' : 'Noten importieren (CSV)' }}
        </button>
        <button class="btn btn-primary" @click="showCreate = !showCreate">
          {{ showCreate ? 'Schließen' : '+ Sitzung anlegen' }}
        </button>
      </div>
    </div>

    <div v-if="importResult" class="import-result-panel">
      <div class="import-summary">
        <strong>Import abgeschlossen:</strong>
        {{ importResult.sessionsCreated }} Sitzung(en),
        {{ importResult.assessmentsCreated }} Bewertung(en),
        {{ importResult.performancesCreated }} Note(n) angelegt,
        {{ importResult.performancesUpdated }} Note(n) aktualisiert
      </div>
      <div v-if="importResult.warnings.length > 0" class="import-warnings">
        <div class="warning-count">{{ importResult.warnings.length }} Warnung(en):</div>
        <ul>
          <li v-for="(w, i) in importResult.warnings" :key="i">{{ w }}</li>
        </ul>
      </div>
      <button class="btn btn-text" @click="importResult = null">Schließen</button>
    </div>

    <div v-if="showCreate" class="create-panel">
      <form @submit.prevent="handleCreateSession">
        <div class="form-row">
          <label>
            Datum <span class="required">*</span>
            <input v-model="sessionForm.date" type="date" required />
          </label>
          <label>
            Notizen
            <input v-model="sessionForm.notes" type="text" placeholder="Optional" />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="creating">
            {{ creating ? 'Wird angelegt...' : 'Sitzung anlegen' }}
          </button>
        </div>
      </form>
      <p v-if="sessionError" class="error-msg">{{ sessionError }}</p>
    </div>

    <div v-if="loadingSessions" class="loading">Lade Sitzungen...</div>

    <div v-else-if="sessions.length === 0" class="empty">
      Noch keine Sitzungen angelegt.
    </div>

    <div v-else class="session-list">
      <div
        v-for="session in sessions"
        :key="session.id"
        :class="['session-card', { 'session-card--expanded': expandedId === session.id }]"
      >
        <div class="session-header" @click="toggleExpand(session.id)">
          <div class="session-info">
            <span class="session-date">{{ formatDate(session.date) }}</span>
            <span v-if="session.notes" class="session-notes">{{ session.notes }}</span>
          </div>
          <div class="session-header-actions">
            <button class="btn-icon btn-danger-icon" title="Sitzung löschen" @click.stop="deleteSession(session.id)">🗑️</button>
          </div>
        </div>
        <div v-if="expandedId === session.id" class="session-detail">
          <SessionAssessmentTable
            :course-id="course.id"
            :session-id="session.id"
            :school-class-id="course.schoolClass.id"
            :key="session.id + '-assessments'"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import type { CourseDto, GradeImportResultDto, SessionDto } from '../../shared/types';
import SessionAssessmentTable from './SessionAssessmentTable.vue';

const props = defineProps<{
  course: CourseDto;
}>();

const sessions = ref<SessionDto[]>([]);
const loadingSessions = ref(true);
const expandedId = ref<string | null>(null);
const showCreate = ref(false);
const creating = ref(false);
const sessionError = ref('');

const importing = ref(false);
const importResult = ref<GradeImportResultDto | null>(null);

const sessionForm = reactive({
  date: new Date().toISOString().slice(0, 10),
  notes: '',
});

onMounted(loadSessions);

async function loadSessions(): Promise<void> {
  loadingSessions.value = true;
  try {
    sessions.value = await window.grdr.session.listByCourse(props.course.id);
  } finally {
    loadingSessions.value = false;
  }
}

async function handleImportCsv(): Promise<void> {
  importResult.value = null;
  importing.value = true;
  try {
    const result = await window.grdr.grade.importCsv(props.course.id);
    if (result.ok) {
      importResult.value = result.value;
      await loadSessions();
    } else {
      importResult.value = {
        sessionsCreated: 0,
        assessmentsCreated: 0,
        performancesCreated: 0,
        performancesUpdated: 0,
        warnings: [result.error.message],
      };
    }
  } catch (e) {
    importResult.value = {
      sessionsCreated: 0,
      assessmentsCreated: 0,
      performancesCreated: 0,
      performancesUpdated: 0,
      warnings: [(e as Error).message],
    };
  } finally {
    importing.value = false;
  }
}

async function handleCreateSession(): Promise<void> {
  sessionError.value = '';
  creating.value = true;
  try {
    const result = await window.grdr.session.create({
      courseId: props.course.id,
      date: sessionForm.date,
      notes: sessionForm.notes || undefined,
    });
    if (result.ok) {
      sessionForm.date = new Date().toISOString().slice(0, 10);
      sessionForm.notes = '';
      showCreate.value = false;
      await loadSessions();
    } else {
      sessionError.value = result.error.message;
    }
  } finally {
    creating.value = false;
  }
}

function toggleExpand(id: string): void {
  expandedId.value = expandedId.value === id ? null : id;
}

async function deleteSession(id: string): Promise<void> {
  const result = await window.grdr.session.delete(id);
  if (result.ok) {
    if (expandedId.value === id) expandedId.value = null;
    await loadSessions();
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<style scoped>
.sessions-tab {
  max-width: 960px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header-actions {
  display: flex;
  gap: 8px;
}

.section-header h3 {
  font-size: 16px;
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: #f3f4f6;
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

.create-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.form-row label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.required {
  color: var(--color-danger);
}

input {
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

input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.error-msg {
  color: var(--color-danger);
  margin-top: 8px;
  font-size: 13px;
}

.loading, .empty {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 32px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  text-align: center;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.session-card--expanded {
  border-color: var(--color-primary);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
}

.session-header:hover {
  background: #f9fafb;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.session-date {
  font-weight: 600;
  font-size: 14px;
}

.session-notes {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.session-header-actions {
  display: flex;
  gap: 4px;
}

.session-detail {
  border-top: 1px solid var(--color-border);
  padding: 16px 14px;
  background: #fafbfc;
}

.import-result-panel {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  font-size: 13px;
}

.import-summary {
  margin-bottom: 8px;
}

.import-warnings {
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 8px;
}

.warning-count {
  font-weight: 600;
  margin-bottom: 4px;
}

.import-warnings ul {
  margin: 0;
  padding-left: 20px;
}

.import-warnings li {
  margin-bottom: 2px;
}

.btn-text {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 0;
}

.btn-text:hover {
  text-decoration: underline;
}
</style>
