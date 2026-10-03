<template>
  <div class="grading-tab">
    <div v-if="loading" class="loading">Lade Benotungsdaten...</div>

    <div v-else-if="students.length === 0" class="empty">
      Keine Schüler in dieser Klasse.
    </div>

    <div v-else>
      <div class="view-toggle">
        <button
          :class="['toggle-btn', { active: viewMode === 'high-level' }]"
          @click="viewMode = 'high-level'"
        >
          Übersicht
        </button>
        <button
          :class="['toggle-btn', { active: viewMode === 'detailed' }]"
          @click="viewMode = 'detailed'"
        >
          Detailansicht
        </button>
      </div>

      <div v-if="focusedStudentId" class="focus-banner">
        Zeige nur: {{ focusedStudentName }} —
        <button class="focus-banner-btn" @click="focusedStudentId = null">Alle anzeigen</button>
      </div>

      <div v-if="viewMode === 'high-level'" class="grading-table-wrapper">
        <table class="grading-table">
          <thead>
            <tr>
              <th class="col-name col-name-sortable" @click="sortAscending = !sortAscending">
                Schüler {{ sortAscending ? '▲' : '▼' }}
              </th>
              <th class="col-manual">Note (manuell)</th>
              <th class="col-calculated">Berechnet</th>
              <th
                v-for="col in categoryColumns.filter(c => visibleCategoryIds.has(c.categoryId))"
                :key="col.categoryId"
                class="col-cat"
              >
                {{ col.categoryTitle }} ({{ col.weight }})
              </th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="student in displayedStudents" :key="student.id">
              <tr>
                <td class="cell-name">{{ student.lastName }}, {{ student.firstName }}</td>
                <td>
                  <select
                    class="grade-select"
                    :value="manualGrade(student.id)"
                    @change="setManualGrade(student.id, $event)"
                  >
                    <option value="">—</option>
                    <option v-for="g in 5" :key="g" :value="g">{{ g }}</option>
                  </select>
                </td>
                <td class="cell-calculated">
                  <span v-if="calculated[student.id] !== undefined" :class="gradeClass(calculated[student.id])">
                    {{ calculated[student.id] }}
                    <span
                      v-if="gradeIndicator(student.id)"
                      class="grade-indicator"
                    >
                      {{ gradeIndicator(student.id) }}
                    </span>
                  </span>
                  <span v-else class="text-secondary">—</span>
                </td>
                <td
                  v-for="col in categoryColumns.filter(c => visibleCategoryIds.has(c.categoryId))"
                  :key="col.categoryId"
                  class="cell-cat-grade"
                >
                  <span v-if="catGrade(student.id, col.categoryId) !== undefined" :class="gradeClass(catGrade(student.id, col.categoryId)!)">
                    {{ catGrade(student.id, col.categoryId) }}
                  </span>
                  <span v-else class="text-secondary">—</span>
                </td>
                <td class="cell-actions">
                  <button v-if="!focusedStudentId" class="action-btn" @click.stop="toggleDropdown(student.id)">⋯</button>
                  <div v-if="openDropdown === student.id" class="dropdown-menu" @click.stop>
                    <button @click="focusStudent(student.id)">
                      Nur diesen Schüler zeigen
                    </button>
                    <button @click="toggleExplain(student.id)">
                      Berechnung erklären
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedExplain.has(student.id)" class="explain-row">
                <td :colspan="totalColumns()" class="explain-cell">
                  <div class="explain-content">
                    <div class="explain-summary">
                      <span>
                        <strong>Gesamtergebnis:</strong>
                        {{ (rawScores[student.id] * 100).toFixed(1) }}% → Note {{ calculated[student.id] }}
                        <span v-if="gradeIndicator(student.id)" class="grade-indicator">
                          {{ gradeIndicator(student.id) }}
                        </span>
                      </span>
                      <button class="explain-close" @click="closeExplain(student.id)">✕</button>
                    </div>
                    <div
                      v-for="cat in (categoryInfos[student.id] ?? [])"
                      :key="cat.categoryId"
                      class="explain-category"
                    >
                      <div class="explain-category-header">
                        <strong>{{ cat.categoryTitle }}</strong>
                        (Gewicht: {{ cat.weight }}%, {{ cat.performanceCount }} Leistungen):
                        Ø {{ (cat.mean * 100).toFixed(1) }}% → Note {{ cat.displayGrade }}
                        <button
                          v-if="cat.performanceCount > 0"
                          class="explain-toggle"
                          @click="toggleExplainCategory(student.id, cat.categoryId)"
                        >
                          {{ expandedExplainCategory.has(student.id + ':' + cat.categoryId) ? '▲' : '▼' }}
                        </button>
                      </div>
                      <div
                        v-if="cat.performanceCount > 0 && expandedExplainCategory.has(student.id + ':' + cat.categoryId)"
                        class="explain-performances"
                      >
                        <div
                          v-for="perf in getPerformancesForCategory(student.id, cat.categoryId)"
                          :key="perf.id"
                          class="explain-perf"
                        >
                          <span class="explain-perf-date">{{ perf.date }}</span>
                          <span class="explain-perf-title">{{ perf.title }}</span>
                          <span class="explain-perf-raw">({{ perf.raw }})</span>
                          <span class="explain-perf-normalized">→ {{ perf.normalized }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-else class="grading-table-wrapper">
        <table class="grading-table">
          <thead>
            <tr>
              <th class="col-name col-name-sortable" @click="sortAscending = !sortAscending">
                Schüler {{ sortAscending ? '▲' : '▼' }}
              </th>
              <th class="col-manual">Note (manuell)</th>
              <th class="col-calculated">Berechnete Note</th>
              <th
                v-for="a in assessments.filter(a => !a.category.isHidden)"
                :key="a.id"
                class="col-perf"
                :title="a.title"
              >
                {{ a.title }}
              </th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="student in displayedStudents" :key="student.id">
              <tr>
                <td class="cell-name">{{ student.lastName }}, {{ student.firstName }}</td>
                <td>
                  <select
                    class="grade-select"
                    :value="manualGrade(student.id)"
                    @change="setManualGrade(student.id, $event)"
                  >
                    <option value="">—</option>
                    <option v-for="g in 5" :key="g" :value="g">{{ g }}</option>
                  </select>
                </td>
                <td class="cell-calculated">
                  <span v-if="calculated[student.id] !== undefined">
                    <span :class="gradeClass(calculated[student.id])">{{ calculated[student.id] }}</span>
                    <span class="raw-score"> ({{ (rawScores[student.id] * 100).toFixed(1) }}%)</span>
                  </span>
                  <span v-else class="text-secondary">—</span>
                </td>
                <td
                  v-for="a in assessments.filter(a => !a.category.isHidden)"
                  :key="a.id"
                  class="cell-perf"
                >
                  {{ formatPerformance(student.id, a) }}
                </td>
                <td class="cell-actions">
                  <button v-if="!focusedStudentId" class="action-btn" @click.stop="toggleDropdown(student.id)">⋯</button>
                  <div v-if="openDropdown === student.id" class="dropdown-menu" @click.stop>
                    <button @click="focusStudent(student.id)">
                      Nur diesen Schüler zeigen
                    </button>
                    <button @click="toggleExplain(student.id)">
                      Berechnung erklären
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedExplain.has(student.id)" class="explain-row">
                <td :colspan="totalColumns()" class="explain-cell">
                  <div class="explain-content">
                    <div class="explain-summary">
                      <span>
                        <strong>Gesamtergebnis:</strong>
                        {{ (rawScores[student.id] * 100).toFixed(1) }}% → Note {{ calculated[student.id] }}
                        <span v-if="gradeIndicator(student.id)" class="grade-indicator">
                          {{ gradeIndicator(student.id) }}
                        </span>
                      </span>
                      <button class="explain-close" @click="closeExplain(student.id)">✕</button>
                    </div>
                    <div
                      v-for="cat in (categoryInfos[student.id] ?? [])"
                      :key="cat.categoryId"
                      class="explain-category"
                    >
                      <div class="explain-category-header">
                        <strong>{{ cat.categoryTitle }}</strong>
                        (Gewicht: {{ cat.weight }}%, {{ cat.performanceCount }} Leistungen):
                        Ø {{ (cat.mean * 100).toFixed(1) }}% → Note {{ cat.displayGrade }}
                        <button
                          v-if="cat.performanceCount > 0"
                          class="explain-toggle"
                          @click="toggleExplainCategory(student.id, cat.categoryId)"
                        >
                          {{ expandedExplainCategory.has(student.id + ':' + cat.categoryId) ? '▲' : '▼' }}
                        </button>
                      </div>
                      <div
                        v-if="cat.performanceCount > 0 && expandedExplainCategory.has(student.id + ':' + cat.categoryId)"
                        class="explain-performances"
                      >
                        <div
                          v-for="perf in getPerformancesForCategory(student.id, cat.categoryId)"
                          :key="perf.id"
                          class="explain-perf"
                        >
                          <span class="explain-perf-date">{{ perf.date }}</span>
                          <span class="explain-perf-title">{{ perf.title }}</span>
                          <span class="explain-perf-raw">({{ perf.raw }})</span>
                          <span class="explain-perf-normalized">→ {{ perf.normalized }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import type {
  CourseDto,
  StudentDto,
  AssessmentDto,
  SessionDto,
  PerformanceDto,
  CategoryGradeResultDto,
} from '../../../shared/types';

const props = defineProps<{
  course: CourseDto;
}>();

const viewMode = ref<'high-level' | 'detailed'>('high-level');
const students = ref<StudentDto[]>([]);
const assessments = ref<AssessmentDto[]>([]);
const loading = ref(true);
const manualGrades = reactive<Record<string, number>>({});
const calculated = reactive<Record<string, number>>({});
const perfMap = reactive<Record<string, Record<string, PerformanceDto>>>({});
const rawScores = reactive<Record<string, number>>({});
const catGrades = reactive<Record<string, Record<string, number>>>({});
const categoryColumns = ref<CategoryGradeResultDto[]>([]);
const sortAscending = ref(true);
const openDropdown = ref<string | null>(null);
const focusedStudentId = ref<string | null>(null);

const categoryInfos = reactive<Record<string, CategoryGradeResultDto[]>>({});
const expandedExplain = ref<Set<string>>(new Set());
const expandedExplainCategory = ref<Set<string>>(new Set());

function toggleExplain(studentId: string): void {
  const s = new Set(expandedExplain.value);
  if (s.has(studentId)) s.delete(studentId); else s.add(studentId);
  expandedExplain.value = s;
  openDropdown.value = null;
}

function closeExplain(studentId: string): void {
  const s = new Set(expandedExplain.value);
  s.delete(studentId);
  expandedExplain.value = s;
}

function toggleExplainCategory(studentId: string, categoryId: string): void {
  const key = `${studentId}:${categoryId}`;
  const s = new Set(expandedExplainCategory.value);
  if (s.has(key)) s.delete(key); else s.add(key);
  expandedExplainCategory.value = s;
}

function getPerformancesForCategory(studentId: string, categoryId: string): Array<{ id: string; date: string; title: string; raw: string; normalized: string }> {
  const perfs = Object.values(perfMap[studentId] ?? {});
  return perfs
    .filter(p => {
      const ass = assessments.value.find(a => a.id === p.assessmentId);
      return ass?.category.id === categoryId;
    })
    .map(p => {
      const ass = assessments.value.find(a => a.id === p.assessmentId)!;
      const raw = p.type === 'graded'
        ? `${p.score}/${ass.maxPoints}`
        : (p.symbol === 'PLUS' ? '+' : p.symbol === 'WELLE' ? '~' : '−');
      const norm = p.type === 'graded' && p.score !== null && ass.maxPoints
        ? (p.score / ass.maxPoints * 100).toFixed(1) + '%'
        : p.type === 'participation'
          ? (p.symbol === 'PLUS' ? '100%' : p.symbol === 'WELLE' ? '50%' : '0%')
          : '—';
      return { id: p.id, date: p.date, title: ass.title, raw, normalized: norm };
    });
}

function totalColumns(): number {
  let cols = 3; // name + manual + calculated
  if (viewMode.value === 'high-level') {
    cols += categoryColumns.value.filter(c => visibleCategoryIds.value.has(c.categoryId)).length;
  } else {
    cols += assessments.value.filter(a => !a.category.isHidden).length;
  }
  cols += 1; // actions column
  return cols;
}

function toggleDropdown(studentId: string): void {
  openDropdown.value = openDropdown.value === studentId ? null : studentId;
}

function focusStudent(studentId: string): void {
  focusedStudentId.value = studentId;
  openDropdown.value = null;
}

const visibleCategoryIds = computed(() =>
  new Set(props.course.assessmentCategories.filter(c => !c.isHidden).map(c => c.id)),
);

const sortedStudents = computed(() =>
  [...students.value].sort((a, b) => {
    const cmp = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    return sortAscending.value ? cmp : -cmp;
  }),
);

const displayedStudents = computed(() => {
  if (focusedStudentId.value) {
    return sortedStudents.value.filter(s => s.id === focusedStudentId.value);
  }
  return sortedStudents.value;
});

const focusedStudentName = computed(() => {
  if (!focusedStudentId.value) return '';
  const s = students.value.find(st => st.id === focusedStudentId.value);
  return s ? `${s.lastName}, ${s.firstName}` : '';
});

function manualGrade(studentId: string): number | '' {
  return manualGrades[studentId] ?? '';
}

function gradeClass(grade: number): string {
  if (grade <= 2) return 'grade-good';
  if (grade <= 3) return 'grade-ok';
  return 'grade-bad';
}

function catGrade(studentId: string, categoryId: string): number | undefined {
  return catGrades[studentId]?.[categoryId];
}

const BOUNDARY_DELTA = 0.03;

function gradeBoundaryIndicator(score: number, grade: number): string | null {
  const b = [0.875, 0.75, 0.625, 0.50] as const;
  if (grade === 1 && score - b[0] <= BOUNDARY_DELTA) return '↓2';
  if (grade === 2) {
    if (b[0] - score <= BOUNDARY_DELTA) return '↑1';
    if (score - b[1] <= BOUNDARY_DELTA) return '↓3';
  }
  if (grade === 3) {
    if (b[1] - score <= BOUNDARY_DELTA) return '↑2';
    if (score - b[2] <= BOUNDARY_DELTA) return '↓4';
  }
  if (grade === 4) {
    if (b[2] - score <= BOUNDARY_DELTA) return '↑3';
    if (score - b[3] <= BOUNDARY_DELTA) return '↓5';
  }
  if (grade === 5 && b[3] - score <= BOUNDARY_DELTA) return '↑4';
  return null;
}

function gradeIndicator(studentId: string): string | null {
  const score = rawScores[studentId];
  const grade = calculated[studentId];
  if (score === undefined || grade === undefined) return null;
  return gradeBoundaryIndicator(score, grade);
}

function formatPerformance(studentId: string, assessment: AssessmentDto): string {
  const perf = perfMap[studentId]?.[assessment.id];
  if (!perf) return '—';
  if (perf.type === 'graded' && perf.score !== null) {
    if (assessment.category.displayAsGrade) {
      const maxPoints = assessment.maxPoints ?? 1;
      const pct = perf.score / maxPoints;
      const grade = pct >= 0.875 ? 1 : pct >= 0.75 ? 2 : pct >= 0.625 ? 3 : pct >= 0.5 ? 4 : 5;
      return String(grade);
    }
    const max = assessment.maxPoints ?? '?';
    return `${perf.score}/${max}`;
  }
  if (perf.type === 'participation' && perf.symbol) {
    const sym: Record<string, string> = { PLUS: '+', WELLE: '~', MINUS: '−' };
    return sym[perf.symbol] ?? perf.symbol;
  }
  return '—';
}

onMounted(() => {
  document.addEventListener('click', () => { openDropdown.value = null; });
  loadData();
});

async function loadData(): Promise<void> {
  try {
    const members = await window.grdr.roster.members(props.course.id);
    students.value = members.ok ? members.value : [];

    const sessions: SessionDto[] = await window.grdr.session.listByCourse(props.course.id);
    const allAssessments: AssessmentDto[] = [];
    await Promise.all(
      sessions.map(async (s) => {
        const asses = await window.grdr.assessment.listBySession(s.id);
        allAssessments.push(...asses);
      }),
    );

    const courseAssessmentIds = new Set(allAssessments.map(a => a.id));

    await Promise.all(
      students.value.map(async (student) => {
        const [perfResult, calcResult, gradeResult] = await Promise.all([
          window.grdr.grade.listByStudent(student.id),
          window.grdr.grade.calculateFinal(props.course.id, student.id),
          window.grdr.grade.get(props.course.id, student.id),
        ]);

        if (perfResult.ok) {
          const coursePerfs = perfResult.value.filter(
            (p: PerformanceDto) => courseAssessmentIds.has(p.assessmentId),
          );
          const map: Record<string, PerformanceDto> = {};
          for (const p of coursePerfs) {
            map[p.assessmentId] = p;
          }
          perfMap[student.id] = map;
        }

        if (calcResult.ok) {
          rawScores[student.id] = calcResult.value.rawScore;
          calculated[student.id] = calcResult.value.displayGrade;
          categoryInfos[student.id] = calcResult.value.categoryGrades;
          const grades: Record<string, number> = {};
          for (const cg of calcResult.value.categoryGrades) {
            grades[cg.categoryId] = cg.displayGrade;
          }
          catGrades[student.id] = grades;
          if (categoryColumns.value.length === 0) {
            categoryColumns.value = calcResult.value.categoryGrades;
          }
        }

        if (gradeResult.ok && gradeResult.value) {
          manualGrades[student.id] = gradeResult.value.score;
        }
      }),
    );

    const assessmentIdsWithPerfs = new Set<string>();
    for (const studentId of Object.keys(perfMap)) {
      for (const assessmentId of Object.keys(perfMap[studentId])) {
        assessmentIdsWithPerfs.add(assessmentId);
      }
    }
    assessments.value = allAssessments
      .filter(a => assessmentIdsWithPerfs.has(a.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  } finally {
    loading.value = false;
  }
}

async function setManualGrade(studentId: string, event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const value = select.value;
  if (!value) return;
  const score = parseInt(value, 10);
  const result = await window.grdr.grade.saveManualGrade({
    studentId,
    courseId: props.course.id,
    score,
  });
  if (result.ok) {
    manualGrades[studentId] = score;
  }
}
</script>

<style scoped>
.grading-tab {
  max-width: 100%;
}

.loading, .empty {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 32px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  text-align: center;
}

.grading-table-wrapper {
  overflow-x: auto;
}

.grading-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  font-size: 13px;
}

.grading-table th {
  text-align: left;
  padding: 8px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  background: #f9fafb;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.grading-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--color-border);
  vertical-align: middle;
}

.col-name { min-width: 160px; }
.col-name-sortable { cursor: pointer; user-select: none; }
.col-manual { min-width: 100px; }
.col-calculated { min-width: 100px; }
.col-perf { min-width: 80px; text-align: center; }
.col-actions { width: 40px; min-width: 40px; }

.cell-name {
  font-weight: 600;
}

.grade-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 13px;
  background: var(--color-surface);
  color: var(--color-text);
  width: 60px;
  text-align: center;
}

.grade-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.cell-calculated {
  text-align: center;
  font-weight: 600;
  font-size: 16px;
}

.raw-score {
  color: var(--color-text-secondary);
  font-weight: 400;
  font-size: 11px;
}

.grade-indicator {
  color: var(--color-text-secondary);
  font-weight: 400;
  font-size: 10px;
  margin-left: 1px;
}

.grade-good { color: #059669; }
.grade-ok { color: #d97706; }
.grade-bad { color: #dc2626; }

.cell-perf {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.perf-max {
  color: var(--color-text-secondary);
  font-weight: 400;
  font-size: 10px;
}

.col-cat { min-width: 80px; text-align: center; }

.cell-cat-grade {
  text-align: center;
  font-weight: 700;
  font-size: 15px;
}

.cell-actions {
  position: relative;
  text-align: center;
}

.action-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1;
  color: var(--color-text-secondary);
}

.action-btn:hover {
  background: #f3f4f6;
  color: var(--color-text);
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 50;
  background: white;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 220px;
  padding: 4px 0;
}

.dropdown-menu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text);
}

.dropdown-menu button:hover {
  background: #f3f4f6;
}

.focus-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  font-size: 13px;
  color: #1e40af;
}

.focus-banner-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.focus-banner-btn:hover {
  opacity: 0.9;
}

.explain-row td {
  padding: 0;
  border-top: none;
}

.explain-content {
  background: #f9fafb;
  border-top: 1px solid var(--color-border);
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.6;
}

.explain-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}

.explain-close {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  padding: 0 8px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.explain-close:hover {
  background: #e5e7eb;
}

.explain-category {
  margin-bottom: 6px;
  padding: 6px 8px;
  border-radius: 4px;
}

.explain-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.explain-toggle {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  padding: 0 6px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.explain-toggle:hover {
  background: #e5e7eb;
}

.explain-performances {
  margin-top: 4px;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.explain-perf {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.explain-perf-date {
  min-width: 80px;
}

.explain-perf-title {
  min-width: 120px;
  font-weight: 500;
}

.explain-perf-raw {
  min-width: 60px;
  text-align: right;
}

.explain-perf-normalized {
  min-width: 60px;
}

.view-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  width: fit-content;
}

.toggle-btn {
  padding: 6px 16px;
  font-size: 13px;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.toggle-btn:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.toggle-btn.active {
  background: var(--color-primary, #3b82f6);
  color: #fff;
}

.text-secondary {
  color: var(--color-text-secondary);
  font-style: italic;
}
</style>
