<template>
  <div :class="['grid-row', { 'grid-row--absent': row.absent }]" role="row" :aria-rowindex="rowIndex + 2">
    <label class="anw" role="gridcell" :title="row.absent ? 'Abwesend' : 'Anwesend'">
      <input
        type="checkbox"
        :checked="!row.absent"
        :aria-label="`${row.displayName} anwesend`"
        @change="emit('absence', row.studentId, !($event.target as HTMLInputElement).checked)"
      />
    </label>
    <div class="student" role="rowheader">{{ row.displayName }}</div>

    <GridCell
      v-for="(cell, c) in row.sharedCells"
      :key="cell.key"
      :cell="cell"
      :label="cellAriaLabel(cell, row.displayName)"
      :row="rowIndex"
      :col="c"
      :selected="selectedCol === c"
      :tabbable="tabbableCol === c"
      :editing="editing?.key === cell.key"
      :edit-initial="editing?.key === cell.key ? editing.initial : ''"
      @activate="emit('activate', cell)"
      @menu="emit('menu', cell, $event)"
      @hover="emit('hover', cell, $event)"
      @commit="(text, direction) => emit('commit', cell, text, direction)"
      @cancel="(refocus) => emit('cancel', refocus)"
    />
    <div class="column-filler"></div>
    <div class="zone-divider"></div>
    <GridCell
      v-for="(cell, k) in row.impromptuCells"
      :key="cell.key"
      :cell="cell"
      :label="cellAriaLabel(cell, row.displayName)"
      :row="rowIndex"
      :col="columnCount + k"
      :selected="selectedCol === columnCount + k"
      :tabbable="tabbableCol === columnCount + k"
      :editing="editing?.key === cell.key"
      :edit-initial="editing?.key === cell.key ? editing.initial : ''"
      @activate="emit('activate', cell)"
      @menu="emit('menu', cell, $event)"
      @hover="emit('hover', cell, $event)"
      @commit="(text, direction) => emit('commit', cell, text, direction)"
      @cancel="(refocus) => emit('cancel', refocus)"
    />
    <GridAddCell
      variant="row"
      :label="`Spontane Leistung für ${row.displayName} erfassen`"
      :row="rowIndex"
      :col="columnCount + row.impromptuCells.length"
      :selected="selectedCol === columnCount + row.impromptuCells.length"
      :tabbable="tabbableCol === columnCount + row.impromptuCells.length"
      :disabled="row.absent"
      @activate="emit('rowAdd', row.studentId)"
    />
    <div class="row-fill"></div>
  </div>
</template>

<script setup lang="ts">
import type { GridCell as GridCellModel, GridRow } from '../../../utils/sessionGridModel';
import type { CommitDirection } from '../../../utils/sessionGridInput';
import { cellAriaLabel } from '../../../utils/sessionGridLabels';
import GridCell from './GridCell.vue';
import GridAddCell from './GridAddCell.vue';

defineProps<{
  row: GridRow;
  rowIndex: number;
  /** Number of shared columns; the row's impromptu cells and its add cell continue after them. */
  columnCount: number;
  selectedCol: number | null;
  tabbableCol: number | null;
  editing: { key: string; initial: string } | null;
}>();

const emit = defineEmits<{
  activate: [cell: GridCellModel];
  menu: [cell: GridCellModel, event: MouseEvent];
  hover: [cell: GridCellModel, over: boolean];
  commit: [cell: GridCellModel, text: string, direction: CommitDirection];
  cancel: [refocus: boolean];
  rowAdd: [studentId: string];
  absence: [studentId: string, absent: boolean];
}>();
</script>

<style scoped>
.grid-row {
  display: flex;
  gap: 1px;
  background: var(--color-border);
}

.anw {
  position: sticky;
  left: 0;
  z-index: 2;
  box-sizing: border-box;
  width: 44px;
  height: var(--grid-cell-h);
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
}

.anw input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.student {
  position: sticky;
  left: 45px;
  z-index: 2;
  box-sizing: border-box;
  width: 176px;
  height: var(--grid-cell-h);
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background: var(--color-surface);
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.grid-row--absent .anw,
.grid-row--absent .student {
  background: #f9fafb;
}

.grid-row--absent .student {
  font-weight: 400;
  color: var(--color-text-secondary);
}

.column-filler {
  width: var(--grid-cell-w);
  height: var(--grid-cell-h);
  flex: none;
  background: #f9fafb;
}

.zone-divider {
  width: 3px;
  height: var(--grid-cell-h);
  flex: none;
  background: var(--grid-border-strong);
}

.row-fill {
  flex: 1;
  min-width: 20px;
  height: var(--grid-cell-h);
  background: var(--color-surface);
}
</style>
