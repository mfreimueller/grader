<template>
  <Teleport to="body">
    <div
      ref="panel"
      class="floating-panel"
      :style="{ left: `${left}px`, top: `${top}px` }"
      tabindex="-1"
      @keydown="onKeydown"
    >
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { PanelAnchor } from '../../../utils/panelAnchor';

const props = withDefaults(defineProps<{ anchor: PanelAnchor; gap?: number | undefined }>(), { gap: 4 });
const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
const left = ref(props.anchor.x);
const top = ref(props.anchor.y + props.anchor.height + props.gap);

const MARGIN = 8;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]';

function place(): void {
  const el = panel.value;
  if (!el) return;
  const { width, height } = el.getBoundingClientRect();
  left.value = Math.max(MARGIN, Math.min(props.anchor.x, window.innerWidth - width - MARGIN));
  const below = props.anchor.y + props.anchor.height + props.gap;
  top.value = below + height > window.innerHeight - MARGIN ? Math.max(MARGIN, props.anchor.y - height - props.gap) : below;
}

function onPointerDown(event: PointerEvent): void {
  if (!panel.value?.contains(event.target as Node)) emit('close');
}

function onDocumentKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
  }
}

/** Tab cycles inside the panel, so focus cannot wander back into the grid behind it. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !panel.value) return;
  const items = [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  await nextTick();
  place();
  const target = panel.value?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.value?.querySelector<HTMLElement>(FOCUSABLE) ?? panel.value;
  target?.focus();
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onDocumentKey, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('keydown', onDocumentKey, true);
});
</script>

<style scoped>
.floating-panel {
  position: fixed;
  z-index: 1100;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  outline: none;
}
</style>
