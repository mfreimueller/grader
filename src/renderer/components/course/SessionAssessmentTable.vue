<template>
  <div class="assessment-table">
    <div class="table-toolbar">
      <button class="btn btn-secondary btn-sm" @click="showAddForm = !showAddForm">
        {{ showAddForm ? 'Schließen' : '+ Neue Leistung (alle Schüler)' }}
      </button>
    </div>

    <div v-if="showAddForm" class="add-assessment-form">
      <form @submit.prevent="handleAddAssessment">
        <div class="form-row">
          <label>
            Titel <span class="required">*</span>
            <input v-model="addForm.title" type="text" required />
          </label>
          <label>
            Kategorie <span class="required">*</span>
            <select v-model="addForm.categoryId" required @change="onCategoryChange">
              <option value="" disabled>— Kategorie wählen —</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.title }}
              </option>
            </select>
          </label>
          <label v-if="selectedCategory?.gradingType === 'NUMERIC'">
            max. Punkte <span class="required">*</span>
            <input v-model.number="addForm.maxPoints" type="number" min="1" required />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-sm" :disabled="addingAssessment">
            {{ addingAssessment ? 'Wird angelegt...' : 'Leistung hinzufügen' }}
          </button>
        </div>
      </form>
      <p v-if="addError" class="error-msg">{{ addError }}</p>
    </div>

    <div v-if="loadingData" class="loading-sm">Lade Daten...</div>

    <template v-else-if="students.length === 0">
      <p class="text-secondary">Keine Schüler in dieser Klasse.</p>
    </template>

    <template v-else>
      <div class="perf-table-wrapper">
        <table class="perf-table" v-if="assessments.length > 0">
          <thead>
            <tr>
              <th class="col-student col-student-sortable" @click="sortAscending = !sortAscending">
                Schüler {{ sortAscending ? '▲' : '▼' }}
              </th>
              <th class="col-assessment">Erfasste Leistung</th>
              <th class="col-grade">Beurteilung</th>
              <th class="col-finding">Anmerkung</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="student in sortedStudents" :key="student.id + '-group'">
              <tr
                v-for="(assessment, aIdx) in assessments"
                :key="student.id + '-' + assessment.id"
                :class="{ 'row-impromptu': assessment.isImpromptu }"
              >
                <td v-if="aIdx === 0" :rowspan="assessments.length + 1" class="cell-student">
                  <strong>{{ student.lastName }}, {{ student.firstName }}</strong>
                </td>
                <td>
                  {{ assessment.title }}
                  <span v-if="assessment.isImpromptu" class="badge-impromptu" title="Spontane Leistung">⚡</span>
                </td>
                <td>
                  <div v-if="assessment.maxPoints !== null" class="grade-input">
                    <input
                      type="number"
                      min="0"
                      :max="assessment.maxPoints"
                      :value="getScore(student.id, assessment.id)"
                      @change="recordNumeric(student.id, assessment.id, $event, assessment.maxPoints!)"
                      class="score-input"
                    />
                    <span class="max-points">/ {{ assessment.maxPoints }}</span>
                  </div>
                  <div v-else class="symbol-group">
                    <button
                      v-for="sym in symbols"
                      :key="sym.value"
                      :class="['symbol-btn', { active: getSymbol(student.id, assessment.id) === sym.value }]"
                      @click="recordSymbol(student.id, assessment.id, sym.value)"
                      :title="sym.label"
                    >
                      {{ sym.icon }}
                    </button>
                  </div>
                </td>
                <td>
                  <input
                    type="text"
                    :placeholder="getPlaceholder(student.id, assessment.id)"
                    class="finding-input"
                    @keydown.enter="saveFinding(student.id, assessment.id, $event)"
                  />
                </td>
                <td>
                  <button
                    class="btn-icon btn-danger-icon btn-xs"
                    title="Leistung löschen"
                    @click="removeAssessment(assessment.id)"
                  >
                    ✕
                  </button>
                </td>
              </tr>
              <tr>
                <td colspan="4" class="cell-add-impromptu">
                  <button class="btn-link" @click="openImpromptu(student)">+ Neue Leistung</button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <div v-else class="no-assessments">
          <p class="text-secondary">Keine Leistungen in dieser Sitzung.</p>
        </div>
      </div>
    </template>

    <ImpromptuDialog
      v-if="impromptuStudent"
      :student="impromptuStudent"
      :categories="categories"
      :course-id="courseId"
      @close="impromptuStudent = null"
      @saved="onImpromptuSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import type {
  StudentDto, AssessmentDto, PerformanceDto, AssessmentCategoryDto,
} from '../../../shared/types';
import ImpromptuDialog from './ImpromptuDialog.vue';

const props = defineProps<{
  courseId: string;
  sessionId: string;
  schoolClassId: string;
}>();

const symbols = [
  { value: 'PLUS', icon: '+', label: 'Plus' },
  { value: 'WELLE', icon: '~', label: 'Welle' },
  { value: 'MINUS', icon: '−', label: 'Minus' },
];

const students = ref<StudentDto[]>([]);
const assessments = ref<AssessmentDto[]>([]);
const performances = ref<Map<string, PerformanceDto[]>>(new Map());
const categories = ref<AssessmentCategoryDto[]>([]);
const loadingData = ref(true);
const showAddForm = ref(false);
const addingAssessment = ref(false);
const addError = ref('');
const impromptuStudent = ref<StudentDto | null>(null);
const sortAscending = ref(true);

const sortedStudents = computed(() =>
  [...students.value].sort((a, b) => {
    const cmp = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    return sortAscending.value ? cmp : -cmp;
  }),
);

const addForm = reactive({
  title: '',
  categoryId: '',
  maxPoints: null as number | null,
});

const selectedCategory = computed(() =>
  categories.value.find(c => c.id === addForm.categoryId) ?? null,
);

function getPerf(studentId: string, assessmentId: string): PerformanceDto | undefined {
  return (performances.value.get(assessmentId) ?? []).find(p => p.studentId === studentId);
}

function getScore(studentId: string, assessmentId: string): string {
  const p = getPerf(studentId, assessmentId);
  return p && p?.score !== null ? String(p.score) : '';
}

function getSymbol(studentId: string, assessmentId: string): string | null {
  return getPerf(studentId, assessmentId)?.symbol ?? null;
}

function getPlaceholder(studentId: string, assessmentId: string): string {
  const p = getPerf(studentId, assessmentId);
  return p ? 'Notiz eingeben...' : '—';
}

onMounted(async () => {
  await loadData();
  loadingData.value = false;
});

async function loadData(): Promise<void> {
  const [allStudents, asses, cats] = await Promise.all([
    window.grdr.student.list(props.schoolClassId),
    window.grdr.assessment.listBySession(props.sessionId),
    window.grdr.assessmentCategory.listByCourse(props.courseId),
  ]);
  students.value = allStudents;
  assessments.value = asses;
  categories.value = cats;

  const perfMap = new Map<string, PerformanceDto[]>();
  await Promise.all(
    asses.map(async (a) => {
      const perfs = await window.grdr.grade.getPerformancesByAssessment(a.id);
      perfMap.set(a.id, perfs);
    }),
  );
  performances.value = perfMap;
}

async function refreshAssessments(): Promise<void> {
  const asses = await window.grdr.assessment.listBySession(props.sessionId);
  assessments.value = asses;
  const perfMap = new Map(performances.value);
  await Promise.all(
    asses.map(async (a) => {
      if (!perfMap.has(a.id)) {
        const perfs = await window.grdr.grade.getPerformancesByAssessment(a.id);
        perfMap.set(a.id, perfs);
      }
    }),
  );
  performances.value = perfMap;
}

async function recordNumeric(studentId: string, assessmentId: string, event: Event, maxPoints: number): Promise<void> {
  const input = event.target as HTMLInputElement;
  const score = parseInt(input.value, 10);
  if (isNaN(score) || score < 0 || score > maxPoints) return;
  const result = await window.grdr.grade.recordPerformance({ studentId, assessmentId, score });
  if (result.ok) {
    await refreshPerf(assessmentId);
  }
}

async function recordSymbol(studentId: string, assessmentId: string, symbol: string): Promise<void> {
  const existing = getSymbol(studentId, assessmentId);
  if (existing === symbol) return;
  const result = await window.grdr.grade.recordPerformance({ studentId, assessmentId, symbol });
  if (result.ok) {
    await refreshPerf(assessmentId);
  }
}

async function refreshPerf(assessmentId: string): Promise<void> {
  const perfs = await window.grdr.grade.getPerformancesByAssessment(assessmentId);
  const map = new Map(performances.value);
  map.set(assessmentId, perfs);
  performances.value = map;
}

function onCategoryChange(): void {
  if (selectedCategory.value?.gradingType === 'NUMERIC') {
    addForm.maxPoints = 10;
  } else {
    addForm.maxPoints = null;
  }
}

async function handleAddAssessment(): Promise<void> {
  addError.value = '';
  addingAssessment.value = true;
  try {
    const payload: {
      sessionId: string; title: string; categoryId: string; courseId: string; date: string; maxPoints?: number;
    } = {
      sessionId: props.sessionId,
      title: addForm.title,
      categoryId: addForm.categoryId,
      courseId: props.courseId,
      date: new Date().toISOString(),
    };
    if (selectedCategory.value?.gradingType === 'NUMERIC' && addForm.maxPoints) {
      payload.maxPoints = addForm.maxPoints;
    }
    const result = await window.grdr.assessment.create(payload);
    if (result.ok) {
      addForm.title = '';
      addForm.categoryId = '';
      addForm.maxPoints = null;
      showAddForm.value = false;
      await refreshAssessments();
    } else {
      addError.value = result.error.message;
    }
  } finally {
    addingAssessment.value = false;
  }
}

async function saveFinding(studentId: string, assessmentId: string, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;
  const perf = getPerf(studentId, assessmentId);
  if (!perf) return;
  const result = await window.grdr.finding.add({ performanceId: perf.id, text });
  if (result.ok) {
    input.value = '';
  }
}

function openImpromptu(student: StudentDto): void {
  impromptuStudent.value = student;
}

async function onImpromptuSaved(): Promise<void> {
  impromptuStudent.value = null;
  await refreshAssessments();
}

async function removeAssessment(assessmentId: string): Promise<void> {
  if (!confirm('Soll diese Leistung inkl. aller Schülerergebnisse wirklich gelöscht werden?')) return;
  const result = await window.grdr.assessment.delete(assessmentId);
  if (result.ok) {
    await refreshAssessments();
  }
}
</script>

<style scoped>
.assessment-table {
  font-size: 13px;
}

.table-toolbar {
  margin-bottom: 8px;
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

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
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

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-xs {
  font-size: 12px;
  padding: 2px 4px;
}

.btn-danger-icon:hover {
  background: #fee2e2;
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.add-assessment-form {
  background: #f0f4ff;
  border: 1px dashed var(--color-primary);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

.form-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.form-row label {
  flex: 1;
  min-width: 140px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
}

.required {
  color: var(--color-danger);
}

input, select {
  display: block;
  width: 100%;
  margin-top: 3px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  background: var(--color-surface);
  color: var(--color-text);
}

input:focus, select:focus {
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
  margin-top: 6px;
  font-size: 12px;
}

.loading-sm {
  padding: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
}

.text-secondary {
  color: var(--color-text-secondary);
  font-style: italic;
  font-size: 13px;
}

.perf-table-wrapper {
  overflow-x: auto;
}

.perf-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

.perf-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  background: #f9fafb;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.perf-table td {
  padding: 6px 10px;
  border-top: 1px solid var(--color-border);
  vertical-align: middle;
}

.row-impromptu {
  background: #fffbeb;
}

.col-student { min-width: 140px; }
.col-student-sortable { cursor: pointer; user-select: none; }
.col-assessment { min-width: 120px; }
.col-grade { min-width: 140px; }
.col-finding { min-width: 120px; }
.col-actions { width: 40px; }

.cell-student {
  font-weight: 600;
  border-right: 1px solid var(--color-border);
  background: #fafbfc;
}

.grade-input {
  display: flex;
  align-items: center;
  gap: 4px;
}

.score-input {
  width: 60px;
  padding: 3px 6px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.score-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
}

.max-points {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.symbol-group {
  display: flex;
  gap: 2px;
}

.symbol-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  cursor: pointer;
  font-size: 14px;
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

.finding-input {
  width: 100%;
  min-width: 100px;
  padding: 3px 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 12px;
  background: transparent;
}

.finding-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.badge-impromptu {
  font-size: 11px;
  margin-left: 4px;
  opacity: 0.6;
}

.cell-add-impromptu {
  border-top: 1px dashed var(--color-border);
  padding: 4px 10px !important;
  background: #fafbfc;
}

.no-assessments {
  padding: 12px;
}
</style>
