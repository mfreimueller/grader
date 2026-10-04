// Interactions of the session grid: which popup is open, inline editing, the note tooltip and the keyboard.
// It turns user events into calls on the grid controller (useSessionGrid); the components only render state.

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { useSessionGrid, NewAssessmentInput } from './useSessionGrid';
import type { useGridFocus } from './useGridFocus';
import { parsePoints, resolveSymbolPick, symbolForKey, type CommitDirection } from '../utils/sessionGridInput';
import { cellMenu, type CellMenuAction } from '../utils/sessionGridMenu';
import { resultCount, type GridCell, type GridColumn, type GridSymbol } from '../utils/sessionGridModel';
import { targetAt, type NavigationTarget } from '../utils/sessionGridNavigation';
import type { PanelAnchor } from '../utils/panelAnchor';

export interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: () => void;
}

export type Overlay =
  | { type: 'picker'; cell: GridCell; studentName: string; anchor: PanelAnchor }
  | { type: 'menu'; cell: GridCell; anchor: PanelAnchor; gap: number }
  | { type: 'column-menu'; column: GridColumn; anchor: PanelAnchor; gap: number }
  | { type: 'note'; cell: GridCell; studentName: string; anchor: PanelAnchor }
  | { type: 'student-note'; studentId: string; studentName: string; text: string; anchor: PanelAnchor }
  | { type: 'new-assessment'; anchor: PanelAnchor };

const DIRECTION_KEYS: Readonly<Record<Exclude<CommitDirection, 'stay'>, string>> = { down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const NAVIGATION_KEYS: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
const TOOLTIP_DELAY_MS = 350;

export function useSessionGridInteractions(grid: ReturnType<typeof useSessionGrid>, focus: ReturnType<typeof useGridFocus>) {
  const { model, errorMessage } = grid;

  const overlay = ref<Overlay | null>(null);
  const confirmation = ref<Confirmation | null>(null);
  const tooltip = ref<{ cell: GridCell; anchor: PanelAnchor } | null>(null);
  const editing = ref<{ key: string; initial: string } | null>(null);
  const impromptuStudentId = ref<string | null>(null);
  const creating = ref(false);
  let hoverTimer: number | undefined;

  const impromptuStudent = computed(() => (impromptuStudentId.value ? grid.studentOf(impromptuStudentId.value) : null));
  const popupOpen = computed(
    () => overlay.value !== null || confirmation.value !== null || editing.value !== null || impromptuStudentId.value !== null,
  );
  /** The current position is drawn as selected while the focus is in the grid or one of its popups. */
  const selectionVisible = computed(() => focus.hasFocus.value || popupOpen.value);
  const nameOf = (studentId: string): string => model.value.rows.find((r) => r.studentId === studentId)?.displayName ?? '';

  watch(model, () => {
    tooltip.value = null;
  });
  watch(popupOpen, (open) => {
    if (open) tooltip.value = null;
  });
  onBeforeUnmount(() => window.clearTimeout(hoverTimer));

  function closeOverlay(): void {
    if (overlay.value?.type === 'new-assessment') errorMessage.value = '';
    overlay.value = null;
    focus.focusPosition();
  }

  // ---- results -------------------------------------------------------------------------------------------------

  /** Removes a student's result. The note hangs on it, so a note has to be confirmed away first. */
  function requestClear(cell: GridCell): void {
    if (cell.performanceId === null) return;
    if (!cell.hasNote) {
      void grid.clearResult(cell);
      return;
    }
    confirmation.value = {
      title: 'Ergebnis zurücksetzen?',
      message: `Mit dem Ergebnis von ${nameOf(cell.studentId)} geht auch die Notiz verloren.`,
      confirmLabel: 'Zurücksetzen',
      danger: true,
      action: () => void grid.clearResult(cell),
    };
  }

  function activate(cell: GridCell): void {
    if (cell.locked) return;
    if (cell.gradingType === 'TERTIARY') {
      overlay.value = { type: 'picker', cell, studentName: nameOf(cell.studentId), anchor: focus.anchorOfCell(cell) };
    } else {
      editing.value = { key: cell.key, initial: cell.points === null ? '' : String(cell.points) };
    }
  }

  function pick(symbol: GridSymbol): void {
    const current = overlay.value;
    overlay.value = null;
    if (current?.type === 'picker') {
      const next = resolveSymbolPick(current.cell.symbol, symbol);
      if (next === null) requestClear(current.cell);
      else void grid.setSymbol(current.cell, next);
    }
    // A confirmation takes the focus itself; moving it back to the cell would hide the question.
    if (!confirmation.value) focus.focusPosition();
  }

  function commitEdit(cell: GridCell, text: string, direction: CommitDirection): void {
    editing.value = null;
    if (direction === 'stay') focus.setPosition(focus.nav.value.position);
    else focus.move(DIRECTION_KEYS[direction]);
    const parsed = parsePoints(text, cell.maxPoints ?? Number.MAX_SAFE_INTEGER);
    if (parsed.kind === 'value' && parsed.points !== cell.points) void grid.setPoints(cell, parsed.points);
    else if (parsed.kind === 'clear' && cell.kind === 'points') requestClear(cell);
  }

  function cancelEdit(refocus: boolean): void {
    editing.value = null;
    if (refocus) focus.focusPosition();
  }

  function confirmed(): void {
    const action = confirmation.value?.action;
    confirmation.value = null;
    action?.();
    focus.focusPosition();
  }

  function dismissed(): void {
    confirmation.value = null;
    focus.focusPosition();
  }

  // ---- menus, notes, columns -----------------------------------------------------------------------------------

  /** A right click opens the menu at the pointer; the ⋯ button and the keyboard open it below the element. */
  function menuAnchor(event: MouseEvent, fallback: PanelAnchor): { anchor: PanelAnchor; gap: number } {
    if (event.type === 'contextmenu') return { anchor: { x: event.clientX, y: event.clientY, width: 0, height: 0 }, gap: 0 };
    const el = event.currentTarget as Element | null;
    return { anchor: el ? focus.anchorOfElement(el) : fallback, gap: 4 };
  }

  function onCellMenu(cell: GridCell, event: MouseEvent): void {
    if (cell.locked) return;
    overlay.value = { type: 'menu', cell, ...menuAnchor(event, focus.anchorOfCell(cell)) };
  }

  function onColumnMenu(column: GridColumn, event: MouseEvent): void {
    overlay.value = { type: 'column-menu', column, ...menuAnchor(event, focus.anchorOfColumn(column)) };
  }

  function selectCellAction(action: CellMenuAction): void {
    const current = overlay.value;
    overlay.value = null;
    if (current?.type !== 'menu') return;
    const cell = current.cell;
    if (action === 'note-add' || action === 'note-edit') {
      overlay.value = { type: 'note', cell, studentName: nameOf(cell.studentId), anchor: focus.anchorOfCell(cell) };
      return;
    }
    if (action === 'note-delete') void grid.setNote(cell, '');
    else if (action === 'reset-result') requestClear(cell);
    else grid.scheduleImpromptuDelete(cell);
    if (!confirmation.value) focus.focusPosition();
  }

  function saveNote(text: string): void {
    const current = overlay.value;
    overlay.value = null;
    if (current?.type === 'note') void grid.setNote(current.cell, text);
    focus.focusPosition();
  }

  /** Opens the editor for the general note of a student, anchored below the button that was used. */
  function onStudentNote(studentId: string, event: MouseEvent): void {
    const row = model.value.rows.find((r) => r.studentId === studentId);
    const el = event.currentTarget as Element | null;
    if (!row || !el) return;
    overlay.value = { type: 'student-note', studentId, studentName: row.displayName, text: row.studentNote ?? '', anchor: focus.anchorOfElement(el) };
  }

  function saveStudentNote(text: string): void {
    const current = overlay.value;
    overlay.value = null;
    if (current?.type === 'student-note') void grid.setStudentNote(current.studentId, text);
    focus.focusPosition();
  }

  function requestDeleteColumn(): void {
    const current = overlay.value;
    overlay.value = null;
    if (current?.type !== 'column-menu') return;
    const column = current.column;
    const count = resultCount(model.value, column.assessmentId);
    const consequence =
      count === 0
        ? 'Die Leistung enthält noch keine Ergebnisse.'
        : count === 1
          ? 'Das Ergebnis von 1 Schüler geht verloren.'
          : `Die Ergebnisse von ${count} Schülern gehen verloren.`;
    confirmation.value = {
      title: `Leistung „${column.title}“ löschen?`,
      message: `${consequence} Dieser Schritt kann nicht rückgängig gemacht werden.`,
      confirmLabel: 'Für alle löschen',
      danger: true,
      action: () => void grid.deleteShared(column.assessmentId),
    };
  }

  function onHover(cell: GridCell, over: boolean): void {
    window.clearTimeout(hoverTimer);
    if (!over || !cell.hasNote || popupOpen.value) {
      tooltip.value = null;
      return;
    }
    hoverTimer = window.setTimeout(() => {
      tooltip.value = { cell, anchor: focus.anchorOfCell(cell) };
    }, TOOLTIP_DELAY_MS);
  }

  // ---- new assessments -----------------------------------------------------------------------------------------

  function onHeaderAdd(): void {
    errorMessage.value = '';
    overlay.value = { type: 'new-assessment', anchor: focus.anchorOfPosition(-1, model.value.columns.length) };
  }

  async function createAssessment(input: NewAssessmentInput): Promise<void> {
    creating.value = true;
    try {
      if (!(await grid.createShared(input))) return;
      overlay.value = null;
      await nextTick();
      focus.setPosition({ row: -1, col: model.value.columns.length - 1 });
      focus.focusPosition();
    } finally {
      creating.value = false;
    }
  }

  function onRowAdd(studentId: string): void {
    if (model.value.rows.find((r) => r.studentId === studentId)?.absent) return;
    impromptuStudentId.value = studentId;
  }

  function closeImpromptu(): void {
    impromptuStudentId.value = null;
    focus.focusPosition();
  }

  async function impromptuSaved(): Promise<void> {
    const studentId = impromptuStudentId.value;
    impromptuStudentId.value = null;
    await grid.loadAssessments();
    const row = model.value.rows.findIndex((r) => r.studentId === studentId);
    const cells = model.value.rows[row]?.impromptuCells.length ?? 0;
    if (row >= 0 && cells > 0) focus.setPosition({ row, col: model.value.columns.length + cells - 1 });
    focus.focusPosition();
  }

  // ---- keyboard ------------------------------------------------------------------------------------------------

  function activateTarget(target: NavigationTarget): void {
    if (target.type === 'cell') activate(target.cell);
    else if (target.type === 'header-add') onHeaderAdd();
    else if (target.type === 'row-add') onRowAdd(target.row.studentId);
    else openColumnMenuAt(target.column);
  }

  function openColumnMenuAt(column: GridColumn): void {
    overlay.value = { type: 'column-menu', column, anchor: focus.anchorOfColumn(column), gap: 4 };
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!(event.target as HTMLElement).closest('[data-grid-pos]')) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (event.key === 'Escape') tooltip.value = null;
    if (NAVIGATION_KEYS.includes(event.key)) {
      event.preventDefault();
      focus.move(event.key, ctrl);
      return;
    }
    const pending = grid.pendingDelete.value;
    if (ctrl && event.key.toLowerCase() === 'z' && pending) {
      event.preventDefault();
      grid.undoDelete(pending.assessmentId);
      return;
    }
    const target = targetAt(model.value, focus.nav.value.position);
    if (!target) return;
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      if (target.type === 'cell' && cellMenu(target.cell).length > 0) {
        overlay.value = { type: 'menu', cell: target.cell, anchor: focus.anchorOfCell(target.cell), gap: 4 };
      } else if (target.type === 'column-header') openColumnMenuAt(target.column);
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2' || event.key === ' ') {
      event.preventDefault();
      activateTarget(target);
      return;
    }
    if (target.type !== 'cell' || target.cell.locked || ctrl || event.altKey) return;
    const cell = target.cell;
    const symbol = cell.gradingType === 'TERTIARY' ? symbolForKey(event.key) : null;
    if (symbol) {
      event.preventDefault();
      void grid.setSymbol(cell, symbol);
    } else if (cell.gradingType === 'NUMERIC' && /^\d$/.test(event.key)) {
      event.preventDefault();
      editing.value = { key: cell.key, initial: event.key };
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      requestClear(cell);
    }
  }

  return {
    overlay,
    confirmation,
    tooltip,
    editing,
    impromptuStudent,
    creating,
    selectionVisible,
    closeOverlay,
    activate,
    pick,
    commitEdit,
    cancelEdit,
    confirmed,
    dismissed,
    onCellMenu,
    onColumnMenu,
    selectCellAction,
    saveNote,
    onStudentNote,
    saveStudentNote,
    requestDeleteColumn,
    onHover,
    onHeaderAdd,
    createAssessment,
    onRowAdd,
    closeImpromptu,
    impromptuSaved,
    onKeydown,
  };
}
