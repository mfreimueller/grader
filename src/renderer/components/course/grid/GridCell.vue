<template>
  <div
    ref="root"
    role="gridcell"
    :class="['cell', `cell--${cell.kind}`, symbolClass, { 'cell--note': cell.hasNote, 'cell--locked': cell.locked, 'cell--selected': selected, 'cell--editing': editing }]"
    :tabindex="tabbable ? 0 : -1"
    :aria-label="label"
    :aria-readonly="cell.locked || undefined"
    :data-grid-pos="`${row},${col}`"
    :data-cell-key="cell.key"
    @click="onClick"
    @contextmenu.prevent="emit('menu', $event)"
    @mouseenter="emit('hover', true)"
    @mouseleave="emit('hover', false)"
    @focus="emit('hover', true)"
    @blur="emit('hover', false)"
  >
    <template v-if="editing">
      <input
        ref="input"
        v-model="draft"
        class="edit-input"
        inputmode="numeric"
        autocomplete="off"
        :aria-label="`${label} — Punkte eingeben`"
        :aria-invalid="parsed.kind === 'invalid' || undefined"
        @keydown.stop="onEditKey"
        @blur="onEditBlur"
      />
      <span :class="['hint', { 'hint--invalid': parsed.kind === 'invalid' }]" role="status">
        {{ parsed.kind === 'invalid' ? parsed.message : `max. ${cell.maxPoints}` }}
      </span>
    </template>
    <template v-else>
      <span v-if="cell.kind === 'symbol' && cell.symbol" class="value value--symbol">{{ symbolGlyph(cell.symbol) }}</span>
      <span v-else-if="cell.kind === 'points'" class="value value--points">{{ cell.points }}</span>
      <svg v-if="cell.isImpromptu" class="bolt" viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
        <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" fill="#F59E0B" />
      </svg>
      <span v-if="cell.hasNote" class="note-corner" aria-hidden="true"></span>
      <button v-if="!cell.locked" class="more" type="button" tabindex="-1" aria-hidden="true" title="Menü" @click.stop="emit('menu', $event)">
        <span></span><span></span><span></span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { GridCell } from '../../../utils/sessionGridModel';
import { symbolGlyph } from '../../../utils/sessionGridLabels';
import { parsePoints, type CommitDirection } from '../../../utils/sessionGridInput';

const props = defineProps<{
  cell: GridCell;
  label: string;
  row: number;
  col: number;
  selected: boolean;
  tabbable: boolean;
  editing: boolean;
  /** Text the editor starts with: the current points, or the digit that was typed to start editing. */
  editInitial: string;
}>();

const emit = defineEmits<{
  activate: [];
  menu: [event: MouseEvent];
  hover: [over: boolean];
  commit: [text: string, direction: CommitDirection];
  /** `refocus` is true when the user pressed Escape, false when the editor was left by clicking elsewhere. */
  cancel: [refocus: boolean];
}>();

const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const draft = ref('');
let finished = false;

const symbolClass = computed(() => (props.cell.symbol ? `cell--${props.cell.symbol.toLowerCase()}` : ''));
const parsed = computed(() => parsePoints(draft.value, props.cell.maxPoints ?? Number.MAX_SAFE_INTEGER));

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) return;
    finished = false;
    draft.value = props.editInitial;
    await nextTick();
    input.value?.focus();
    if (props.editInitial === '' || props.editInitial.length > 1) input.value?.select();
  },
  { immediate: true },
);

function onClick(): void {
  if (!props.editing) emit('activate');
}

function finish(text: string, direction: CommitDirection): void {
  finished = true;
  emit('commit', text, direction);
}

function onEditKey(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (parsed.value.kind !== 'invalid') finish(draft.value, 'down');
  } else if (event.key === 'Tab') {
    event.preventDefault();
    if (parsed.value.kind !== 'invalid') finish(draft.value, event.shiftKey ? 'left' : 'right');
  } else if (event.key === 'Escape') {
    event.preventDefault();
    finished = true;
    emit('cancel', true);
  }
}

function onEditBlur(): void {
  if (finished) return;
  finished = true;
  if (parsed.value.kind === 'invalid' || draft.value.trim() === props.editInitial.trim()) emit('cancel', false);
  else emit('commit', draft.value, 'stay');
}

defineExpose({ focus: () => root.value?.focus() });
</script>

<style scoped>
.cell {
  --note-tint: rgba(26, 115, 232, 0.12);
  position: relative;
  box-sizing: border-box;
  width: var(--grid-cell-w);
  height: var(--grid-cell-h);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  outline: none;
}

.cell::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--note-tint);
  opacity: 0;
  pointer-events: none;
}

.cell--note::before {
  opacity: 1;
}

.value {
  position: relative;
  line-height: 1;
}

.value--symbol {
  font-size: 18px;
}

.value--points {
  font-size: 14px;
}

.cell--plus .value {
  color: var(--color-success);
}

.cell--welle .value {
  color: var(--color-text-secondary);
}

.cell--minus .value {
  color: var(--color-danger);
}

.cell--locked {
  background: #f9fafb;
  cursor: default;
}

.cell--locked .value {
  opacity: 0.4;
}

.cell:hover:not(.cell--locked):not(.cell--selected) {
  box-shadow: inset 0 0 0 1px var(--grid-border-strong);
}

.cell--selected,
.cell:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
  z-index: 1;
}

.bolt {
  position: absolute;
  top: 4px;
  left: 4px;
}

.note-corner {
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-top: 9px solid var(--color-primary);
  border-left: 9px solid transparent;
}

.more {
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 2px;
  align-items: center;
  padding: 4px 3px;
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

.cell:hover .more,
.cell--selected .more {
  display: flex;
}

.cell--editing {
  overflow: visible;
  z-index: 3;
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.cell--editing:has(.hint--invalid) {
  box-shadow: inset 0 0 0 2px var(--color-danger);
}

.edit-input {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  text-align: center;
  font: inherit;
  font-size: 14px;
  color: var(--color-text);
  outline: none;
}

.hint {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--color-sidebar-bg);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
}

.hint--invalid {
  background: var(--color-danger);
}
</style>
