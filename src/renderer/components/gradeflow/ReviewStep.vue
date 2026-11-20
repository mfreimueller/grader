<template>
  <section class="gf-card" data-testid="gradeflow-review">
    <h3>5. Prüfen & Speichern</h3>
    <p class="gf-hint">
      Dies sind Vorschläge der KI. Prüfen und ändern Sie sie; gespeichert wird nur, was angehakt ist.
      <template v-if="g.isJide">
        Beim Speichern wird die Beurteilung mit Kommentar und Zeilenkommentaren auch an J;DE gesendet; die Schüler/innen sehen sie dort sofort.
      </template>
      <template v-if="g.proposals">
        Dauer {{ seconds(g.proposals.durationMs) }} s<template v-if="g.proposals.costUsd !== null">, Kosten ca. {{ g.proposals.costUsd.toFixed(2).replace('.', ',') }} USD</template>.
      </template>
    </p>

    <p v-if="g.replaceCount > 0" class="gf-warning" data-testid="gradeflow-replace-warning">
      {{ g.replaceCount }} {{ g.replaceCount === 1 ? 'Ergebnis wird' : 'Ergebnisse werden' }} beim Speichern ersetzt (gelb markiert).
    </p>

    <p v-if="g.isJide && g.jideSummary" class="gf-warning" data-testid="gradeflow-jide-summary">J;DE: {{ g.jideSummary }}.</p>

    <p v-if="g.saveResult && g.saveResult.failed.length > 0" class="gf-error" role="alert" data-testid="gradeflow-save-failed">
      {{ g.saveResult.saved }} gespeichert, {{ g.saveResult.failed.length }} fehlgeschlagen. Die fehlgeschlagenen Zeilen sind noch angehakt.
    </p>

    <table class="gf-table">
      <thead>
        <tr><th>Übernehmen</th><th>Schüler/in</th><th>Vorschlag</th><th>Aktuell</th><th>Kommentar</th></tr>
      </thead>
      <tbody>
        <template v-for="row in g.reviewRows" :key="row.studentId">
        <tr :class="{ 'gf-row--replaces': row.replaces && row.include }" data-testid="gradeflow-review-row">
          <td><input v-model="row.include" type="checkbox" :disabled="row.saved" :aria-label="`${name(row.studentId)} übernehmen`" /></td>
          <td>
            {{ name(row.studentId) }}
            <span v-if="!row.hasProposal" class="gf-badge gf-badge--warn">kein Vorschlag</span>
            <span v-if="row.saved" class="gf-badge">gespeichert</span>
            <span v-if="row.replaces" class="gf-badge gf-badge--warn">ersetzt Ergebnis</span>
            <span v-if="row.jide?.status === 'sent'" class="gf-badge" data-testid="gradeflow-jide-sent">an J;DE gesendet</span>
            <span v-if="row.jide?.status === 'newer-handin'" class="gf-badge gf-badge--warn" data-testid="gradeflow-jide-newer">
              neue Abgabe seit dem Laden
            </span>
          </td>
          <td>
            <select v-if="isTertiary" v-model="row.symbol" :disabled="row.saved" :aria-label="`Beurteilung für ${name(row.studentId)}`">
              <option :value="null">—</option>
              <option v-for="s in symbols" :key="s.value" :value="s.value">{{ s.glyph }} {{ s.name }}</option>
            </select>
            <input
              v-else
              v-model.number="row.score"
              type="number"
              min="0"
              :max="g.selectedAssessment?.maxPoints ?? undefined"
              step="0.5"
              :disabled="row.saved"
              :aria-label="`Punkte für ${name(row.studentId)}`"
            />
            <div v-if="g.rowProblems[row.studentId]" class="gf-problem">{{ g.rowProblems[row.studentId] }}</div>
            <div v-if="row.failure" class="gf-problem">{{ row.failure }}</div>
            <div v-if="row.jide?.status === 'error'" class="gf-problem" data-testid="gradeflow-jide-error">
              Nicht an J;DE gesendet: {{ row.jide.message }}
            </div>
            <div v-if="row.jide?.status === 'newer-handin'" class="gf-hint">
              Nicht an J;DE gesendet. Die Schülerin bzw. der Schüler hat danach erneut abgegeben; starten Sie Gradeflow erneut, um die neue Abgabe zu bewerten.
            </div>
          </td>
          <td>
            {{ currentLabel(row.current) }}
            <div v-if="row.current?.note" class="gf-hint">{{ row.current.note }}</div>
          </td>
          <td>
            <textarea v-model="row.comment" maxlength="2000" :disabled="row.saved" :aria-label="`Kommentar für ${name(row.studentId)}`"></textarea>
            <div v-if="row.flags.includes('TOKEN_IN_COMMENT')" class="gf-hint">Ein Kennzeichen wurde aus dem Kommentar entfernt.</div>
            <div v-if="row.flags.includes('COMMENT_TRUNCATED')" class="gf-hint">Der Kommentar wurde gekürzt.</div>
            <div v-if="row.flags.includes('LINE_COMMENT_DROPPED')" class="gf-hint">
              Einzelne Zeilenkommentare passten zu keiner Datei oder Zeile (oder waren leer) und wurden verworfen.
            </div>
          </td>
        </tr>
        <tr v-if="row.jide" data-testid="gradeflow-jide-code-row">
          <td></td>
          <td colspan="4">
            <details>
              <summary>Code und Zeilenkommentare ({{ row.jide.lineComments.length }})</summary>
              <JideCodeReview :row="row" />
            </details>
          </td>
        </tr>
        </template>
      </tbody>
    </table>

    <div class="gf-actions">
      <button v-if="g.isJide && g.saveResult" type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-finish" @click="g.finish()">Fertig</button>
      <button v-else type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-discard-review" @click="g.discard()">Verwerfen</button>
      <button type="button" class="gf-btn gf-btn-primary" :disabled="g.busy" data-testid="gradeflow-save" @click="g.save()">
        {{ saveLabel }}
      </button>
    </div>

    <ConfirmDialog
      v-if="g.overwriteConfirmation !== null"
      title="Bestehende Ergebnisse ersetzen?"
      :message="`${g.overwriteConfirmation === 1 ? '1 bestehendes Ergebnis wird' : `${g.overwriteConfirmation} bestehende Ergebnisse werden`} durch die Vorschläge ersetzt.`"
      confirm-label="Ersetzen und speichern"
      :danger="true"
      @confirm="g.confirmOverwrite()"
      @cancel="g.declineOverwrite()"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GradeflowState } from '../../controllers/useGradeflow';
import ConfirmDialog from '../course/grid/ConfirmDialog.vue';
import { studentLabel } from '../../utils/gradeflowMatching';
import { currentLabel } from '../../utils/gradeflowReview';
import JideCodeReview from './JideCodeReview.vue';
import { symbolGlyph, symbolName } from '../../utils/sessionGridLabels';
import { GRID_SYMBOLS } from '../../utils/sessionGridModel';

const props = defineProps<{ g: GradeflowState }>();

const symbols = GRID_SYMBOLS.map((value) => ({ value, glyph: symbolGlyph(value), name: symbolName(value) }));
const isTertiary = computed(() => props.g.selectedAssessment?.gradingType !== 'NUMERIC');
const name = (studentId: string): string => studentLabel(props.g.prepared?.students ?? [], studentId);
const seconds = (ms: number): number => Math.round(ms / 1000);
const saveLabel = computed(() => {
  const retry = props.g.saveResult !== null;
  if (props.g.isJide) return retry ? 'Erneut speichern und senden' : 'Speichern und an J;DE senden';
  return props.g.saveResult !== null && props.g.saveResult.failed.length > 0 ? 'Erneut speichern' : 'Speichern';
});
</script>
