<template>
  <Teleport to="body">
    <div v-if="visible" class="overlay" @click.self="close">
      <div class="modal">
        <h3>Einstellungen</h3>

        <label class="form-label">Datenbankpfad</label>
        <div class="path-row">
          <input v-model="dbPath" type="text" class="form-input" readonly @click="pickPath" />
          <button class="btn btn-secondary" @click="pickPath">Durchsuchen</button>
        </div>
        <p class="hint">Wählen Sie einen Speicherort für die Datenbankdatei (grdr.db).</p>

        <hr class="separator" />

        <label class="form-label">MCP-Server</label>
        <div class="mcp-row">
          <label class="toggle-label">
            <input v-model="mcpEnabled" type="checkbox" class="toggle-input" @change="toggleMcp" />
            <span class="toggle-text">MCP-Server aktivieren</span>
          </label>
        </div>
        <p class="hint">
          Ermöglicht KI-Assistenten (z.&thinsp;B. Claude Desktop) den Zugriff auf Notendaten
          über den MCP-Read-Only-Server. Port: {{ mcpPort }}.
        </p>
        <p v-if="mcpUrl" class="mcp-url">Aktiv unter: <code>{{ mcpUrl }}</code></p>

        <p v-if="saveSuccess" class="success-msg">{{ saveSuccess }}</p>
        <p v-if="error" class="error-msg">{{ error }}</p>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="close">Schliessen</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const dbPath = ref('');
const saving = ref(false);
const saveSuccess = ref('');
const error = ref('');
const mcpEnabled = ref(false);
const mcpPort = ref(43882);
const mcpUrl = ref<string | null>(null);

watch(() => props.visible, async (open) => {
  if (open) {
    dbPath.value = await window.grdr.settings.getDbPath();
    const mcpSettings = await window.grdr.mcp.getSettings();
    mcpEnabled.value = mcpSettings.enabled;
    mcpPort.value = mcpSettings.port;
    mcpUrl.value = await window.grdr.mcp.getUrl();
    saveSuccess.value = '';
    error.value = '';
  }
});

function close(): void {
  if (!saving.value) {
    emit('close');
  }
}

async function pickPath(): Promise<void> {
  const path = await window.grdr.settings.pickDbPath();
  if (path) {
    dbPath.value = path;
  }
}

async function toggleMcp(): Promise<void> {
  error.value = '';
  saveSuccess.value = '';
  try {
    await window.grdr.mcp.setEnabled(mcpEnabled.value);
    mcpUrl.value = mcpEnabled.value ? await window.grdr.mcp.getUrl() : null;
    saveSuccess.value = mcpEnabled.value
      ? 'MCP-Server gestartet. Verbinden Sie Ihren KI-Assistenten mit der angezeigten URL.'
      : 'MCP-Server gestoppt.';
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Umschalten des MCP-Servers';
    mcpEnabled.value = !mcpEnabled.value;
  }
}

async function save(): Promise<void> {
  if (!dbPath.value) return;
  saving.value = true;
  error.value = '';
  saveSuccess.value = '';
  try {
    await window.grdr.settings.saveDbPath(dbPath.value);
    const restart = window.confirm(
      'Die Anwendung muss neu gestartet werden, um die neue Datenbank zu verwenden. Jetzt neu starten?',
    );
    if (restart) {
      await window.grdr.settings.restartApp();
    } else {
      saveSuccess.value = 'Pfad gespeichert. Starten Sie die Anwendung neu, um die Änderung zu übernehmen.';
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Speichern';
  } finally {
    saving.value = false;
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
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

h3 {
  margin-bottom: 20px;
  font-size: 18px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text);
}

.path-row {
  display: flex;
  gap: 8px;
}

.form-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}

.hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.separator {
  margin: 20px 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.mcp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.toggle-text {
  font-size: 14px;
}

.mcp-url {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-success);
}

.mcp-url code {
  font-size: 12px;
  padding: 2px 6px;
  background: var(--color-bg);
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
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

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.error-msg {
  color: var(--color-danger);
  margin-top: 8px;
  font-size: 13px;
}

.success-msg {
  color: var(--color-success);
  margin-top: 8px;
  font-size: 13px;
}
</style>
