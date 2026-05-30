<template>
  <div class="reports-view">
    <h2>Berichte</h2>

    <div class="config-card">
      <div class="form-group">
        <label class="form-label">Schuljahr auswählen</label>
        <select v-model="selectedSchoolYear" class="form-select">
          <option value="" disabled>— Schuljahr wählen —</option>
          <option v-for="y in schoolYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Kurs auswählen</label>
        <select
          v-model="selectedCourseId"
          class="form-select"
          :disabled="!selectedSchoolYear"
        >
          <option value="" disabled>— Kurs wählen —</option>
          <option v-for="c in filteredCourses" :key="c.id" :value="c.id">
            {{ c.title }} — {{ c.schoolClass.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Berichtsart</label>
        <div class="radio-group">
          <label class="radio-label">
            <input v-model="reportMode" type="radio" value="reduced" />
            Reduziert (nur Notenübersicht)
          </label>
          <label class="radio-label">
            <input v-model="reportMode" type="radio" value="full" />
            Detailiert (Noten + Kategorien mit Prozent)
          </label>
        </div>
      </div>

      <div class="form-actions">
        <button
          class="btn btn-primary"
          :disabled="!selectedSchoolYear || !selectedCourseId || generating"
          @click="generateReport"
        >
          {{ generating ? 'Wird erstellt...' : 'PDF erstellen' }}
        </button>
      </div>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { CourseDto } from '../../shared/types';

const courses = ref<CourseDto[]>([]);
const selectedSchoolYear = ref('');
const selectedCourseId = ref('');
const reportMode = ref<'full' | 'reduced'>('reduced');
const generating = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

const schoolYears = computed(() => {
  const years = new Set(courses.value.map(c => c.schoolClass.schoolYear));
  return [...years].sort().reverse();
});

const filteredCourses = computed(() => {
  if (!selectedSchoolYear.value) return [];
  return courses.value.filter(c => c.schoolClass.schoolYear === selectedSchoolYear.value);
});

watch(selectedSchoolYear, () => {
  selectedCourseId.value = '';
});

onMounted(async () => {
  courses.value = await window.grdr.course.list();
});

async function generateReport(): Promise<void> {
  if (!selectedCourseId.value) return;
  generating.value = true;
  errorMsg.value = '';
  successMsg.value = '';
  try {
    const result = await window.grdr.report.generate(selectedCourseId.value, reportMode.value);
    if (result.ok) {
      successMsg.value = `PDF gespeichert unter: ${result.value.filePath}`;
    } else {
      if (result.error.name !== 'CanceledError') {
        errorMsg.value = result.error.message;
      }
    }
  } finally {
    generating.value = false;
  }
}
</script>

<style scoped>
.reports-view {
  max-width: 640px;
}

h2 {
  margin-bottom: 20px;
}

.config-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text);
}

.form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
}

.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.form-actions {
  margin-top: 24px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
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

.error-msg {
  color: var(--color-danger);
  margin-top: 12px;
  font-size: 13px;
}

.success-msg {
  color: #16a34a;
  margin-top: 12px;
  font-size: 13px;
  word-break: break-all;
}
</style>
