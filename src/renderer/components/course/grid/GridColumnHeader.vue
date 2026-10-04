<template>
  <div
    role="columnheader"
    :class="['column-header', { 'column-header--selected': selected }]"
    :tabindex="tabbable ? 0 : -1"
    :aria-label="label"
    :title="`${column.title} · ${column.categoryTitle}`"
    :data-grid-pos="`-1,${col}`"
    :data-column-id="column.assessmentId"
    @contextmenu.prevent="emit('menu', $event)"
  >
    <span class="title">{{ column.title }}</span>
    <span class="meta">{{ column.gradingType === 'NUMERIC' ? `/ ${column.maxPoints}` : '+ ~ −' }}</span>
    <button class="more" type="button" tabindex="-1" aria-hidden="true" title="Menü" @click.stop="emit('menu', $event)">
      <span></span><span></span><span></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { GridColumn } from '../../../utils/sessionGridModel';

defineProps<{ column: GridColumn; label: string; col: number; selected: boolean; tabbable: boolean }>();
const emit = defineEmits<{ menu: [event: MouseEvent] }>();
</script>

<style scoped>
.column-header {
  position: relative;
  box-sizing: border-box;
  width: var(--grid-cell-w);
  height: var(--grid-header-h);
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 0 4px;
  background: #f9fafb;
  text-align: center;
  outline: none;
  user-select: none;
}

.title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 100%;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.15;
  overflow-wrap: break-word;
}

.meta {
  font-size: 10px;
  color: var(--color-text-secondary);
}

.column-header:hover {
  background: #f3f4f6;
}

.column-header--selected,
.column-header:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.more {
  position: absolute;
  right: 3px;
  bottom: 4px;
  display: none;
  gap: 2px;
  padding: 3px;
  background: none;
  border: none;
  cursor: pointer;
}

.more span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-secondary);
}

.column-header:hover .more,
.column-header--selected .more {
  display: flex;
}
</style>
