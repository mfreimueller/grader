<template>
  <section class="gf-card" data-testid="gradeflow-running">
    <h3>4. Bewertung läuft</h3>

    <template v-if="g.runError === null">
      <p class="gf-progress" data-testid="gradeflow-progress">{{ g.progressText }}</p>
      <p class="gf-hint">Der Agent liest alle Abgaben in einem Durchgang. Das kann einige Minuten dauern.</p>
      <div class="gf-actions">
        <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-cancel" @click="g.cancel()">Abbrechen</button>
      </div>
    </template>

    <template v-else>
      <p class="gf-error" role="alert" data-testid="gradeflow-run-error">{{ g.runError }}</p>
      <div class="gf-actions">
        <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-discard" @click="g.discard()">Verwerfen</button>
        <button type="button" class="gf-btn gf-btn-primary" data-testid="gradeflow-retry" @click="g.retry()">Erneut versuchen</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import type { GradeflowState } from '../../controllers/useGradeflow';

defineProps<{ g: GradeflowState }>();
</script>

<style scoped>
.gf-progress { font-size: 15px; margin-bottom: 6px; }
</style>
