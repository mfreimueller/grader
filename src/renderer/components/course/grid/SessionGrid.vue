<template>
  <div ref="root" class="session-grid" @keydown="ui.onKeydown" @focusin="focus.onFocusin" @focusout="focus.onFocusout">
    <div v-if="errorMessage && ui.overlay.value?.type !== 'new-assessment'" class="error-banner" role="alert">
      <span>{{ errorMessage }}</span>
      <button type="button" class="error-close" aria-label="Meldung schließen" @click="errorMessage = ''">✕</button>
    </div>

    <div v-if="loading" class="state">Lade Daten...</div>
    <div v-else-if="model.rows.length === 0" class="state">Keine Schüler in diesem Kurs.</div>

    <div v-else class="grid-scroll">
      <div class="grid" role="grid" aria-label="Leistungen der Sitzung" :aria-rowcount="model.rows.length + 1">
        <GridHeaderRow
          :columns="model.columns"
          :sort-ascending="sortAscending"
          :selected-col="selectedCol(-1)"
          :tabbable-col="tabbableCol(-1)"
          @toggle-sort="sortAscending = !sortAscending"
          @column-menu="ui.onColumnMenu"
          @header-add="ui.onHeaderAdd"
        />
        <GridBodyRow
          v-for="(row, r) in model.rows"
          :key="row.studentId"
          :row="row"
          :row-index="r"
          :column-count="model.columns.length"
          :selected-col="selectedCol(r)"
          :tabbable-col="tabbableCol(r)"
          :editing="ui.editing.value"
          @activate="ui.activate"
          @menu="ui.onCellMenu"
          @hover="ui.onHover"
          @commit="ui.commitEdit"
          @cancel="ui.cancelEdit"
          @row-add="ui.onRowAdd"
          @absence="setAbsence"
        />
      </div>
    </div>

    <GridLegend v-if="!loading && model.rows.length > 0" />

    <GridOverlays
      :overlay="ui.overlay.value"
      :tooltip="ui.tooltip.value"
      :confirmation="ui.confirmation.value"
      :impromptu-student="ui.impromptuStudent.value"
      :categories="categories"
      :error-message="errorMessage"
      :creating="ui.creating.value"
      :pending-delete="pendingDelete"
      :pending-count="pendingCount"
      :session-date="formattedDate"
      :course-id="courseId"
      :session-id="sessionId"
      @pick="ui.pick"
      @close="ui.closeOverlay"
      @create-assessment="ui.createAssessment"
      @select-cell-action="ui.selectCellAction"
      @delete-column="ui.requestDeleteColumn"
      @save-note="ui.saveNote"
      @close-impromptu="ui.closeImpromptu"
      @impromptu-saved="ui.impromptuSaved"
      @undo="undoDelete"
      @confirmed="ui.confirmed"
      @dismissed="ui.dismissed"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSessionGrid } from '../../../controllers/useSessionGrid';
import { useGridFocus } from '../../../controllers/useGridFocus';
import { useSessionGridInteractions } from '../../../controllers/useSessionGridInteractions';
import GridHeaderRow from './GridHeaderRow.vue';
import GridBodyRow from './GridBodyRow.vue';
import GridLegend from './GridLegend.vue';
import GridOverlays from './GridOverlays.vue';

const props = defineProps<{ courseId: string; sessionId: string; sessionDate?: string }>();

const grid = useSessionGrid(props.courseId, props.sessionId);
const { loading, errorMessage, sortAscending, model, categories, pendingDelete, pendingCount, load, setAbsence, undoDelete } = grid;

const root = ref<HTMLElement | null>(null);
const focus = useGridFocus(root, model);
const ui = useSessionGridInteractions(grid, focus);

const formattedDate = computed(() =>
  props.sessionDate ? new Date(props.sessionDate).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null,
);

/** The column drawn as selected in a row (-1 is the header row), or null. */
const selectedCol = (row: number): number | null =>
  ui.selectionVisible.value && focus.nav.value.position.row === row ? focus.nav.value.position.col : null;
/** The column that is the tab stop of a row, or null: exactly one position in the whole grid is tabbable. */
const tabbableCol = (row: number): number | null => (focus.nav.value.position.row === row ? focus.nav.value.position.col : null);

onMounted(load);
</script>

<style scoped>
.session-grid {
  --grid-cell-w: 72px;
  --grid-cell-h: 36px;
  --grid-header-h: 44px;
  --grid-border-strong: #d1d5db;
  font-size: 13px;
}

.state {
  padding: 16px 0;
  color: var(--color-text-secondary);
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #fef2f2;
  color: var(--color-danger);
}

.error-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
}

.grid-scroll {
  overflow: auto;
  max-height: 70vh;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: max-content;
  min-width: 100%;
  background: var(--color-border);
}
</style>
