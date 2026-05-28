<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>{{ isEdit ? 'Klasse bearbeiten' : 'Klasse anlegen' }}</h3>

      <form @submit.prevent="handleSubmit">
        <label>
          Name <span class="required">*</span>
          <input v-model="form.name" type="text" required placeholder="z.B. 4A" />
        </label>

        <label>
          Schuljahr <span class="required">*</span>
          <input v-model="form.schoolYear" type="text" required placeholder="z.B. 2025/26" />
        </label>

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
import { ref, reactive } from 'vue';
import type { SchoolClassDto } from '../../../shared/types';

const props = defineProps<{
  classItem: SchoolClassDto | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const isEdit = props.classItem !== null;
const submitting = ref(false);
const error = ref('');

const form = reactive({
  name: props.classItem?.name ?? '',
  schoolYear: props.classItem?.schoolYear ?? '',
});

async function handleSubmit(): Promise<void> {
  error.value = '';
  submitting.value = true;
  try {
    if (isEdit) {
      const result = await window.grdr.class.update(props.classItem!.id, {
        name: form.name,
        schoolYear: form.schoolYear,
      });
      if (!result.ok) {
        error.value = result.error.message;
        return;
      }
    } else {
      const result = await window.grdr.class.create({
        name: form.name,
        schoolYear: form.schoolYear,
      });
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
  width: 420px;
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

input {
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

input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26,115,232,0.15);
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

.error-msg {
  color: var(--color-danger);
  margin-top: 12px;
  font-size: 13px;
}
</style>
