<template>
  <div class="workspace">
    <div v-if="loading" class="loading">Lade Kurs...</div>
    <template v-else-if="course">
      <header class="workspace-header">
        <div>
          <h2>{{ course.title }}</h2>
          <p class="course-meta">{{ course.schoolClass.name }} · {{ course.schoolClass.schoolYear }}</p>
        </div>
        <button class="btn btn-secondary" @click="$router.push('/courses')">← Zurück</button>
      </header>

      <nav class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab', { 'tab--active': activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="tab-content">
        <SessionsTab v-if="activeTab === 'sessions'" :course="course" />
        <GradingTab v-else-if="activeTab === 'grading'" :course="course" />
        <StudentPickerTab v-else-if="activeTab === 'picker'" :course="course" />

        <CategoriesTab v-else-if="activeTab === 'categories'" :course="course" @update:course="course = $event" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import type { CourseDto } from '../../shared/types';
import SessionsTab from '../components/course/SessionsTab.vue';
import GradingTab from '../components/course/GradingTab.vue';
import StudentPickerTab from '../components/course/StudentPickerTab.vue';
import CategoriesTab from '../components/course/CategoriesTab.vue';

const route = useRoute();
const course = ref<CourseDto | null>(null);
const loading = ref(true);
const activeTab = ref('sessions');

const tabs = [
  { key: 'sessions', label: 'Sitzungen' },
  { key: 'grading', label: 'Benotung' },
  { key: 'picker', label: 'Schülerauswahl' },
  { key: 'categories', label: 'Kategorien' },
];

onMounted(async () => {
  const courseId = route.params.courseId as string;
  const all = await window.grdr.course.list();
  course.value = all.find((c: CourseDto) => c.id === courseId) ?? null;
  loading.value = false;
});
</script>

<style scoped>
.workspace {
  max-width: 100%;
}

.loading {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 32px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  text-align: center;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 12px;
}

.workspace-header h2 {
  font-size: 22px;
}

.course-meta {
  color: var(--color-text-secondary);
  font-size: 14px;
  margin-top: 2px;
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

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.tab-bar {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: 20px;
}

.tab {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color 0.15s, border-color 0.15s;
}

.tab:hover {
  color: var(--color-text);
}

.tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-content {
  min-height: 200px;
}

</style>
