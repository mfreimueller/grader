<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1 class="sidebar-title">Grader</h1>
    </div>
    <nav class="sidebar-nav">
      <router-link to="/courses" class="nav-item" active-class="nav-item--active">
        <span class="nav-icon">📋</span>
        <span>Kurse</span>
      </router-link>
      <router-link to="/students" class="nav-item" active-class="nav-item--active">
        <span class="nav-icon">👤</span>
        <span>Schüler</span>
      </router-link>
      <router-link to="/classes" class="nav-item" active-class="nav-item--active">
        <span class="nav-icon">🏫</span>
        <span>Klassen</span>
      </router-link>
      <router-link to="/reports" class="nav-item" active-class="nav-item--active">
        <span class="nav-icon">📄</span>
        <span>Berichte</span>
      </router-link>
      <router-link to="/bin" class="nav-item" active-class="nav-item--active">
        <span class="nav-icon">🗑️</span>
        <span>Papierkorb</span>
      </router-link>
    </nav>
    <div class="sidebar-footer">
      <div class="mcp-status" :class="{ 'mcp-status--active': mcpRunning }">
        <span class="mcp-dot"></span>
        <span class="mcp-label">MCP</span>
        <span v-if="mcpUrl" class="mcp-url">{{ mcpUrl }}</span>
        <span v-else class="mcp-url">inaktiv</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const mcpRunning = ref(false);
const mcpUrl = ref<string | null>(null);
let cleanup: (() => void) | undefined;

onMounted(async () => {
  const url = await window.grdr.mcp.getUrl();
  mcpRunning.value = url !== null;
  mcpUrl.value = url;

  cleanup = window.grdr.mcp.onStatusChange((status) => {
    mcpRunning.value = status.running;
    mcpUrl.value = status.url;
  });
});

onUnmounted(() => {
  cleanup?.();
});
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100%;
  background: var(--color-sidebar-bg);
  color: var(--color-sidebar-text);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  color: var(--color-sidebar-text);
  text-decoration: none;
  font-size: 14px;
  transition: background 0.15s;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.nav-item--active {
  background: var(--color-sidebar-active);
  color: #ffffff;
  font-weight: 600;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.mcp-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.mcp-status--active {
  color: rgba(255, 255, 255, 0.8);
}

.mcp-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.mcp-status--active .mcp-dot {
  background: #22c55e;
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
}

.mcp-label {
  font-weight: 600;
  flex-shrink: 0;
}

.mcp-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 11px;
}
</style>
