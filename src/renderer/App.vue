<template>
  <div class="app-shell">
    <Sidebar />
    <main class="main-content">
      <router-view />
    </main>
    <SettingsModal :visible="showSettings" @close="showSettings = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import Sidebar from './components/Sidebar.vue';
import SettingsModal from './components/SettingsModal.vue';

const showSettings = ref(false);
let cleanupListener: (() => void) | undefined;

onMounted(() => {
  cleanupListener = window.grdr.settings.onOpenSettings(() => {
    showSettings.value = true;
  });
});

onUnmounted(() => {
  cleanupListener?.();
});
</script>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-bg: #f4f5f7;
  --color-surface: #ffffff;
  --color-primary: #1a73e8;
  --color-primary-hover: #1557b0;
  --color-text: #1f2937;
  --color-text-secondary: #6b7280;
  --color-border: #e5e7eb;
  --color-sidebar-bg: #1e293b;
  --color-sidebar-text: #e2e8f0;
  --color-sidebar-active: #1a73e8;
  --color-danger: #dc2626;
  --color-success: #16a34a;
  --sidebar-width: 240px;
  --header-height: 0px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg);
}

html, body, #app {
  height: 100%;
  width: 100%;
}

.app-shell {
  display: flex;
  height: 100%;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  margin-left: var(--sidebar-width);
}
</style>
