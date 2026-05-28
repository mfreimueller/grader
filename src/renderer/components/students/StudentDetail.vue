<template>
  <div class="detail-panel">
    <div class="detail-section">
      <h4>Zusatzinformationen</h4>
      <div v-if="student.additionalInfo.length === 0" class="text-secondary">Keine Zusatzinformationen.</div>
      <table v-else class="info-table">
        <thead>
          <tr><th>Schlüssel</th><th>Wert</th></tr>
        </thead>
        <tbody>
          <tr v-for="info in student.additionalInfo" :key="info.key">
            <td>{{ info.key }}</td>
            <td>{{ info.value }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="detail-section">
      <h4>Leistungshistorie</h4>
      <div v-if="loadingPerf" class="text-secondary">Lade Leistungen...</div>
      <div v-else-if="performances.length === 0" class="text-secondary">Keine Leistungen erfasst.</div>
      <table v-else class="perf-table">
        <thead>
          <tr><th>Datum</th><th>Typ</th><th>Ergebnis</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in sortedPerformances" :key="p.id">
            <td>{{ p.date }}</td>
            <td>{{ p.type === 'graded' ? 'Benotet' : 'Mitarbeit' }}</td>
            <td>
              <template v-if="p.type === 'graded'">{{ p.score ?? '—' }} Punkte</template>
              <template v-else>
                <span v-if="p.symbol === 'PLUS'">+</span>
                <span v-else-if="p.symbol === 'WELLE'">~</span>
                <span v-else-if="p.symbol === 'MINUS'">−</span>
                <span v-else>—</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { StudentDto, PerformanceDto } from '../../../shared/types';

const props = defineProps<{
  student: StudentDto;
  performances: PerformanceDto[];
  loadingPerf: boolean;
}>();

const sortedPerformances = computed(() =>
  [...props.performances].sort((a, b) => b.date.localeCompare(a.date)),
);
</script>

<style scoped>
.detail-panel {
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-section h4 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.text-secondary {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-style: italic;
}

.info-table, .perf-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.info-table th, .perf-table th {
  text-align: left;
  padding: 6px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.info-table td, .perf-table td {
  padding: 6px 10px;
  border-top: 1px solid var(--color-border);
}
</style>
