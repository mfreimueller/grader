// Focus handling of the session grid: which position is current (roving tabindex), moving it with the keyboard,
// putting the DOM focus on it and finding the screen rectangles popups are placed at.

import { computed, nextTick, ref, watch, type ComputedRef, type Ref } from 'vue';
import { clampPosition, navigate, shapeOf, type GridPosition, type Navigation } from '../utils/sessionGridNavigation';
import type { GridCell, GridColumn, SessionGridModel } from '../utils/sessionGridModel';
import type { PanelAnchor } from '../utils/panelAnchor';

export function useGridFocus(root: Ref<HTMLElement | null>, model: ComputedRef<SessionGridModel>) {
  const nav = ref<Navigation>({ position: { row: 0, col: 0 }, preferredCol: 0 });
  /** True while the keyboard focus is inside the grid; only then is the current position drawn as selected. */
  const hasFocus = ref(false);
  const shape = computed(() => shapeOf(model.value));

  // Data changes (deleted cells, new rows) can leave the position outside the grid.
  watch(shape, (next) => {
    nav.value = { ...nav.value, position: clampPosition(next, nav.value.position) };
  });

  const isAt = (row: number, col: number): boolean => nav.value.position.row === row && nav.value.position.col === col;

  function focusPosition(): void {
    void nextTick(() => {
      const { row, col } = nav.value.position;
      root.value?.querySelector<HTMLElement>(`[data-grid-pos="${row},${col}"]`)?.focus();
    });
  }

  function setPosition(position: GridPosition): void {
    nav.value = { position, preferredCol: position.col };
  }

  function move(key: string, ctrl = false): void {
    nav.value = navigate(shape.value, nav.value, key, ctrl);
    focusPosition();
  }

  function onFocusin(event: FocusEvent): void {
    hasFocus.value = true;
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-grid-pos]');
    const [row, col] = el?.dataset.gridPos?.split(',').map(Number) ?? [];
    if (row === undefined || col === undefined || isAt(row, col)) return;
    setPosition({ row, col });
  }

  function onFocusout(event: FocusEvent): void {
    if (!root.value?.contains(event.relatedTarget as Node | null)) hasFocus.value = false;
  }

  function anchorOfElement(el: Element | null | undefined): PanelAnchor {
    const rect = el?.getBoundingClientRect();
    return { x: rect?.left ?? 0, y: rect?.top ?? 0, width: rect?.width ?? 0, height: rect?.height ?? 0 };
  }

  const anchorOfCell = (cell: GridCell): PanelAnchor => anchorOfElement(root.value?.querySelector(`[data-cell-key="${cell.key}"]`));
  const anchorOfColumn = (column: GridColumn): PanelAnchor => anchorOfElement(root.value?.querySelector(`[data-column-id="${column.assessmentId}"]`));
  const anchorOfPosition = (row: number, col: number): PanelAnchor => anchorOfElement(root.value?.querySelector(`[data-grid-pos="${row},${col}"]`));

  return {
    nav,
    hasFocus,
    isAt,
    focusPosition,
    setPosition,
    move,
    onFocusin,
    onFocusout,
    anchorOfElement,
    anchorOfCell,
    anchorOfColumn,
    anchorOfPosition,
  };
}
