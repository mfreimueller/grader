<template>
  <section class="gf-card" data-testid="gradeflow-preflight">
    <h3>3. Vorprüfung</h3>
    <p class="gf-hint">
      In den Abgaben wurden vollständige Namen durch „STUDENT“ ersetzt. Diese Ansicht zeigt, was dabei passiert ist; sie wird
      nur auf diesem Computer angezeigt.
    </p>

    <p v-if="g.personalDataRisk" class="gf-warning" data-testid="gradeflow-risk">
      Achtung: Binärdateien und Dateien mit einzelnen Vor- oder Nachnamen können weiterhin personenbezogene Daten enthalten.
      Schließen Sie solche Dateien unten aus, wenn sie nicht an die KI gehen sollen.
    </p>

    <div v-for="group in g.preflight" :key="group.studentId" class="gf-group" data-testid="gradeflow-preflight-group">
      <h4>{{ group.name }}</h4>
      <p class="gf-hint">{{ summary(group.totals) }}</p>
      <table class="gf-table">
        <thead><tr><th>Ausschließen</th><th>Datei</th><th>Art</th><th>Ersetzt</th><th>Einzelne Namen</th></tr></thead>
        <tbody>
          <tr v-for="file in group.files" :key="file.key">
            <td>
              <input
                v-if="file.excludable"
                type="checkbox"
                :checked="g.excluded.includes(file.key)"
                :aria-label="`${file.path} ausschließen`"
                @change="g.toggleExclude(file.key)"
              />
            </td>
            <td>{{ file.path }}</td>
            <td>{{ file.kindLabel }}<span v-if="file.detail" class="gf-hint"> ({{ file.detail }})</span></td>
            <td>{{ file.replacements || '' }}</td>
            <td>{{ file.loneNameHits.map((h) => `${h.name} (${h.count}×)`).join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="gf-actions">
      <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-abort" @click="g.discard()">Abbrechen</button>
      <button type="button" class="gf-btn gf-btn-primary" :disabled="g.busy" data-testid="gradeflow-start" @click="g.startRun()">
        Bewertung starten
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { GradeflowState } from '../../controllers/useGradeflow';
import type { PreflightTotals } from '../../utils/gradeflowPreflight';

defineProps<{ g: GradeflowState }>();

const PARTS: [keyof PreflightTotals, string][] = [
  ['replacements', 'Namen ersetzt'],
  ['loneNameFiles', 'Dateien mit einzelnen Namen'],
  ['binary', 'Binärdateien'],
  ['tooLarge', 'zu große Dateien'],
  ['skipped', 'übersprungene Einträge'],
  ['archiveErrors', 'Archivfehler'],
  ['unsupportedArchives', 'nicht unterstützte Archive'],
  ['symlinks', 'symbolische Links'],
  ['nestedArchives', 'verschachtelte Archive'],
  ['converted', 'Dateien mit umgewandelter Zeichenkodierung'],
];

function summary(totals: PreflightTotals): string {
  const parts = PARTS.filter(([key]) => totals[key] > 0).map(([key, label]) => `${totals[key]} ${label}`);
  return parts.length > 0 ? parts.join(' · ') : 'Nichts Auffälliges.';
}
</script>

<style scoped>
.gf-group { margin-bottom: 18px; }
.gf-group h4 { font-size: 14px; margin-bottom: 2px; }
</style>
