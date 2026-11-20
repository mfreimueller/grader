<template>
  <div class="gf-field jide-picker">
    J;DE-Aufgabe
    <input
      v-model="query"
      type="search"
      class="gf-input"
      :placeholder="selectedLabel || 'Aufgabe suchen (Titel oder Kennung)…'"
      :disabled="!g.jideLinked"
      autocomplete="off"
      data-testid="jide-exercise-search"
      @focus="open = true"
      @input="open = true"
    />
    <p v-if="selectedLabel" class="gf-hint" data-testid="jide-exercise-selected">
      Gewählt: {{ selectedLabel }}
      <button type="button" class="gf-link" @click="clear">Auswahl aufheben</button>
    </p>
    <ul v-if="open && g.jideLinked" class="jide-picker-list" role="listbox" data-testid="jide-exercise-list">
      <li v-for="e in matches" :key="e.id" role="option" :aria-selected="e.id === g.form.jideExerciseId">
        <button type="button" data-testid="jide-exercise-option" @click="choose(e.id)">{{ describeExercise(e) }}</button>
      </li>
      <li v-if="matches.length === 0" class="gf-hint">
        {{ g.exercises.length === 0 ? 'Der J;DE-Kurs hat keine freigeschalteten Aufgaben.' : 'Keine passende Aufgabe.' }}
      </li>
    </ul>
    <p v-if="!g.jideLinked" class="gf-hint">Zuerst die Verknüpfung oben speichern.</p>
    <p v-if="g.exercisesError" class="gf-error" role="alert">{{ g.exercisesError }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GradeflowState } from '../../controllers/useGradeflow';
import { describeExercise, filterExercises } from '../../utils/gradeflowJide';

const props = defineProps<{ g: GradeflowState }>();

const query = ref('');
const open = ref(false);

const matches = computed(() => filterExercises(props.g.exercises, query.value));
const selectedLabel = computed(() => {
  const picked = props.g.exercises.find((e) => e.id === props.g.form.jideExerciseId);
  return picked ? describeExercise(picked) : '';
});

function choose(id: string): void {
  props.g.form.jideExerciseId = id;
  query.value = '';
  open.value = false;
}

function clear(): void {
  props.g.form.jideExerciseId = '';
}
</script>

<style scoped>
.jide-picker-list { list-style: none; margin: 4px 0 0; padding: 0; max-height: 220px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); }
.jide-picker-list li { padding: 0; }
.jide-picker-list li.gf-hint { padding: 8px 10px; }
.jide-picker-list button { display: block; width: 100%; text-align: left; padding: 8px 10px; background: none; border: none; font: inherit; color: var(--color-text); cursor: pointer; }
.jide-picker-list button:hover, .jide-picker-list button:focus { background: var(--color-bg); }
.gf-link { background: none; border: none; color: var(--color-primary); cursor: pointer; font: inherit; text-decoration: underline; padding: 0; margin-left: 6px; }
</style>
