<template>
  <div class="legend">
    <span class="item"><span class="swatch swatch--note"><span class="swatch-corner"></span></span>Notiz (Text beim Überfahren)</span>
    <span class="item">
      <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" fill="#F59E0B" /></svg>
      Spontane Leistung
    </span>
    <span class="item">
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v10l-6 6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#1a73e8" /></svg>
      Notiz zur Sitzung
    </span>
    <span class="item"><span class="swatch swatch--absent"></span>Abwesend (nicht bearbeitbar)</span>
    <span class="keys">Pfeiltasten: navigieren · Enter: bearbeiten · + ~ −: Symbol setzen · Entf: zurücksetzen · Rechtsklick: Menü</span>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  position: relative;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
}

.swatch--note {
  background: rgba(26, 115, 232, 0.12);
}

.swatch-corner {
  position: absolute;
  top: 0;
  right: 0;
  border-top: 7px solid var(--color-primary);
  border-left: 7px solid transparent;
}

.swatch--absent {
  background: #f9fafb;
  border: 1px solid #d1d5db;
}
</style>
