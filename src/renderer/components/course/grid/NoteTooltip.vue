<template>
  <Teleport to="body">
    <div ref="tip" id="grid-note-tooltip" class="tooltip" role="tooltip" :style="{ left: `${left}px`, top: `${top}px` }">
      <div class="text">{{ cell.noteText }}</div>
      <div class="meta">{{ meta }}</div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import type { GridCell } from '../../../utils/sessionGridModel';
import type { PanelAnchor } from '../../../utils/panelAnchor';

const props = defineProps<{ cell: GridCell; anchor: PanelAnchor; sessionDate: string | null }>();

const tip = ref<HTMLElement | null>(null);
const left = ref(props.anchor.x);
const top = ref(props.anchor.y + props.anchor.height + 6);

const meta = computed(() => [props.cell.title, props.cell.categoryTitle, props.sessionDate].filter((p) => p).join(' · '));

onMounted(async () => {
  await nextTick();
  const rect = tip.value?.getBoundingClientRect();
  if (!rect) return;
  left.value = Math.max(8, Math.min(props.anchor.x, window.innerWidth - rect.width - 8));
  const below = props.anchor.y + props.anchor.height + 6;
  top.value = below + rect.height > window.innerHeight - 8 ? Math.max(8, props.anchor.y - rect.height - 6) : below;
});
</script>

<style scoped>
.tooltip {
  position: fixed;
  z-index: 1150;
  max-width: 260px;
  padding: 9px 12px;
  border-radius: 6px;
  background: var(--color-sidebar-bg);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}

.text {
  font-size: 12.5px;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.meta {
  margin-top: 4px;
  font-size: 11px;
  color: #94a3b8;
}
</style>
