<template>
  <div class="students-view">
    <div class="toolbar">
      <h2>Schüler</h2>
      <div class="toolbar-actions">
        <input v-model="search" type="text" class="search-input" placeholder="Suchen nach Name oder Klasse..." />
        <button class="btn btn-primary" @click="showCreate = true">+ Schüler anlegen</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Lade Schüler...</div>

      <div v-else-if="sortedFilteredStudents.length === 0" class="empty">
      {{ search ? 'Keine Schüler gefunden.' : 'Noch keine Schüler angelegt.' }}
    </div>

    <table v-else class="student-table">
      <thead>
        <tr>
          <th class="col-sortable" @click="sortBy('name')">Name{{ sortKey === 'name' ? (sortAscending ? ' ▲' : ' ▼') : '' }}</th>
          <th class="col-sortable" @click="sortBy('class')">Klasse{{ sortKey === 'class' ? (sortAscending ? ' ▲' : ' ▼') : '' }}</th>
          <th>Schuljahr</th>
          <th class="col-actions">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="s in sortedFilteredStudents"
          :key="s.id"
          :class="{ 'row-expanded': expandedId === s.id }"
          @click="toggleExpand(s.id)"
        >
          <td>{{ s.lastName }}, {{ s.firstName }}</td>
          <td>{{ s.schoolClass.name }}</td>
          <td>{{ s.schoolClass.schoolYear }}</td>
          <td class="col-actions" @click.stop>
            <button class="btn-icon" title="Bearbeiten" @click="editStudent(s)">✏️</button>
            <button class="btn-icon btn-danger-icon" title="Löschen" @click="confirmDelete(s)">🗑️</button>
          </td>
        </tr>
        <tr v-if="expandedId" class="detail-row">
          <td colspan="4">
            <StudentDetail :student="expandedStudent!" :performances="performances" :loading-perf="loadingPerf" />
          </td>
        </tr>
      </tbody>
    </table>

    <StudentFormModal v-if="showCreate" :student="null" @close="showCreate = false" @saved="onSaved" />
    <StudentFormModal v-if="showEdit && editingStudent" :student="editingStudent" @close="showEdit = false" @saved="onSaved" />

    <Teleport to="body">
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="confirm-dialog">
          <p>{{ deleting.lastName }}, {{ deleting.firstName }} wirklich löschen?</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="deleting = null">Abbrechen</button>
            <button class="btn btn-danger" @click="doDelete">Löschen</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { StudentDto, PerformanceDto } from '../../shared/types';
import StudentFormModal from '../components/students/StudentFormModal.vue';
import StudentDetail from '../components/students/StudentDetail.vue';

const students = ref<StudentDto[]>([]);
const search = ref('');
const loading = ref(true);
const showCreate = ref(false);
const showEdit = ref(false);
const editingStudent = ref<StudentDto | null>(null);
const expandedId = ref<string | null>(null);
const performances = ref<PerformanceDto[]>([]);
const loadingPerf = ref(false);
const deleting = ref<StudentDto | null>(null);

const sortAscending = ref(true);
const sortKey = ref<'name' | 'class'>('name');

const sortedFilteredStudents = computed(() => {
  let list = students.value;
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(
      (s) =>
        s.lastName.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q) ||
        s.schoolClass.name.toLowerCase().includes(q),
    );
  }
  return [...list].sort((a, b) => {
    let cmp: number;
    if (sortKey.value === 'name') {
      cmp = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
    } else {
      cmp = a.schoolClass.name.localeCompare(b.schoolClass.name) ||
            a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName);
    }
    return sortAscending.value ? cmp : -cmp;
  });
});

function sortBy(key: 'name' | 'class'): void {
  if (sortKey.value === key) {
    sortAscending.value = !sortAscending.value;
  } else {
    sortKey.value = key;
    sortAscending.value = true;
  }
}

const expandedStudent = computed(() =>
  expandedId.value ? students.value.find((s) => s.id === expandedId.value) ?? null : null,
);

onMounted(async () => {
  await loadStudents();
  loading.value = false;
});

async function loadStudents(): Promise<void> {
  students.value = await window.grdr.student.list();
}

async function toggleExpand(id: string): Promise<void> {
  if (expandedId.value === id) {
    expandedId.value = null;
    performances.value = [];
    return;
  }
  expandedId.value = id;
  loadingPerf.value = true;
  try {
    const result = await window.grdr.grade.listByStudent(id);
    performances.value = result.ok ? result.value : [];
  } finally {
    loadingPerf.value = false;
  }
}

function editStudent(s: StudentDto): void {
  editingStudent.value = s;
  showEdit.value = true;
}

function confirmDelete(s: StudentDto): void {
  deleting.value = s;
}

async function doDelete(): Promise<void> {
  if (!deleting.value) return;
  const result = await window.grdr.student.delete(deleting.value.id);
  if (result.ok) {
    if (expandedId.value === deleting.value.id) {
      expandedId.value = null;
      performances.value = [];
    }
    deleting.value = null;
    await loadStudents();
  } else {
    deleting.value = null;
  }
}

async function onSaved(): Promise<void> {
  showCreate.value = false;
  showEdit.value = false;
  editingStudent.value = null;
  await loadStudents();
}
</script>

<style scoped>
.students-view {
  max-width: 960px;
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

.search-input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  width: 220px;
  background: var(--color-surface);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
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

.student-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.student-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  background: #f9fafb;
  border-bottom: 1px solid var(--color-border);
}

.col-sortable {
  cursor: pointer;
  user-select: none;
}

.student-table td {
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
  cursor: pointer;
}

.student-table tbody tr:not(.detail-row):hover {
  background: #f9fafb;
}

.student-table .row-expanded {
  background: #f0f4ff;
}

.col-actions {
  width: 100px;
  text-align: right;
}

.detail-row td {
  padding: 0;
  cursor: default;
  background: #f8faff;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
