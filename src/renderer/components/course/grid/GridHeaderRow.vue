<template>
  <div class="grid-row grid-row--header" role="row">
    <div class="head head--anw" role="columnheader" title="Anwesend">ANW.</div>
    <button class="head head--student" type="button" role="columnheader" @click="emit('toggleSort')">
      SCHÜLER {{ sortAscending ? '▲' : '▼' }}
    </button>
    <GridColumnHeader
      v-for="(column, c) in columns"
      :key="column.assessmentId"
      :column="column"
      :label="columnAriaLabel(column)"
      :col="c"
      :selected="selectedCol === c"
      :tabbable="tabbableCol === c"
      @menu="emit('columnMenu', column, $event)"
    />
    <GridAddCell
      variant="header"
      label="Neue Leistung für alle Schüler"
      :row="-1"
      :col="columns.length"
      :selected="selectedCol === columns.length"
      :tabbable="tabbableCol === columns.length"
      :disabled="false"
      @activate="emit('headerAdd')"
    />
    <div class="zone-divider"></div>
    <div class="head head--zone">
      <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" fill="#F59E0B" /></svg>
      SPONTANE LEISTUNGEN
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GridColumn } from '../../../utils/sessionGridModel';
import { columnAriaLabel } from '../../../utils/sessionGridLabels';
import GridColumnHeader from './GridColumnHeader.vue';
import GridAddCell from './GridAddCell.vue';

defineProps<{
  columns: readonly GridColumn[];
  sortAscending: boolean;
  /** Column drawn as selected in the header row, or null. */
  selectedCol: number | null;
  /** Column that is the tab stop of the header row, or null. */
  tabbableCol: number | null;
}>();
const emit = defineEmits<{ toggleSort: []; columnMenu: [column: GridColumn, event: MouseEvent]; headerAdd: [] }>();
</script>

<style scoped>
.grid-row {
  display: flex;
  gap: 1px;
  background: var(--color-border);
}

.grid-row--header {
  position: sticky;
  top: 0;
  z-index: 4;
}

.head {
  box-sizing: border-box;
  height: var(--grid-header-h);
  flex: none;
  display: flex;
  align-items: center;
  padding: 0 10px;
  background: #f9fafb;
  border: none;
  font: inherit;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: var(--color-text-secondary);
}

.head--anw {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 44px;
  justify-content: center;
  padding: 0;
  font-size: 10px;
}

.head--student {
  position: sticky;
  left: 45px;
  z-index: 3;
  width: 176px;
  cursor: pointer;
  text-align: left;
}

.head--zone {
  flex: 1;
  min-width: 145px;
  gap: 6px;
}

.zone-divider {
  width: 3px;
  height: var(--grid-header-h);
  flex: none;
  background: var(--grid-border-strong);
}
</style>
