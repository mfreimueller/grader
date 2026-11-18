<template>
  <div class="gf">
    <header class="gf-header">
      <div>
        <h2>Gradeflow</h2>
        <p class="gf-sub">Abgaben mit KI bewerten. Nichts wird gespeichert, bevor Sie die Vorschläge geprüft haben.</p>
      </div>
      <button type="button" class="gf-btn gf-btn-secondary" data-testid="gradeflow-back" @click="goBack">← Zurück zum Kurs</button>
    </header>

    <ol class="gf-steps" aria-label="Schritte">
      <li v-for="(label, i) in STEP_LABELS" :key="label" :class="{ 'gf-step--current': i === stepIndex, 'gf-step--done': i < stepIndex }">
        {{ i + 1 }}. {{ label }}
      </li>
    </ol>

    <p v-if="g.error" class="gf-error" role="alert" data-testid="gradeflow-error">{{ g.error }}</p>

    <SetupStep v-if="g.step === 'setup'" :g="g" />
    <MatchingStep v-else-if="g.step === 'matching'" :g="g" />
    <PreflightStep v-else-if="g.step === 'preflight'" :g="g" />
    <RunningStep v-else-if="g.step === 'running'" :g="g" />
    <ReviewStep v-else-if="g.step === 'review'" :g="g" />

    <ConfirmDialog
      v-if="leaveQuestion"
      title="Gradeflow verlassen?"
      message="Der offene Lauf wird verworfen. Die Vorschläge gehen verloren und die kopierten Abgaben werden gelöscht."
      confirm-label="Verwerfen und verlassen"
      :danger="true"
      @confirm="answerLeave(true)"
      @cancel="answerLeave(false)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useGradeflow } from '../controllers/useGradeflow';
import ConfirmDialog from '../components/course/grid/ConfirmDialog.vue';
import SetupStep from '../components/gradeflow/SetupStep.vue';
import MatchingStep from '../components/gradeflow/MatchingStep.vue';
import PreflightStep from '../components/gradeflow/PreflightStep.vue';
import RunningStep from '../components/gradeflow/RunningStep.vue';
import ReviewStep from '../components/gradeflow/ReviewStep.vue';

const STEP_LABELS = ['Einrichtung', 'Zuordnung', 'Vorprüfung', 'Bewertung', 'Prüfen & Speichern'];
const STEP_INDEX = { setup: 0, matching: 1, preflight: 2, running: 3, review: 4, done: 4 } as const;

const route = useRoute();
const router = useRouter();
const courseId = route.params.courseId as string;
const assessmentId = typeof route.query.assessmentId === 'string' ? route.query.assessmentId : null;

const g = reactive(
  useGradeflow(courseId, assessmentId, {
    api: window.grdr.gradeflow,
    loadAssessments: async (id) => {
      const sessions = await window.grdr.session.listByCourse(id);
      const perSession = await Promise.all(sessions.map((s) => window.grdr.assessment.listBySession(s.id)));
      return perSession.flat();
    },
  }),
);
const stepIndex = computed(() => STEP_INDEX[g.step]);

// A finished run sends the teacher back to the course; an open one asks first (and is discarded on leaving).
const leaveQuestion = ref<((allowed: boolean) => void) | null>(null);

function goBack(): void {
  void router.push({ name: 'CourseWorkspace', params: { courseId } });
}

function answerLeave(allowed: boolean): void {
  const resolve = leaveQuestion.value;
  leaveQuestion.value = null;
  resolve?.(allowed);
}

onBeforeRouteLeave(async () => {
  if (!g.hasOpenRun) return true;
  const allowed = await new Promise<boolean>((resolve) => {
    leaveQuestion.value = resolve;
  });
  if (allowed) await g.discard();
  return allowed;
});

watch(
  () => g.step,
  (step) => {
    if (step === 'done') goBack();
  },
);

onMounted(() => {
  g.attach();
  void g.init();
});
onUnmounted(() => g.detach());
</script>

<style>
.gf { max-width: 1100px; }
.gf-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.gf-header h2 { font-size: 22px; }
.gf-sub { color: var(--color-text-secondary); font-size: 13px; margin-top: 2px; }
.gf-steps { display: flex; flex-wrap: wrap; gap: 4px 16px; list-style: none; margin-bottom: 16px; font-size: 13px; color: var(--color-text-secondary); }
.gf-step--current { color: var(--color-primary); font-weight: 600; }
.gf-step--done { color: var(--color-text); }
.gf-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
.gf-card h3 { font-size: 16px; margin-bottom: 12px; }
.gf-field { display: block; margin-bottom: 14px; font-size: 13px; font-weight: 600; }
.gf-field select, .gf-field textarea, .gf-input { display: block; width: 100%; margin-top: 4px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; font: inherit; font-weight: 400; background: var(--color-surface); color: var(--color-text); }
.gf-path { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.gf-path-value { flex: 1; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg); font-weight: 400; overflow-wrap: anywhere; min-height: 36px; }
.gf-path-value--empty { color: var(--color-text-secondary); }
.gf-hint { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; font-weight: 400; }
.gf-error { background: #fef2f2; color: var(--color-danger); padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; white-space: pre-line; }
.gf-warning { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; }
.gf-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.gf-btn { padding: 8px 16px; border-radius: 6px; border: 1px solid transparent; font-size: 14px; cursor: pointer; font-weight: 500; white-space: nowrap; }
.gf-btn-primary { background: var(--color-primary); color: #fff; }
.gf-btn-primary:hover { background: var(--color-primary-hover); }
.gf-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.gf-btn-secondary { background: transparent; border-color: var(--color-border); color: var(--color-text); }
.gf-btn-secondary:hover { background: #f3f4f6; }
.gf-btn-danger { background: var(--color-danger); color: #fff; }
.gf-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.gf-table th, .gf-table td { text-align: left; padding: 8px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
.gf-table select, .gf-table input[type='number'], .gf-table textarea { width: 100%; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px; font: inherit; background: var(--color-surface); color: var(--color-text); }
.gf-table textarea { min-height: 54px; resize: vertical; }
.gf-row--ambiguous { background: #fffbeb; }
.gf-row--unmatched { background: #f9fafb; }
.gf-row--replaces { background: #fef9c3; }
.gf-badge { display: inline-block; font-size: 11px; padding: 1px 6px; border-radius: 10px; background: #e5e7eb; color: var(--color-text); margin-left: 4px; }
.gf-badge--warn { background: #fde68a; }
.gf-problem { color: var(--color-danger); font-size: 12px; margin-top: 2px; }
.gf-list { margin: 0 0 12px 18px; font-size: 13px; }
</style>
