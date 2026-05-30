<template>
  <Teleport to="body">
    <div class="overlay" @click.self="$emit('cancel')">
      <div class="format-dialog">
        <h3>{{ title }}</h3>
        <p class="format-description">Die CSV-Datei muss folgende Spalten enthalten (Semikolon-getrennt):</p>
        <table class="format-table">
          <thead>
            <tr>
              <th></th>
              <th>Spalte</th>
              <th>Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(col, i) in columns" :key="i">
              <td class="col-num">{{ i + 1 }}.</td>
              <td class="col-name">{{ col.name }}</td>
              <td class="col-desc">{{ col.desc }}</td>
            </tr>
          </tbody>
        </table>
        <div class="example-section">
          <strong>Beispielzeile:</strong>
          <pre class="example-csv">{{ example }}</pre>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" v-model="hasHeader" />
          Erste Zeile ist eine Kopfzeile (Header)
        </label>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="$emit('cancel')">Abbrechen</button>
          <button class="btn btn-primary" @click="$emit('confirm', hasHeader)">Weiter</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  title: string;
  columns: { name: string; desc: string }[];
  example: string;
}>();

const emit = defineEmits<{
  confirm: [hasHeader: boolean];
  cancel: [];
}>();

const hasHeader = ref(true);
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

.format-dialog {
  background: var(--color-surface);
  border-radius: 8px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.format-dialog h3 {
  margin-bottom: 12px;
  font-size: 16px;
}

.format-description {
  font-size: 14px;
  margin-bottom: 12px;
  color: var(--color-text-secondary);
}

.format-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 13px;
}

.format-table th {
  text-align: left;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
}

.format-table td {
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border);
}

.col-num {
  width: 28px;
  color: var(--color-text-secondary);
  vertical-align: top;
}

.col-name {
  width: 140px;
  font-weight: 600;
  vertical-align: top;
}

.col-desc {
  color: var(--color-text-secondary);
  vertical-align: top;
}

.example-section {
  margin-bottom: 16px;
}

.example-section strong {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}

.example-csv {
  background: #f3f4f6;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 13px;
  overflow-x: auto;
  white-space: pre;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 16px;
  cursor: pointer;
}

.checkbox-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
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

.btn-secondary:hover {
  background: #f3f4f6;
}
</style>
