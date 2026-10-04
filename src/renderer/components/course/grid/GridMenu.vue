<template>
  <FloatingPanel :anchor="anchor" :gap="gap" @close="emit('close')">
    <div class="menu" role="menu" :aria-label="label" @keydown="onKey">
      <template v-for="entry in entries" :key="entry.action">
        <div v-if="entry.separatorBefore" class="separator" role="separator"></div>
        <button
          type="button"
          role="menuitem"
          :class="['item', { 'item--danger': entry.danger }]"
          :disabled="entry.disabled"
          :data-autofocus="entry.action === firstEnabled ? '' : undefined"
          @click="emit('select', entry.action)"
        >
          {{ entry.label }}
        </button>
      </template>
    </div>
  </FloatingPanel>
</template>

<script setup lang="ts" generic="A extends string">
import { computed } from 'vue';
import type { MenuEntry } from '../../../utils/sessionGridMenu';
import type { PanelAnchor } from '../../../utils/panelAnchor';
import FloatingPanel from './FloatingPanel.vue';

const props = withDefaults(defineProps<{ entries: MenuEntry<A>[]; anchor: PanelAnchor; label: string; gap?: number }>(), { gap: 4 });
const emit = defineEmits<{ select: [action: A]; close: [] }>();

const firstEnabled = computed(() => props.entries.find((e) => !e.disabled)?.action);

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Tab') {
    event.preventDefault();
    emit('close');
    return;
  }
  const items = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('.item:not(:disabled)')];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  let next: number | null = null;
  if (event.key === 'ArrowDown') next = (at + 1) % items.length;
  else if (event.key === 'ArrowUp') next = (at - 1 + items.length) % items.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
}
</script>

<style scoped>
.menu {
  min-width: 200px;
  padding: 6px 4px;
}

.item {
  display: block;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  text-align: left;
  color: var(--color-text);
  cursor: pointer;
}

.item:hover:not(:disabled),
.item:focus-visible {
  background: #f3f4f6;
  outline: none;
}

.item--danger {
  color: var(--color-danger);
}

.item:disabled {
  opacity: 0.4;
  cursor: default;
}

.separator {
  height: 1px;
  margin: 4px 0;
  background: var(--color-border);
}
</style>
