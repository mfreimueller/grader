<template>
  <div class="students-tab">
    <div v-if="loading" class="loading">Lade Schüler...</div>

    <div v-else-if="students.length === 0" class="empty">
      Keine Schüler in dieser Klasse.
    </div>

    <table v-else class="roster-table">
      <thead>
        <tr>
          <th class="col-name-sortable" @click="sortAscending = !sortAscending">
            Name {{ sortAscending ? '▲' : '▼' }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="student in sortedStudents" :key="student.id">
          <td class="cell-name">{{ student.lastName }}, {{ student.firstName }}</td>
        </tr>
      </tbody>
    </table>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { CourseDto, StudentDto } from '../../../shared/types';

const props = defineProps<{
  course: CourseDto;
}>();

const students = ref<StudentDto[]>([]);
const loading = ref(true);
const sortAscending = ref(true);

const sortedStudents = computed(() =>
  [...students.value].sort((a, b) => {
    const cmp = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    return sortAscending.value ? cmp : -cmp;
  }),
);

onMounted(async () => {
  try {
    students.value = await window.grdr.student.list(props.course.schoolClass.id);
  } finally {
    loading.value = false;
  }
});
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

.col-name-sortable { cursor: pointer; user-select: none; }
</style>
