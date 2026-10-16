<template>
  <main class="course">
    <p v-if="loading" data-testid="loading">{{ t('loading') }}</p>
    <p v-else-if="loadError" class="error" role="alert" data-testid="load-error">{{ loadError }}</p>

    <template v-else-if="context">
      <h1 data-testid="course-title">{{ context.schoolClass.name }} · {{ context.course.title }}</h1>

      <p v-if="students.length === 0" data-testid="no-students">{{ t('machine.noStudents') }}</p>
      <template v-else>
        <div class="controls">
          <label class="skin">
            {{ t('skin.label') }}
            <select :value="skin" data-testid="skin-select" :disabled="picking" @change="changeSkin">
              <option v-for="s in SKINS" :key="s" :value="s">{{ t(`skin.${s}`) }}</option>
            </select>
          </label>
          <label class="toggle">
            <input v-model="fair" type="checkbox" data-testid="fair-toggle" :disabled="picking">
            {{ t('machine.fair') }}
          </label>
          <button type="button" data-testid="edit-specials" :disabled="picking" @click="editingSpecials = true">{{ t('machine.specials') }}</button>
          <button type="button" data-testid="reset-counts" :disabled="picking" @click="confirmingReset = true">{{ t('machine.reset') }}</button>
          <span class="hint">{{ skin === 'wheel' ? t('wheel.hint') : t('machine.hint') }}</span>
        </div>
        <p v-if="error" class="error" role="alert" data-testid="error">{{ error }}</p>

        <div class="layout">
          <SpinningWheel v-if="skin === 'wheel'" ref="machine" :items="items" :disabled="picking" @spin="spin" />
          <SlotMachine v-else ref="machine" :items="items" :disabled="picking" @spin="spin" />
          <StudentTable
            :students="students"
            :picking="picking"
            @set-count="setCount"
            @invalid-count="error = t('machine.countInvalid')"
            @pick="pickDirect"
          />
        </div>
      </template>
    </template>

    <PickResultDialog v-if="result" :student="result" :all-categories="context?.categories ?? []" @close="result = null" />
    <SpecialsEditor v-if="editingSpecials" :specials="specials" :persist="saveSpecials" @close="editingSpecials = false" />
    <SpecialDialog v-if="special" :special="special" @close="special = null" />
    <ConfettiRain v-if="confetti" :key="confetti" @done="confetti = 0" />

    <div v-if="confirmingReset" class="overlay" @click.self="confirmingReset = false">
      <div class="dialog" style="--dialog-width: 400px" role="dialog" aria-modal="true" :aria-label="t('machine.reset')">
        <p>{{ t('machine.resetConfirm') }}</p>
        <div class="actions">
          <button @click="confirmingReset = false">{{ t('common.cancel') }}</button>
          <button class="primary" data-testid="reset-confirm" @click="resetCounts">{{ t('machine.reset') }}</button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import SlotMachine from './components/SlotMachine.vue';
import SpinningWheel from './components/SpinningWheel.vue';
import ConfettiRain from './components/ConfettiRain.vue';
import StudentTable from './components/StudentTable.vue';
import PickResultDialog from './components/PickResultDialog.vue';
import SpecialDialog from './components/SpecialDialog.vue';
import SpecialsEditor from './components/SpecialsEditor.vue';
import { errorText, toPlain, unwrap } from './core/bridgeError';
import { activeSpecials, draw, fairPool, type DrawResult } from './core/draw';
import { layoutItems } from './core/layout';
import { applyCounts, incrementCount, parsePickCounts, setCount as withCount, type PickCounts } from './core/pickCounts';
import { parseSkin, SKINS, DEFAULT_SKIN, type Skin } from './core/skin';
import { parseSpecials } from './core/specials';
import type { Special, Student } from './core/types';
import { t } from './i18n';
import type { PluginContext } from '../../../src/shared/plugin-api';

const FIRST_SPIN_MS = 6000;
const AGAIN_SPIN_MS = 3000;
const COUNTS_KEY = 'pickCounts';
const SPECIALS_KEY = 'specials';
const SKIN_KEY = 'skin';

// shallowRef: this data is replaced, never changed in place, and a reactive Proxy cannot cross the bridge.
const context = shallowRef<PluginContext | null>(null);
const counts = shallowRef<PickCounts>({});
const specials = shallowRef<Special[]>([]);
const skin = ref<Skin>(DEFAULT_SKIN);
const loading = ref(true);
const loadError = ref('');

// Session only on purpose: it is "fair" again whenever the plugin is started.
const fair = ref(true);
const picking = ref(false);
const error = ref('');
const result = shallowRef<Student | null>(null);
const special = shallowRef<Special | null>(null);
// Whichever skin is shown; both play a decided result back the same way.
const machine = ref<{ spinTo: (id: string, durationMs: number) => Promise<void> } | null>(null);
/** Key of the confetti shower; 0 when none is falling. A new key starts a new shower. */
const confetti = ref(0);
const editingSpecials = ref(false);
const confirmingReset = ref(false);

const students = computed(() => applyCounts(context.value?.students ?? [], counts.value));
const items = computed(() => {
  const pool = fair.value ? fairPool(students.value) : students.value;
  return layoutItems(pool, activeSpecials(specials.value, fair.value));
});
const dialogOpen = computed(() => !!result.value || !!special.value || editingSpecials.value || confirmingReset.value);

async function load(): Promise<void> {
  try {
    context.value = unwrap(await window.grader.context());
    counts.value = parsePickCounts(unwrap(await window.grader.storage.get(COUNTS_KEY)));
    specials.value = parseSpecials(unwrap(await window.grader.storage.get(SPECIALS_KEY)));
    skin.value = parseSkin(unwrap(await window.grader.storage.get(SKIN_KEY)));
  } catch (e: unknown) {
    loadError.value = errorText(e);
  } finally {
    loading.value = false;
  }
}

// Who is absent can change in Grader while this window is open, so look again when the window gets the focus.
async function refreshContext(): Promise<void> {
  if (picking.value || dialogOpen.value || !context.value) return;
  try {
    context.value = unwrap(await window.grader.context());
  } catch (e: unknown) {
    error.value = errorText(e);
  }
}

onMounted(() => {
  void load();
  window.addEventListener('focus', refreshContext);
});
onBeforeUnmount(() => window.removeEventListener('focus', refreshContext));

async function run(action: () => Promise<void>): Promise<void> {
  error.value = '';
  picking.value = true;
  try {
    await action();
  } catch (e: unknown) {
    error.value = errorText(e);
  } finally {
    picking.value = false;
  }
}

async function saveCounts(next: PickCounts): Promise<void> {
  unwrap(await window.grader.storage.set(COUNTS_KEY, toPlain(next)));
}

async function spin(): Promise<void> {
  await run(async () => {
    const outcome = draw({ students: students.value, specials: specials.value, fair: fair.value, random: Math.random });
    if (!outcome.ok) {
      error.value = t('machine.noStudentToPick');
      return;
    }
    await play(outcome.spins);
  });
}

/** The winner is decided and saved up front; the machine only plays the result back. */
async function play(spins: DrawResult[]): Promise<void> {
  const last = spins.at(-1);
  const next = last?.kind === 'student' ? incrementCount(counts.value, last.studentId) : null;
  if (next) await saveCounts(next);

  for (const [index, step] of spins.entries()) {
    const id = step.kind === 'student' ? step.studentId : step.special.id;
    await machine.value?.spinTo(id, index === 0 ? FIRST_SPIN_MS : AGAIN_SPIN_MS);
  }

  // Only now: the pick shrinks the fair pool, which would change the reels while they are still turning.
  if (next) counts.value = next;
  if (last?.kind === 'special') special.value = last.special;
  else if (last) {
    confetti.value += 1;
    showResult(last.studentId);
  }
}

async function pickDirect(studentId: string): Promise<void> {
  await run(async () => {
    const next = incrementCount(counts.value, studentId);
    await saveCounts(next);
    counts.value = next;
    showResult(studentId);
  });
}

function showResult(studentId: string): void {
  result.value = students.value.find((s) => s.id === studentId) ?? null;
}

async function setCount(studentId: string, value: number): Promise<void> {
  await run(async () => {
    const next = withCount(counts.value, studentId, value);
    await saveCounts(next);
    counts.value = next;
  });
}

async function resetCounts(): Promise<void> {
  confirmingReset.value = false;
  await run(async () => {
    await saveCounts({});
    counts.value = {};
  });
}

async function changeSkin(event: Event): Promise<void> {
  const next = parseSkin((event.target as HTMLSelectElement).value);
  const previous = skin.value;
  skin.value = next;
  await run(async () => {
    try {
      unwrap(await window.grader.storage.set(SKIN_KEY, next));
    } catch (e: unknown) {
      skin.value = previous;
      throw e;
    }
  });
}

async function saveSpecials(next: Special[]): Promise<string | null> {
  try {
    unwrap(await window.grader.storage.set(SPECIALS_KEY, toPlain(next)));
    specials.value = next;
    return null;
  } catch (e: unknown) {
    return errorText(e);
  }
}
</script>

<style scoped>
.course {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toggle,
.skin {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* The student table keeps its natural width on the right; the machine takes all the remaining space. */
.layout {
  align-self: stretch;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: var(--space-6);
  align-items: start;
}
</style>
