<template>
  <section class="gf-card" data-testid="gradeflow-setup">
    <h3>1. Einrichtung</h3>

    <fieldset class="gf-field gf-source" data-testid="gradeflow-source">
      <legend>Woher kommen die Abgaben?</legend>
      <label><input type="radio" :checked="!g.isJide" name="gradeflow-source" data-testid="gradeflow-source-moodle" @change="g.setSource('moodle')" /> Moodle (Abgabenordner)</label>
      <label><input type="radio" :checked="g.isJide" name="gradeflow-source" data-testid="gradeflow-source-jide" @change="g.setSource('jide')" /> J;DE (Java-Lernprogramm)</label>
    </fieldset>

    <label class="gf-field">
      Leistung
      <select v-model="g.form.assessmentId" data-testid="gradeflow-assessment">
        <option value="" disabled>— Leistung wählen —</option>
        <option v-for="a in g.columnOptions" :key="a.id" :value="a.id">{{ a.label }} · {{ describeAssessment(a) }}</option>
      </select>
      <span v-if="g.columnOptions.length === 0" class="gf-hint">
        {{
          g.isJide
            ? 'Dieser Kurs hat keine gemeinsame Leistung mit Symbolen. J;DE bewertet mit Symbolen; legen Sie zuerst in einer Sitzung eine an.'
            : 'Dieser Kurs hat keine gemeinsame Leistung mit Symbolen oder Punkten. Legen Sie zuerst in einer Sitzung eine an.'
        }}
      </span>
    </label>

    <template v-if="g.isJide && g.links">
      <JideLinksPanel :g="g" />
      <JideExercisePicker :g="g" />
    </template>

    <template v-if="!g.isJide">
    <div class="gf-field">
      Aufgabenstellung
      <div class="gf-path">
        <span :class="['gf-path-value', { 'gf-path-value--empty': !g.form.assignmentPath }]" data-testid="gradeflow-assignment">
          {{ g.form.assignmentPath ?? 'Nichts gewählt' }}
        </span>
        <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-pick-assignment" @click="g.pick('assignmentPath', 'file')">Datei wählen…</button>
        <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-pick-assignment-dir" @click="g.pick('assignmentPath', 'directory')">Ordner wählen…</button>
      </div>
      <span class="gf-hint">
        Ein Ordner wird mit allen Dateien übernommen (z. B. Angabe und Vorlageprojekt).
        Dateien aus Ordnern werden nicht anonymisiert – keine Schülerdaten hineinlegen.
      </span>
    </div>

    <div class="gf-field">
      Abgabenordner
      <div class="gf-path">
        <span :class="['gf-path-value', { 'gf-path-value--empty': !g.form.handinsDir }]" data-testid="gradeflow-handins">
          {{ g.form.handinsDir ?? 'Kein Ordner gewählt' }}
        </span>
        <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-pick-handins" @click="g.pick('handinsDir')">Ordner wählen…</button>
      </div>
      <span class="gf-hint">Der Ordner mit den heruntergeladenen Moodle-Abgaben („Name_Nummer_assignsubmission_file“).</span>
    </div>

    <div class="gf-field">
      Musterlösung (optional)
      <div class="gf-path">
        <span :class="['gf-path-value', { 'gf-path-value--empty': !g.form.solutionPath }]">
          {{ g.form.solutionPath ?? 'Nichts gewählt' }}
        </span>
        <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-pick-solution" @click="g.pick('solutionPath', 'file')">Datei wählen…</button>
        <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-pick-solution-dir" @click="g.pick('solutionPath', 'directory')">Ordner wählen…</button>
        <button v-if="g.form.solutionPath" type="button" class="gf-btn gf-btn-secondary" @click="g.clearSolution()">Entfernen</button>
      </div>
    </div>
    </template>

    <label class="gf-field">
      Bewertungs-Skill
      <select v-model="g.form.skillId" data-testid="gradeflow-skill">
        <option value="" disabled>— Skill wählen —</option>
        <option v-for="s in g.skills.skills" :key="s.id" :value="s.id">
          {{ s.name }}{{ s.model ? ` (Modell ${s.model})` : '' }} — {{ s.description }}
        </option>
      </select>
      <span class="gf-hint">
        Eigene Skills legen Sie als Ordner mit einer SKILL.md ab.
        <button type="button" class="gf-link" @click="g.openSkillsFolder()">Skills-Ordner öffnen</button>
      </span>
    </label>

    <div v-if="g.skills.invalid.length > 0" class="gf-warning" data-testid="gradeflow-invalid-skills">
      Diese Skills sind ungültig und stehen nicht zur Auswahl:
      <ul class="gf-list">
        <li v-for="bad in g.skills.invalid" :key="bad.id">{{ bad.id }}: {{ bad.reason }}</li>
      </ul>
    </div>

    <p v-if="g.settings" class="gf-hint" data-testid="gradeflow-limits">
      {{ describeLimits(g.settings) }}. Ändern können Sie das in den Einstellungen.
    </p>

    <div class="gf-actions">
      <button type="button" class="gf-btn gf-btn-primary" :disabled="g.busy" data-testid="gradeflow-prepare" @click="g.prepare()">
        {{ g.busy ? 'Prüft…' : 'Weiter' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { GradeflowState } from '../../controllers/useGradeflow';
import { describeAssessment, describeLimits } from '../../utils/gradeflowSetup';
import JideExercisePicker from './JideExercisePicker.vue';
import JideLinksPanel from './JideLinksPanel.vue';

defineProps<{ g: GradeflowState }>();
</script>

<style scoped>
.gf-source { border: none; padding: 0; }
.gf-source legend { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.gf-source label { display: block; font-weight: 400; margin-bottom: 2px; }
.gf-link { background: none; border: none; color: var(--color-primary); cursor: pointer; font: inherit; text-decoration: underline; padding: 0; margin-left: 6px; }
</style>
