<template>
  <div class="courses-view">
    <div class="toolbar">
      <h2>Kurse</h2>
      <div class="toolbar-actions">
        <label class="toggle-label">
          <input type="checkbox" v-model="showPast" @change="loadCourses" />
          Vergangene Kurse anzeigen
        </label>
        <button class="btn btn-primary" @click="openCreate">+ Kurs anlegen</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Lade Kurse...</div>

    <div v-else-if="courses.length === 0" class="empty">
      {{ showPast ? 'Keine Kurse vorhanden.' : 'Keine Kurse im aktuellen Schuljahr. Vergangene Kurse anzeigen?' }}
    </div>

    <div v-else class="course-list">
      <div
        v-for="c in courses"
        :key="c.id"
        class="course-card"
        @click="openCourse(c.id)"
      >
        <div class="course-body">
          <h3 class="course-title">{{ c.title }}</h3>
          <p class="course-meta">
            {{ c.schoolClass.name }} · {{ c.schoolClass.schoolYear }}
            · {{ c.assessmentCategories.length }} Kategorien
          </p>
        </div>
        <div class="course-actions" @click.stop>
          <button class="btn-icon" title="Klonen" @click="openClone(c)">📋</button>
          <button class="btn-icon" title="Bearbeiten" @click="openEdit(c)">✏️</button>
          <button class="btn-icon btn-danger-icon" title="Löschen" @click="confirmDelete(c)">🗑️</button>
        </div>
      </div>
    </div>

    <CourseFormModal
      v-if="showCreate"
      :course="null"
      @close="showCreate = false"
      @saved="onSaved"
    />
    <CourseFormModal
      v-if="showEdit && editingCourse"
      :course="editingCourse"
      @close="showEdit = false"
      @saved="onSaved"
    />
    <CourseCloneDialog
      v-if="showClone && cloningCourse"
      :course="cloningCourse"
      @close="showClone = false"
      @saved="onSaved"
    />

    <Teleport to="body">
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="confirm-dialog">
          <p>{{ deleting.title }} wirklich löschen?</p>
          <p class="text-secondary">Alle zugehörigen Bewertungen und Leistungen werden gelöscht.</p>
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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { CourseDto } from '../../shared/types';
import CourseFormModal from '../components/courses/CourseFormModal.vue';
import CourseCloneDialog from '../components/courses/CourseCloneDialog.vue';

const router = useRouter();

const courses = ref<CourseDto[]>([]);
const loading = ref(true);
const showPast = ref(false);
const showCreate = ref(false);
const showEdit = ref(false);
const editingCourse = ref<CourseDto | null>(null);
const showClone = ref(false);
const cloningCourse = ref<CourseDto | null>(null);
const deleting = ref<CourseDto | null>(null);

onMounted(async () => {
  await loadCourses();
  loading.value = false;
});

async function loadCourses(): Promise<void> {
  if (showPast.value) {
    courses.value = await window.grdr.course.list();
  } else {
    const schoolYear = currentSchoolYear();
    courses.value = await window.grdr.course.list({ schoolYear });
  }
}

function currentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) {
    return `${year}/${String(year + 1).slice(2)}`;
  }
  return `${year - 1}/${String(year).slice(2)}`;
}

function openCourse(id: string): void {
  router.push(`/courses/${id}`);
}

function openCreate(): void {
  showCreate.value = true;
}

function openEdit(c: CourseDto): void {
  editingCourse.value = c;
  showEdit.value = true;
}

function openClone(c: CourseDto): void {
  cloningCourse.value = c;
  showClone.value = true;
}

function confirmDelete(c: CourseDto): void {
  deleting.value = c;
}

async function doDelete(): Promise<void> {
  if (!deleting.value) return;
  const result = await window.grdr.course.delete(deleting.value.id);
  if (result.ok) {
    deleting.value = null;
    await loadCourses();
  }
}

async function onSaved(): Promise<void> {
  showCreate.value = false;
  showEdit.value = false;
  editingCourse.value = null;
  showClone.value = false;
  cloningCourse.value = null;
  await loadCourses();
}
</script>

<style scoped>
.courses-view {
  max-width: 800px;
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
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
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

.course-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.course-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.course-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 1px 4px rgba(26,115,232,0.1);
}

.course-body {
  flex: 1;
  min-width: 0;
}

.course-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
}

.course-meta {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.course-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 12px;
}

.text-secondary {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin-top: 4px;
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
  width: 400px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

.confirm-dialog p {
  margin-bottom: 8px;
  font-size: 15px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
