<template>
  <div ref="root" class="plugin-menu">
    <button
      class="btn btn-secondary"
      aria-haspopup="menu"
      :aria-expanded="open"
      data-testid="plugin-menu-button"
      @click="toggle"
    >
      Werkzeuge ▾
    </button>

    <div v-if="open" class="menu" role="menu" data-testid="plugin-menu">
      <p v-if="plugins.length === 0" class="empty">
        Keine Werkzeuge eingeschaltet. Plugins schalten Sie in den Einstellungen ein.
      </p>
      <button
        v-for="plugin in plugins"
        :key="plugin.id ?? plugin.directoryName"
        class="menu-item"
        role="menuitem"
        @click="start(plugin)"
      >
        <span class="name">{{ plugin.name }}</span>
        <span v-if="plugin.description" class="description">{{ plugin.description }}</span>
      </button>
    </div>

    <p v-if="error" class="error-msg" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import type { PluginInfo } from '../../../shared/plugin-catalog';

const props = defineProps<{ courseId: string }>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const plugins = ref<PluginInfo[]>([]);
const error = ref('');

// Read every time the menu opens: plugins may have been switched on or off in the settings meanwhile.
async function toggle(): Promise<void> {
  error.value = '';
  if (open.value) {
    open.value = false;
    return;
  }
  plugins.value = await window.grdr.plugin.launchable();
  open.value = true;
}

async function start(plugin: PluginInfo): Promise<void> {
  open.value = false;
  if (!plugin.id) return;
  const result = await window.grdr.plugin.launch(plugin.id, props.courseId);
  if (!result.ok) error.value = result.error.message;
}

function closeOnOutsideClick(event: MouseEvent): void {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick);
  document.addEventListener('keydown', closeOnEscape);
});

onUnmounted(() => {
  document.removeEventListener('click', closeOnOutsideClick);
  document.removeEventListener('keydown', closeOnEscape);
});
</script>

<style scoped>
.plugin-menu {
  position: relative;
}

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
  min-width: 240px;
  max-width: 320px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 4px;
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
}

.menu-item:hover,
.menu-item:focus-visible {
  background: #f3f4f6;
}

.name {
  font-size: 14px;
  font-weight: 500;
}

.description {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.empty {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.error-msg {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  width: 260px;
  color: var(--color-danger);
  font-size: 13px;
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

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-secondary:hover {
  background: #f3f4f6;
}
</style>
