<template>
  <FloatingPanel :anchor="anchor" @close="emit('close')">
    <div class="picker" role="dialog" :aria-label="`Symbol wählen: ${cell.title}`" @keydown="onKey">
      <div class="caption">{{ cell.title }} · {{ studentName }}</div>
      <div class="symbols" role="group">
        <button
          v-for="symbol in SYMBOLS"
          :key="symbol"
          type="button"
          :class="['symbol', { active: cell.symbol === symbol }]"
          :aria-pressed="cell.symbol === symbol"
          :aria-label="symbolName(symbol)"
          :title="symbolName(symbol)"
          :data-autofocus="symbol === (cell.symbol ?? 'PLUS') ? '' : undefined"
          @click="emit('pick', symbol)"
        >
          {{ symbolGlyph(symbol) }}
        </button>
      </div>
      <div class="hint">Aktives Symbol erneut klicken = zurücksetzen</div>
    </div>
  </FloatingPanel>
</template>

<script setup lang="ts">
import type { GridCell, GridSymbol } from '../../../utils/sessionGridModel';
import { symbolGlyph, symbolName } from '../../../utils/sessionGridLabels';
import { symbolForKey } from '../../../utils/sessionGridInput';
import type { PanelAnchor } from '../../../utils/panelAnchor';
import FloatingPanel from './FloatingPanel.vue';

defineProps<{ cell: GridCell; studentName: string; anchor: PanelAnchor }>();
const emit = defineEmits<{ pick: [symbol: GridSymbol]; close: [] }>();

const SYMBOLS: readonly GridSymbol[] = ['PLUS', 'WELLE', 'MINUS'];

function onKey(event: KeyboardEvent): void {
  const picked = symbolForKey(event.key);
  if (picked) {
    event.preventDefault();
    emit('pick', picked);
    return;
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.symbol')];
  const at = buttons.indexOf(document.activeElement as HTMLElement);
  const next = event.key === 'ArrowRight' ? Math.min(buttons.length - 1, at + 1) : Math.max(0, at - 1);
  buttons[next]?.focus();
}
</script>

<style scoped>
.picker {
  padding: 12px 14px;
  width: 200px;
}

.caption {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.symbols {
  display: flex;
  gap: 8px;
}

.symbol {
  width: 40px;
  height: 36px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: var(--color-surface);
  font: inherit;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
}

.symbol:hover {
  border-color: var(--color-primary);
}

.symbol:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.symbol.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
