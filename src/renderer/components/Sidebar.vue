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
    </nav>
  </aside>
</template>

<script setup lang="ts">
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
</style>
