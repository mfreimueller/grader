<template>
  <section class="gf-card" data-testid="gradeflow-matching">
    <h3>2. Zuordnung der Abgaben</h3>
    <p v-if="g.isJide" class="gf-hint" data-testid="gradeflow-jide-matching-hint">
      Die Zuordnung kommt aus der J;DE-Verknüpfung. Abgaben von J;DE-Personen ohne Verknüpfung werden nicht bewertet;
      ergänzen Sie die Verknüpfung in der Einrichtung.
    </p>
    <p v-else class="gf-hint">
      Ordnen Sie jede Abgabe einer Schülerin oder einem Schüler zu. Abgaben ohne Zuordnung werden nicht bewertet.
    </p>

    <table class="gf-table">
      <thead>
        <tr><th>{{ g.isJide ? 'Name in J;DE' : 'Name in Moodle' }}</th><th>Schüler/in</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in g.matchRows" :key="row.moodleId" :class="`gf-row--${row.status}`" data-testid="gradeflow-match-row">
          <td>
            {{ row.fullName }}
            <span v-if="row.status === 'ambiguous'" class="gf-badge gf-badge--warn">mehrdeutig</span>
            <span v-else-if="row.status === 'unmatched'" class="gf-badge">{{ g.isJide ? 'nicht verknüpft' : 'nicht erkannt' }}</span>
            <div v-if="row.alternativeNames.length > 0" class="gf-hint">auch: {{ row.alternativeNames.join(', ') }}</div>
          </td>
          <td v-if="g.isJide" data-testid="gradeflow-jide-student">
            {{ row.selected === null ? '— nicht bewerten —' : studentLabel(g.prepared?.students ?? [], row.selected) }}
          </td>
          <td v-else>
            <select v-model="row.selected" :aria-label="`Schüler/in für ${row.fullName}`">
              <option :value="null">— nicht bewerten —</option>
              <option v-for="o in options(row)" :key="o.id" :value="o.id">{{ o.candidate ? '★ ' : '' }}{{ o.label }}</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="g.prepared && g.prepared.exercise" class="gf-hint">
      J;DE-Aufgabe: {{ g.prepared.exercise.title }} ({{ g.prepared.exercise.slug }})
    </div>
    <div v-if="g.prepared && g.prepared.unrecognised.length > 0" class="gf-warning">
      Diese Ordner wurden nicht als Moodle-Abgabe erkannt und werden übersprungen:
      <ul class="gf-list"><li v-for="name in g.prepared.unrecognised" :key="name">{{ name }}</li></ul>
    </div>
    <div v-if="g.prepared && g.prepared.studentsWithoutHandin.length > 0" class="gf-warning">
      Ohne Abgabe:
      {{ g.prepared.studentsWithoutHandin.map((id) => studentLabel(g.prepared!.students, id)).join(', ') }}
    </div>
    <div v-if="g.prepared && g.prepared.conflicts.length > 0" class="gf-warning">
      Mehrere Abgaben passen zur selben Person:
      {{ g.prepared.conflicts.map((c) => studentLabel(g.prepared!.students, c.studentId)).join(', ') }}. Bitte entscheiden Sie oben, welche gilt.
    </div>

    <div class="gf-actions">
      <button type="button" class="gf-btn gf-btn-secondary" @click="g.discard()">Zurück</button>
      <button type="button" class="gf-btn gf-btn-primary" :disabled="g.busy" data-testid="gradeflow-confirm" @click="g.confirm()">
        {{ g.busy ? 'Bereitet vor…' : 'Weiter' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { GradeflowState } from '../../controllers/useGradeflow';
import { studentLabel, studentOptions, type MatchRow } from '../../utils/gradeflowMatching';

const props = defineProps<{ g: GradeflowState }>();

const options = (row: MatchRow) => studentOptions(row, props.g.prepared?.students ?? []);
</script>
