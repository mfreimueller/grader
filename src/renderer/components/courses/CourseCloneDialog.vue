<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h3>Kurs klonen</h3>

      <div class="source-info">
        <p><strong>Quelle:</strong> {{ course.title }}</p>
        <p><strong>Klasse:</strong> {{ course.schoolClass.name }} ({{ course.schoolClass.schoolYear }})</p>
        <p class="text-secondary">Alle Bewertungskategorien und Zusammensetzungen werden übernommen. Leistungen werden nicht kopiert.</p>
      </div>

      <form @submit.prevent="handleClone">
        <label>
          Ziel-Klasse <span class="required">*</span>
          <select v-model="targetClassId" required>
            <option value="" disabled>— Klasse wählen —</option>
            <option v-for="klasse in classes" :key="klasse.id" :value="klasse.id">
              {{ klasse.name }} ({{ klasse.schoolYear }})
            </option>
          </select>
        </label>

        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Abbrechen</button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? 'Kioniere...' : 'Kurs klonen' }}
          </button>
        </div>
      </form>

      <p v-if="error" class="error-msg">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { CourseDto, SchoolClassDto } from '../../../shared/types';

const props = defineProps<{
  course: CourseDto;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const classes = ref<SchoolClassDto[]>([]);
const targetClassId = ref('');
const submitting = ref(false);
const error = ref('');

onMounted(async () => {
  classes.value = await window.grdr.class.list();
});

async function handleClone(): Promise<void> {
  error.value = '';
  submitting.value = true;
  try {
    const result = await window.grdr.course.clone(props.course.id, targetClassId.value);
    if (!result.ok) {
      error.value = result.error.message;
      return;
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
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
}

h3 {
  margin-bottom: 16px;
  font-size: 18px;
}

.source-info {
  background: #f9fafb;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.6;
}

.text-secondary {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-style: italic;
  margin-top: 4px;
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

select {
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

select:focus {
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
