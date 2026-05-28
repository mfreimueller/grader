<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>{{ isEdit ? 'Schüler bearbeiten' : 'Schüler anlegen' }}</h3>

      <form @submit.prevent="handleSubmit">
        <div class="form-row">
          <label>
            Vorname <span class="required">*</span>
            <input v-model="form.firstName" type="text" required />
          </label>
          <label>
            Nachname <span class="required">*</span>
            <input v-model="form.lastName" type="text" required />
          </label>
        </div>

        <label>
          Klasse <span class="required">*</span>
          <select v-model="form.schoolClassId" required>
            <option value="" disabled>— Klasse wählen —</option>
            <option v-for="klasse in classes" :key="klasse.id" :value="klasse.id">
              {{ klasse.name }} ({{ klasse.schoolYear }})
            </option>
          </select>
        </label>

        <fieldset class="additional-info">
          <legend>Zusatzinformationen</legend>
          <div v-for="(entry, idx) in form.additionalInfo" :key="idx" class="info-row">
            <input v-model="entry.key" type="text" placeholder="Schlüssel" />
            <input v-model="entry.value" type="text" placeholder="Wert" />
            <button type="button" class="btn-icon btn-danger" @click="removeInfo(idx)">✕</button>
          </div>
          <button type="button" class="btn btn-secondary" @click="addInfo">+ Zeile hinzufügen</button>
        </fieldset>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Abbrechen</button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? 'Speichert...' : isEdit ? 'Aktualisieren' : 'Anlegen' }}
          </button>
        </div>
      </form>

      <p v-if="error" class="error-msg">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import type { StudentDto, SchoolClassDto, CreateStudentInput, UpdateStudentInput } from '../../../shared/types';

const props = defineProps<{
  student: StudentDto | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const isEdit = props.student !== null;

const classes = ref<SchoolClassDto[]>([]);
const submitting = ref(false);
const error = ref('');

const form = reactive<{
  firstName: string;
  lastName: string;
  schoolClassId: string;
  additionalInfo: { key: string; value: string }[];
}>({
  firstName: props.student?.firstName ?? '',
  lastName: props.student?.lastName ?? '',
  schoolClassId: props.student?.schoolClass.id ?? '',
  additionalInfo: props.student?.additionalInfo
    ? props.student.additionalInfo.map((i) => ({ key: i.key, value: i.value }))
    : [],
});

onMounted(async () => {
  classes.value = await window.grdr.class.list();
});

function addInfo(): void {
  form.additionalInfo.push({ key: '', value: '' });
}

function removeInfo(idx: number): void {
  form.additionalInfo.splice(idx, 1);
}

async function handleSubmit(): Promise<void> {
  error.value = '';
  submitting.value = true;
  try {
    if (isEdit) {
      const input: UpdateStudentInput = {
        firstName: form.firstName,
        lastName: form.lastName,
        schoolClassId: form.schoolClassId,
        additionalInfo: form.additionalInfo.map(e => ({ key: e.key, value: e.value })),
      };
      const result = await window.grdr.student.update(props.student!.id, input);
      if (!result.ok) {
        error.value = result.error.message;
        return;
      }
    } else {
      const input: CreateStudentInput = {
        firstName: form.firstName,
        lastName: form.lastName,
        schoolClassId: form.schoolClassId,
        additionalInfo: form.additionalInfo.map(e => ({ key: e.key, value: e.value })),
      };
      const result = await window.grdr.student.create(input);
      if (!result.ok) {
        error.value = result.error.message;
        return;
      }
    }
    emit('saved');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 24px;
  width: 520px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

h3 {
  margin-bottom: 16px;
  font-size: 18px;
}

.form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.form-row label {
  flex: 1;
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

fieldset.additional-info {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}

legend {
  font-size: 13px;
  font-weight: 500;
  padding: 0 4px;
}

.info-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.info-row input {
  margin-top: 0;
}

.info-row input:first-child {
  flex: 0 0 140px;
}

.info-row input:last-of-type {
  flex: 1;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
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

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.btn-icon {
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  background: transparent;
}

.btn-danger {
  color: var(--color-danger);
}

.btn-danger:hover {
  background: #fee2e2;
}

.error-msg {
  color: var(--color-danger);
  margin-top: 12px;
  font-size: 13px;
}
</style>
