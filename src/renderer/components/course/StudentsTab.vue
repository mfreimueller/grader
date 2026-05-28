<template>
  <div class="students-tab">
    <div v-if="loading" class="loading">Lade Schüler...</div>

    <div v-else-if="students.length === 0" class="empty">
      Keine Schüler in dieser Klasse.
    </div>

    <table v-else class="roster-table">
      <thead>
        <tr>
          <th>Name</th>
          <th class="col-actions">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="student in students" :key="student.id">
          <td class="cell-name">{{ student.lastName }}, {{ student.firstName }}</td>
          <td class="cell-actions">
            <button class="btn btn-secondary btn-sm" @click="openImpromptu(student)">
              + Spontane Leistung
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <ImpromptuDialog
      v-if="impromptuStudent"
      :student="impromptuStudent"
      :categories="categories"
      :course-id="course.id"
      @close="impromptuStudent = null"
      @saved="impromptuStudent = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { CourseDto, StudentDto, AssessmentCategoryDto } from '../../../shared/types';
import ImpromptuDialog from './ImpromptuDialog.vue';

const props = defineProps<{
  course: CourseDto;
}>();

const students = ref<StudentDto[]>([]);
const categories = ref<AssessmentCategoryDto[]>([]);
const loading = ref(true);
const impromptuStudent = ref<StudentDto | null>(null);

onMounted(async () => {
  try {
    const [allStudents, cats] = await Promise.all([
      window.grdr.student.list(),
      window.grdr.assessmentCategory.listByCourse(props.course.id),
    ]);
    students.value = allStudents.filter(s => s.schoolClass.id === props.course.schoolClass.id);
    categories.value = cats;
  } finally {
    loading.value = false;
  }
});

function openImpromptu(student: StudentDto): void {
  impromptuStudent.value = student;
}
</script>

<style scoped>
.students-tab {
  max-width: 640px;
}

.loading, .empty {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 32px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  text-align: center;
}

.roster-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.roster-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  background: #f9fafb;
  border-bottom: 1px solid var(--color-border);
}

.roster-table td {
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
  vertical-align: middle;
}

.cell-name {
  font-weight: 600;
}

.col-actions { width: 180px; }

.cell-actions {
  text-align: right;
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

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: #f3f4f6;
}
</style>
