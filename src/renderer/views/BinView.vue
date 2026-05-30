<template>
  <div class="bin-view">
    <div class="toolbar">
      <h2>Papierkorb</h2>
      <div class="toolbar-actions">
        <button class="btn btn-danger" :disabled="isEmpty" @click="confirmEmpty">
          Papierkorb leeren
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">Lade Papierkorb...</div>

    <div v-else-if="isEmpty" class="empty">
      Der Papierkorb ist leer.
    </div>

    <div v-else class="bin-groups">
      <div v-if="data.students.length > 0" class="bin-group">
        <h3 class="group-header">Schüler ({{ data.students.length }})</h3>
        <table class="bin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Klasse</th>
              <th>Gelöscht am</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in data.students" :key="s.id">
              <td>{{ s.lastName }}, {{ s.firstName }}</td>
              <td>{{ s.className }}</td>
              <td>{{ formatDate(s.deletedAt) }}</td>
              <td class="col-actions">
                <button class="btn btn-small btn-secondary" @click="restore('student', s.id)">
                  Wiederherstellen
                </button>
                <button class="btn btn-small btn-danger" @click="confirmHardDelete('student', s)">
                  Endgültig löschen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data.classes.length > 0" class="bin-group">
        <h3 class="group-header">Klassen ({{ data.classes.length }})</h3>
        <table class="bin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Schuljahr</th>
              <th>Gelöscht am</th>
              <th class="col-actions">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in data.classes" :key="c.id">
              <td>{{ c.name }}</td>
              <td>{{ c.schoolYear }}</td>
              <td>{{ formatDate(c.deletedAt) }}</td>
              <td class="col-actions">
                <button class="btn btn-small btn-secondary" @click="restore('class', c.id)">
                  Wiederherstellen
                </button>
                <button class="btn btn-small btn-danger" @click="confirmHardDelete('class', c)">
                  Endgültig löschen
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="confirmMsg" class="overlay" @click.self="confirmMsg = null">
        <div class="confirm-dialog">
          <h3>Bestätigung</h3>
          <p>{{ confirmMsg }}</p>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="confirmMsg = null">Abbrechen</button>
            <button class="btn btn-danger" @click="onConfirm">Bestätigen</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { BinListDto, DeletedStudentDto, DeletedClassDto } from '../../shared/types';

const data = ref<BinListDto>({ students: [], classes: [] });
const loading = ref(true);
const confirmMsg = ref<string | null>(null);
let pendingAction: (() => Promise<void>) | null = null;

const isEmpty = computed(() => data.value.students.length === 0 && data.value.classes.length === 0);

onMounted(async () => {
  await loadBin();
});

async function loadBin(): Promise<void> {
  loading.value = true;
  try {
    data.value = await window.grdr.bin.listAll();
  } finally {
    loading.value = false;
  }
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function restore(type: 'student' | 'class', id: string): Promise<void> {
  try {
    await window.grdr.bin.restore(type, id);
    await loadBin();
  } catch (err: unknown) {
    alert('Fehler beim Wiederherstellen: ' + (err instanceof Error ? err.message : String(err)));
  }
}

function confirmHardDelete(type: 'student' | 'class', item: DeletedStudentDto | DeletedClassDto): void {
  const label = type === 'student'
    ? `"${(item as DeletedStudentDto).lastName}, ${(item as DeletedStudentDto).firstName}"`
    : `"${(item as DeletedClassDto).name}"`;
  confirmMsg.value = `${label} endgültig löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`;
  pendingAction = async () => {
    await window.grdr.bin.hardDelete(type, item.id);
    await loadBin();
  };
}

function confirmEmpty(): void {
  confirmMsg.value = 'Den gesamten Papierkorb leeren? Alle gelöschten Einträge werden endgültig entfernt.';
  pendingAction = async () => {
    await window.grdr.bin.empty();
    await loadBin();
  };
}

async function onConfirm(): Promise<void> {
  confirmMsg.value = null;
  if (pendingAction) {
    try {
      await pendingAction();
    } catch (err: unknown) {
      alert('Fehler: ' + (err instanceof Error ? err.message : String(err)));
    }
    pendingAction = null;
  }
}
</script>

<style scoped>
.bin-view {
  padding: 24px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.toolbar h2 {
  font-size: 22px;
  font-weight: 600;
  color: #dc2626;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.bin-groups {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.group-header {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 2px solid #e5e7eb;
}

.bin-table {
  width: 100%;
  border-collapse: collapse;
}

.bin-table th,
.bin-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

.bin-table th {
  font-weight: 600;
  color: #6b7280;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.bin-table tbody tr:hover {
  background: #f9fafb;
}

.col-actions {
  white-space: nowrap;
  text-align: right;
}

.col-actions button + button {
  margin-left: 6px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-primary {
  background: #1a73e8;
  color: #fff;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading,
.empty {
  text-align: center;
  color: #9ca3af;
  padding: 48px 0;
  font-size: 16px;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  min-width: 360px;
  max-width: 480px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.confirm-dialog h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.confirm-dialog p {
  margin: 0 0 20px;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
