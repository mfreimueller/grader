<template>
  <div role="gridcell" :class="['add-cell', `add-cell--${variant}`]">
    <button
      type="button"
      :class="['add-button', { 'add-button--selected': selected }]"
      :tabindex="tabbable ? 0 : -1"
      :aria-disabled="disabled || undefined"
      :aria-label="label"
      :title="label"
      :data-grid-pos="`${row},${col}`"
      @click="onClick"
    >
      +
    </button>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  variant: 'header' | 'row';
  label: string;
  row: number;
  col: number;
  selected: boolean;
  tabbable: boolean;
  disabled: boolean;
}>();
const emit = defineEmits<{ activate: [] }>();

// aria-disabled instead of disabled: the cell must stay focusable, or arrow navigation would lose its place.
function onClick(): void {
  if (!props.disabled) emit('activate');
}
</script>

<style scoped>
.add-cell {
  box-sizing: border-box;
  width: var(--grid-cell-w);
  flex: none;
  display: flex;
}

.add-cell--row {
  height: var(--grid-cell-h);
}

.add-cell--header {
  height: var(--grid-header-h);
}

.add-button {
  width: 100%;
  height: 100%;
  border: none;
  font: inherit;
  font-size: 18px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  cursor: pointer;
  outline: none;
}

.add-cell--header .add-button {
  background: #f9fafb;
}

.add-button:hover:not([aria-disabled='true']) {
  color: var(--color-primary);
  background: rgba(26, 115, 232, 0.08);
}

.add-button--selected,
.add-button:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.add-button[aria-disabled='true'] {
  opacity: 0.35;
  cursor: default;
}
</style>
