<template>
  <Teleport to="body">
    <div class="toast" role="status" aria-live="polite">
      <span>Leistung „{{ title }}“ gelöscht<template v-if="more > 0"> (+{{ more }})</template></span>
      <button type="button" class="undo" @click="emit('undo')">Rückgängig</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ title: string; more: number }>();
const emit = defineEmits<{ undo: [] }>();
</script>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 1300;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 8px 8px 16px;
  border-radius: 8px;
  background: var(--color-sidebar-bg);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  transform: translateX(-50%);
}

.undo {
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.undo:hover {
  background: rgba(255, 255, 255, 0.24);
}

.undo:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
</style>
