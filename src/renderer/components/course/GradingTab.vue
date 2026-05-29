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
                v-for="col in categoryColumns"
                :key="col.categoryId"
                class="col-cat"
              >
                {{ col.categoryTitle }} ({{ col.weight }})
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in sortedStudents" :key="student.id">
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
                v-for="col in categoryColumns"
                :key="col.categoryId"
                class="cell-cat-grade"
              >
                <span v-if="catGrade(student.id, col.categoryId) !== undefined" :class="gradeClass(catGrade(student.id, col.categoryId)!)">
                  {{ catGrade(student.id, col.categoryId) }}
                </span>
                <span v-else class="text-secondary">—</span>
              </td>
            </tr>
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
                v-for="a in assessments"
                :key="a.id"
                class="col-perf"
                :title="a.title"
              >
                {{ a.title }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in sortedStudents" :key="student.id">
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
                v-for="a in assessments"
                :key="a.id"
                class="cell-perf"
              >
                {{ formatPerformance(student.id, a) }}
              </td>
            </tr>
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

const sortedStudents = computed(() =>
  [...students.value].sort((a, b) => {
    const cmp = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    return sortAscending.value ? cmp : -cmp;
  }),
);

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

onMounted(async () => {
  try {
    students.value = await window.grdr.student.list(props.course.schoolClass.id);

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
});

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
