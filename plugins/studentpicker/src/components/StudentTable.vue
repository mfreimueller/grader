<template>
  <div class="table-wrap">
    <table class="students" data-testid="students">
      <thead>
        <tr>
          <th>{{ t('table.name') }}</th>
          <th>{{ t('table.count') }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sorted" :key="s.id" :data-student="s.id">
          <td class="name">
            <span class="dot" :style="{ background: s.color ?? 'var(--color-disabled)' }" aria-hidden="true" />
            {{ s.lastName }} {{ s.firstName }}
          </td>
          <td>
            <input
              class="count"
              type="number"
              min="0"
              step="1"
              :value="s.pickCount"
              :aria-label="t('table.countFor', { name: fullName(s) })"
              :data-testid="`count-${s.id}`"
              @change="onCount(s, $event)"
            >
          </td>
          <td>
            <button :disabled="picking" :data-testid="`pick-${s.id}`" @click="emit('pick', s.id)">{{ t('table.pick') }}</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { parseCountInput } from '../core/pickCounts';
import type { Student } from '../core/types';
import { t } from '../i18n';

const props = defineProps<{ students: Student[]; picking: boolean }>();
const emit = defineEmits<{
  setCount: [studentId: string, count: number];
  invalidCount: [];
  pick: [studentId: string];
}>();

const sorted = computed(() =>
  [...props.students].sort((a, b) => a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de')),
);

const fullName = (s: Student): string => `${s.lastName} ${s.firstName}`;

function onCount(student: Student, event: Event): void {
  const input = event.target as HTMLInputElement;
  const count = parseCountInput(input.value);
  if (count === null) {
    // Show the real value again instead of what was typed.
    input.value = String(student.pickCount);
    emit('invalidCount');
    return;
  }
  emit('setCount', student.id, count);
}
</script>

<style scoped>
.table-wrap {
  min-width: 460px;
}

.students {
  width: 100%;
  border-collapse: collapse;
}

.students th {
  padding: 0 6px 6px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-align: left;
  white-space: nowrap;
}

.students td {
  height: 40px;
  padding: 0 6px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.name {
  min-width: 170px;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: baseline;
}

.count {
  width: 56px;
  height: 26px;
  padding: 0 0 0 6px;
  border-color: var(--color-text);
  border-radius: 3px;
  font-size: 14px;
  line-height: 20px;
}

.count::-webkit-inner-spin-button,
.count::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}
</style>
