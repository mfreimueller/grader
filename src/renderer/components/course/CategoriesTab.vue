<template>
  <div class="categories-tab">
    <div class="section-header">
      <h3>Beurteilungskategorien</h3>
      <button class="btn btn-primary" @click="openCreate">+ Kategorie anlegen</button>
    </div>

    <div v-if="loading" class="loading">Lade Kategorien...</div>

    <div v-else-if="categories.length === 0" class="empty">
      Noch keine Kategorien angelegt.
    </div>

    <table v-else class="cat-table">
      <thead>
        <tr>
          <th>Titel</th>
          <th>Bewertungstyp</th>
          <th>Als Note anzeigen</th>
          <th class="col-actions">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cat in categories" :key="cat.id">
          <td class="cell-title">{{ cat.title }}</td>
          <td>{{ cat.gradingType === 'NUMERIC' ? 'Punkte' : 'Symbole (+/~/−)' }}</td>
          <td>{{ cat.displayAsGrade ? 'Ja' : 'Nein' }}</td>
          <td class="cell-actions">
            <button class="btn btn-secondary btn-sm" @click="openEdit(cat)">Bearbeiten</button>
            <button
              class="btn btn-danger-outline btn-sm"
              :disabled="cat.title === 'Mitarbeit'"
              :title="cat.title === 'Mitarbeit' ? 'Standardkategorie kann nicht gelöscht werden' : ''"
              @click="confirmDelete(cat)"
            >
              Löschen
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showForm" class="overlay" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ editing ? 'Kategorie bearbeiten' : 'Kategorie anlegen' }}</h3>
        <form @submit.prevent="handleSave">
          <label>
            Titel <span class="required">*</span>
            <input v-model="form.title" type="text" required />
          </label>
          <label>
            Bewertungstyp <span class="required">*</span>
            <select v-model="form.gradingType" required>
              <option value="NUMERIC">Punkte (numerisch)</option>
              <option value="TERTIARY">Symbole (+/~/−)</option>
            </select>
          </label>
          <label class="checkbox-label">
            <input v-model="form.displayAsGrade" type="checkbox" />
            Als Note (1–5) auf Zeugnis anzeigen
          </label>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="showForm = false">Abbrechen</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Speichert...' : editing ? 'Aktualisieren' : 'Anlegen' }}
            </button>
          </div>
        </form>
        <p v-if="formError" class="error-msg">{{ formError }}</p>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="deleting" class="overlay" @click.self="deleting = null">
        <div class="confirm-dialog">
          <p>Kategorie „{{ deleting.title }}“ wirklich löschen?</p>
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
import { ref, reactive, onMounted } from 'vue';
import type { CourseDto, AssessmentCategoryDto } from '../../../shared/types';

const props = defineProps<{
  course: CourseDto;
}>();

const categories = ref<AssessmentCategoryDto[]>([]);
const loading = ref(true);
const showForm = ref(false);
const editing = ref<AssessmentCategoryDto | null>(null);
const saving = ref(false);
const formError = ref('');
const deleting = ref<AssessmentCategoryDto | null>(null);

const form = reactive({
  title: '',
  gradingType: 'TERTIARY',
  displayAsGrade: false,
});

onMounted(loadCategories);

async function loadCategories(): Promise<void> {
  loading.value = true;
  try {
    categories.value = await window.grdr.assessmentCategory.listByCourse(props.course.id);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  form.title = '';
  form.gradingType = 'TERTIARY';
  form.displayAsGrade = false;
  formError.value = '';
  showForm.value = true;
}

function openEdit(cat: AssessmentCategoryDto): void {
  editing.value = cat;
  form.title = cat.title;
  form.gradingType = cat.gradingType;
  form.displayAsGrade = cat.displayAsGrade;
  formError.value = '';
  showForm.value = true;
}

async function handleSave(): Promise<void> {
  formError.value = '';
  saving.value = true;
  try {
    if (editing.value) {
      const result = await window.grdr.assessmentCategory.update(editing.value.id, {
        title: form.title,
        gradingType: form.gradingType,
        displayAsGrade: form.displayAsGrade,
      });
      if (!result.ok) {
        formError.value = result.error.message;
        return;
      }
    } else {
      console.log(props.course.id, form.title, form.gradingType, form.displayAsGrade);
      const result = await window.grdr.assessmentCategory.create({
        courseId: props.course.id,
        title: form.title,
        gradingType: form.gradingType,
        displayAsGrade: form.displayAsGrade,
      });
      if (!result.ok) {
        formError.value = result.error.message;
        return;
      }
    }
    showForm.value = false;
    await loadCategories();
  } finally {
    saving.value = false;
  }
}

function confirmDelete(cat: AssessmentCategoryDto): void {
  deleting.value = cat;
}

async function doDelete(): Promise<void> {
  if (!deleting.value) return;
  const result = await window.grdr.assessmentCategory.delete(deleting.value.id);
  if (result.ok) {
    deleting.value = null;
    await loadCategories();
  } else {
    const errMsg = result.error.message;
    deleting.value = null;
    formError.value = errMsg;
  }
}
</script>

<style scoped>
.categories-tab {
  max-width: 720px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  font-size: 16px;
}

.loading, .empty {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 32px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  text-align: center;
}

.cat-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.cat-table th {
  text-align: left;
  padding: 10px 14px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  background: #f9fafb;
  border-bottom: 1px solid var(--color-border);
}

.cat-table td {
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
  vertical-align: middle;
  font-size: 13px;
}

.cell-title {
  font-weight: 600;
}

.col-actions { width: 180px; }

.cell-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
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

.btn-danger {
  background: var(--color-danger);
  color: #fff;
}

.btn-danger-outline {
  background: transparent;
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.btn-danger-outline:hover:not(:disabled) {
  background: #fee2e2;
}

.btn-danger-outline:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

.modal, .confirm-dialog {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 24px;
  width: 440px;
  max-width: 90vw;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

h3 {
  margin-bottom: 16px;
  font-size: 18px;
}

label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.required {
  color: var(--color-danger);
}

input, select {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
}

input:focus, select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 400;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
  margin-top: 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.error-msg {
  color: var(--color-danger);
  margin-top: 12px;
  font-size: 13px;
}

.confirm-dialog p {
  margin-bottom: 16px;
  font-size: 15px;
}
</style>
