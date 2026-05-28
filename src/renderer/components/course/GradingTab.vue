<template>
  <div class="grading-tab">
    <div v-if="loading" class="loading">Lade Benotungsdaten...</div>

    <div v-else-if="students.length === 0" class="empty">
      Keine Schüler in dieser Klasse.
    </div>

    <div v-else class="grading-table-wrapper">
      <table class="grading-table">
        <thead>
          <tr>
            <th class="col-name">Schüler</th>
            <th class="col-manual">Note (manuell)</th>
            <th class="col-calculated">Berechnete Note</th>
            <th
              v-for="a in assessments"
              :key="a.id"
              class="col-perf"
              :title="a.title"
            >
              {{ a.title }}
              <span v-if="a.maxPoints !== null" class="perf-max">/{{ a.maxPoints }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="student in students" :key="student.id">
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
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import type { CourseDto, StudentDto, AssessmentDto, SessionDto, PerformanceDto } from '../../../shared/types';

const props = defineProps<{
  course: CourseDto;
}>();

const students = ref<StudentDto[]>([]);
const assessments = ref<AssessmentDto[]>([]);
const loading = ref(true);
const manualGrades = reactive<Record<string, number>>({});
const calculated = reactive<Record<string, number>>({});
const perfMap = reactive<Record<string, Record<string, PerformanceDto>>>({});

function manualGrade(studentId: string): number | '' {
  return manualGrades[studentId] ?? '';
}

function gradeClass(grade: number): string {
  if (grade <= 2) return 'grade-good';
  if (grade <= 3) return 'grade-ok';
  return 'grade-bad';
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
    const allStudents = await window.grdr.student.list();
    students.value = allStudents.filter(s => s.schoolClass.id === props.course.schoolClass.id);

    const sessions: SessionDto[] = await window.grdr.session.listByCourse(props.course.id);
    const allAssessments: AssessmentDto[] = [];
    await Promise.all(
      sessions.map(async (s) => {
        const asses = await window.grdr.assessment.listBySession(s.id);
        allAssessments.push(...asses);
      }),
    );
    assessments.value = allAssessments;
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
          calculated[student.id] = calcResult.value.displayGrade;
        }

        if (gradeResult.ok && gradeResult.value) {
          manualGrades[student.id] = gradeResult.value.score;
        }
      }),
    );
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
  font-weight: 700;
  font-size: 15px;
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

.text-secondary {
  color: var(--color-text-secondary);
  font-style: italic;
}
</style>
