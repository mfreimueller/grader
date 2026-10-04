<template>
  <Teleport to="body">
    <div class="overlay" @click.self="emit('cancel')" @keydown.esc.prevent="emit('cancel')">
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h3 id="confirm-title">{{ title }}</h3>
        <p id="confirm-message">{{ message }}</p>
        <div class="actions">
          <button ref="cancelButton" type="button" class="btn btn-secondary" @click="emit('cancel')">Abbrechen</button>
          <button type="button" :class="['btn', danger ? 'btn-danger' : 'btn-primary']" @click="emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

defineProps<{ title: string; message: string; confirmLabel: string; danger?: boolean }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const cancelButton = ref<HTMLButtonElement | null>(null);
// The safe choice has the focus, so an accidental Enter never destroys data.
onMounted(() => cancelButton.value?.focus());
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.dialog {
  width: 420px;
  max-width: 90vw;
  padding: 24px;
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid transparent;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-danger {
  background: var(--color-danger);
  color: #fff;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
