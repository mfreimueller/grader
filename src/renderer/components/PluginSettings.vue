<template>
  <section class="plugins" aria-labelledby="plugins-label">
    <label id="plugins-label" class="form-label">Plugins</label>
    <p class="hint">
      Plugins sind zusätzliche Werkzeuge, die Sie aus einem Kurs heraus starten. Eigene Plugins werden erst nach Ihrer
      Zustimmung ausgeführt.
    </p>

    <p v-if="plugins.length === 0" class="hint">Keine Plugins gefunden.</p>

    <ul class="plugin-list">
      <li v-for="plugin in plugins" :key="plugin.id ?? plugin.directoryName" class="plugin" data-testid="plugin-row">
        <div class="plugin-head">
          <div class="plugin-title">
            <strong>{{ plugin.name }}</strong>
            <span v-if="plugin.version" class="version">{{ plugin.version }}</span>
            <span class="badge">{{ sourceLabel(plugin.source) }}</span>
            <span v-if="plugin.overrides" class="badge">ersetzt die mitgelieferte Version</span>
          </div>
          <span :class="['status', `status--${plugin.status}`]">{{ statusLabel(plugin.status) }}</span>
        </div>

        <p v-if="plugin.description" class="hint">{{ plugin.description }}</p>
        <p v-if="plugin.error" class="error-msg">{{ plugin.error }}</p>
        <p v-if="plugin.network.length > 0 && !(reviewing && reviewing.id === plugin.id)" class="hint">
          {{ plugin.network.map(describeNetwork).join('; ') }}
        </p>

        <div
          v-if="reviewing && reviewing.id === plugin.id"
          class="consent"
          role="group"
          :aria-label="`Berechtigungen von ${plugin.name}`"
          data-testid="plugin-consent"
        >
          <p v-if="plugin.status === 'needs-consent'">
            Das Plugin braucht mehr Berechtigungen als Sie bisher erlaubt haben.
          </p>
          <p>Dieses Plugin darf:</p>
          <ul>
            <li v-for="permission in plugin.permissions" :key="permission">{{ describePermission(permission) }}</li>
            <li v-for="origin in plugin.network" :key="origin" data-testid="plugin-network">
              {{ describeNetwork(origin) }}
            </li>
          </ul>
          <div class="consent-actions">
            <button class="btn btn-secondary" @click="reviewing = null">Abbrechen</button>
            <button class="btn btn-primary" @click="confirmReview">Erlauben und einschalten</button>
          </div>
        </div>

        <div v-else-if="toggleAction(plugin) !== 'none'" class="plugin-actions">
          <button class="btn btn-secondary" @click="toggle(plugin)">
            {{ toggleAction(plugin) === 'disable' ? 'Ausschalten' : 'Einschalten' }}
          </button>
        </div>
      </li>
    </ul>

    <div class="folder-row">
      <button class="btn btn-secondary" @click="openFolder">Plugin-Ordner öffnen</button>
      <button class="btn btn-secondary" @click="reload">Neu laden</button>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { PluginInfo } from '../../shared/plugin-catalog';
import { describeNetwork, describePermission, sourceLabel, statusLabel, toggleAction } from '../utils/pluginLabels';

const props = defineProps<{ visible: boolean }>();

const plugins = ref<PluginInfo[]>([]);
const reviewing = ref<PluginInfo | null>(null);
const error = ref('');

async function reload(): Promise<void> {
  plugins.value = await window.grdr.plugin.list();
}

watch(
  () => props.visible,
  (open) => {
    if (!open) return;
    reviewing.value = null;
    error.value = '';
    void reload();
  },
  { immediate: true },
);

async function apply(plugin: PluginInfo, enabled: boolean): Promise<void> {
  error.value = '';
  reviewing.value = null;
  if (plugin.id) {
    try {
      // What the user was shown is what is accepted; the main process refuses it if the plugin changed meanwhile.
      // A plain copy: a reactive array cannot be sent over IPC.
      const result = await window.grdr.plugin.setEnabled(
        plugin.id,
        enabled,
        [...plugin.permissions],
        [...plugin.network],
      );
      if (!result.ok) error.value = result.error.message;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Das Plugin konnte nicht umgeschaltet werden';
    }
  }
  await reload();
}

async function toggle(plugin: PluginInfo): Promise<void> {
  const action = toggleAction(plugin);
  if (action === 'review') reviewing.value = plugin;
  else if (action === 'enable') await apply(plugin, true);
  else if (action === 'disable') await apply(plugin, false);
}

async function confirmReview(): Promise<void> {
  if (reviewing.value) await apply(reviewing.value, true);
}

async function openFolder(): Promise<void> {
  await window.grdr.plugin.openFolder();
}
</script>

<style scoped>
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--color-text);
}

.hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.plugin-list {
  list-style: none;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 10px 12px;
}

.plugin-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.plugin-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.version {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--color-bg);
  color: var(--color-text-secondary);
}

.status {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status--enabled {
  color: var(--color-success);
}

.status--needs-consent,
.status--faulty {
  color: var(--color-danger);
}

.status--disabled {
  color: var(--color-text-secondary);
}

.plugin-actions {
  margin-top: 8px;
}

.consent {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--color-bg);
  font-size: 13px;
}

.consent ul {
  margin: 4px 0 0 18px;
}

.consent-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.folder-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.error-msg {
  color: var(--color-danger);
  margin-top: 6px;
  font-size: 13px;
}

.btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}
</style>
