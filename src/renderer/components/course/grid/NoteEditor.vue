<template>
  <FloatingPanel :anchor="anchor" @close="emit('close')">
    <form class="editor" role="dialog" :aria-label="`Notiz: ${cell.title}`" @submit.prevent="emit('save', text)" @keydown.ctrl.enter.prevent="emit('save', text)" @keydown.meta.enter.prevent="emit('save', text)">
      <div class="caption">Notiz · {{ studentName }} · {{ cell.title }}</div>
      <textarea
        v-model="text"
        class="text"
        rows="4"
        maxlength="2000"
        placeholder="Notiz eingeben…"
        aria-label="Notiztext"
        data-autofocus
      ></textarea>
      <div class="actions">
        <button v-if="cell.hasNote" type="button" class="link link--danger" @click="emit('remove')">Notiz löschen</button>
        <span class="spacer"></span>
        <button type="button" class="btn btn-secondary" @click="emit('close')">Abbrechen</button>
        <button type="submit" class="btn btn-primary" :disabled="text.trim() === '' && !cell.hasNote">Speichern</button>
      </div>
    </form>
  </FloatingPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { GridCell } from '../../../utils/sessionGridModel';
import type { PanelAnchor } from '../../../utils/panelAnchor';
import FloatingPanel from './FloatingPanel.vue';

const props = defineProps<{ cell: GridCell; studentName: string; anchor: PanelAnchor }>();
const emit = defineEmits<{ save: [text: string]; remove: []; close: [] }>();

const text = ref(props.cell.noteText ?? '');
</script>

<style scoped>
.editor {
  width: 320px;
  padding: 14px 16px;
}

.caption {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.text {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
  color: var(--color-text);
  resize: vertical;
}

.text:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.spacer {
  flex: 1;
}

.link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.link--danger {
  color: var(--color-danger);
}

.btn {
  padding: 7px 14px;
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

.btn-primary:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}
</style>
