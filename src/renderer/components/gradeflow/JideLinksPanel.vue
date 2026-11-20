<template>
  <details v-if="g.links" class="gf-field jide-links" :open="!g.jideLinked" data-testid="jide-links">
    <summary>
      J;DE-Verknüpfung:
      <span v-if="g.jideLinked" data-testid="jide-links-status">Kurs verknüpft</span>
      <span v-else class="gf-badge gf-badge--warn" data-testid="jide-links-status">noch nicht bestätigt</span>
    </summary>
    <p class="gf-hint">
      Ordnen Sie diesen Kurs einem J;DE-Kurs und die Schüler/innen den J;DE-Personen zu. Vorschläge kommen aus den Namen;
      gespeichert wird erst mit „Verknüpfung speichern“. Die Verknüpfung wird bei jedem Lauf wiederverwendet.
    </p>

    <label class="gf-field">
      J;DE-Kurs
      <select :value="g.links.jideCourseId" data-testid="jide-course" @change="onCourse">
        <option value="">— J;DE-Kurs wählen —</option>
        <option v-for="c in g.links.overview?.jideCourses ?? []" :key="c.id" :value="c.id">{{ describeJideCourse(c) }}</option>
      </select>
    </label>

    <table v-if="g.links.rows.length > 0 && g.links.jideCourseId !== ''" class="gf-table">
      <thead>
        <tr><th>Schüler/in</th><th>J;DE-Person</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in g.links.rows" :key="row.studentId" data-testid="jide-link-row">
          <td>{{ row.label }}</td>
          <td>
            <select v-model="row.selected" :aria-label="`J;DE-Person für ${row.label}`">
              <option value="">— nicht verknüpft —</option>
              <option v-for="p in g.links.overview?.jideStudents ?? []" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            <span v-if="row.suggested" class="gf-badge">Vorschlag</span>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="g.links.error" class="gf-error" role="alert" data-testid="jide-links-error">{{ g.links.error }}</p>
    <p v-if="g.links.message" class="gf-hint" data-testid="jide-links-message">{{ g.links.message }}</p>
    <div class="gf-actions">
      <button type="button" class="gf-btn gf-btn-secondary" :disabled="g.links.busy" data-testid="jide-links-save" @click="g.saveLinks()">
        Verknüpfung speichern
      </button>
    </div>
  </details>
</template>

<script setup lang="ts">
import type { GradeflowState } from '../../controllers/useGradeflow';
import { describeJideCourse } from '../../utils/jideLinks';

const props = defineProps<{ g: GradeflowState }>();

function onCourse(event: Event): void {
  void props.g.links?.chooseCourse((event.target as HTMLSelectElement).value);
}
</script>

<style scoped>
.jide-links > summary { cursor: pointer; font-weight: 600; margin-bottom: 8px; }
</style>
