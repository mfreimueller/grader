<template>
  <div class="casino stage-box" data-testid="casino" :data-scene="scene">
    <header class="bar">
      <span class="score" data-testid="casino-score">{{ t('casino.score', { class: score.class, bank: score.bank }) }}</span>
      <span class="hint">{{ t('casino.hint') }}</span>
      <label class="mute"><input type="checkbox" :checked="!muted" data-testid="casino-sound" @change="toggleSound"> {{ t('casino.sound') }}</label>
      <button type="button" class="btn-casino quiet small" data-testid="casino-settings" :disabled="busy" @click="editing = true">{{ t('casino.settings') }}</button>
    </header>

    <div v-if="scene === 'roulette'" class="scene roulette-scene rail">
      <div class="roulette-felt baize">
        <div class="wheel-box"><RouletteWheel ref="wheel" :items="items" :disabled="busy || disabled" @spin="spin" /></div>
        <div class="side">
          <div class="display" aria-live="polite">
            <template v-if="picked">
              <b class="number" :class="pickedPocket?.color" data-testid="casino-number">{{ pickedPocket?.number ?? '' }}</b>
              <strong class="name" data-testid="casino-picked">{{ picked.firstName }} {{ picked.lastName }}</strong>
            </template>
            <span v-else class="call" :class="{ live: spinning }">{{ spinning ? t('casino.spinning') : t('casino.ready') }}</span>
          </div>
          <button v-if="picked" type="button" class="btn-casino primary" data-testid="casino-deal" :disabled="disabled" @click="toTable">
            {{ t('casino.deal') }} <kbd>Enter</kbd>
          </button>
          <button type="button" :class="['btn-casino', picked ? 'quiet' : 'primary']" data-testid="spin" :disabled="busy || disabled" @click="spin">
            {{ t('casino.spin') }} <kbd>Leertaste</kbd>
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="picked" class="scene table-scene">
      <BlackjackTable
        :key="tableKey"
        :student-name="`${picked.firstName} ${picked.lastName}`"
        :settings="settings"
        :disabled="disabled"
        @outcome="(o) => (score = addToScore(score, o))"
        @finished="leaveTable"
      />
    </div>

    <Teleport to="body">
      <CasinoSettingsEditor v-if="editing" :settings="settings" :persist="saveSettings" @close="editing = false" />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import RouletteWheel from './RouletteWheel.vue';
import BlackjackTable from './BlackjackTable.vue';
import CasinoSettingsEditor from './CasinoSettingsEditor.vue';
import { activeSpecials, draw, fairPool } from '../../core/draw';
import { addToScore, DEFAULT_CASINO_SETTINGS, parseCasinoSettings, withoutPassed, type CasinoSettings } from '../../core/casino';
import { layoutItems } from '../../core/layout';
import { roulettePockets } from '../../core/rouletteGeometry';
import { errorText, toPlain, unwrap } from '../../core/bridgeError';
import type { Special, Student } from '../../core/types';
import { markPassed, passed, score } from '../../casino/session';
import { sound } from '../../casino/sound';
import { t } from '../../i18n';
import '../../casino/casino.css';

const props = defineProps<{ students: Student[]; specials: Special[]; fair: boolean; disabled: boolean }>();
const emit = defineEmits<{
  answer: [studentId: string];
  special: [special: Special];
  busy: [busy: boolean];
  scene: [scene: 'roulette' | 'table'];
  error: [message: string];
}>();

const FIRST_SPIN_MS = 8000;
const AGAIN_SPIN_MS = 5000;
const SETTINGS_KEY = 'casino';
const MUTED_KEY = 'casinoMuted';

const scene = ref<'roulette' | 'table'>('roulette');
const settings = shallowRef<CasinoSettings>(DEFAULT_CASINO_SETTINGS);
const muted = ref(false);
const editing = ref(false);
const spinning = ref(false);
const pickedId = ref<string | null>(null);
const tableKey = ref(0);
const wheel = ref<{ spinTo: (id: string, ms: number) => Promise<void> } | null>(null);

const pool = computed(() => withoutPassed(props.students, passed.value));
const items = computed(() => layoutItems(props.fair ? fairPool(pool.value) : pool.value, activeSpecials(props.specials, props.fair)));
const picked = computed(() => props.students.find((s) => s.id === pickedId.value) ?? null);
const pickedPocket = computed(() => roulettePockets(items.value).find((p) => p.id === pickedId.value) ?? null);
const busy = computed(() => spinning.value || scene.value === 'table');

function setBusy(next: boolean): void {
  emit('busy', next);
}

function setScene(next: 'roulette' | 'table'): void {
  scene.value = next;
  emit('scene', next);
  setBusy(spinning.value || next === 'table');
}

async function spin(): Promise<void> {
  if (busy.value || props.disabled) return;
  const outcome = draw({ students: pool.value, specials: props.specials, fair: props.fair, random: Math.random });
  if (!outcome.ok) {
    emit('error', passed.value.size > 0 && pool.value.length === 0 ? t('casino.allPassed') : t('machine.noStudentToPick'));
    return;
  }
  pickedId.value = null;
  spinning.value = true;
  setBusy(true);
  try {
    for (const [index, step] of outcome.spins.entries()) {
      const id = step.kind === 'student' ? step.studentId : step.special.id;
      await wheel.value?.spinTo(id, index === 0 ? FIRST_SPIN_MS : AGAIN_SPIN_MS);
    }
  } finally {
    spinning.value = false;
    setBusy(false);
  }
  sound.ding();
  const last = outcome.spins.at(-1);
  if (last?.kind === 'student') pickedId.value = last.studentId;
  else if (last?.kind === 'special' && last.special.kind === 'message') emit('special', last.special);
}

function toTable(): void {
  if (!picked.value || props.disabled) return;
  tableKey.value += 1;
  setScene('table');
}

/** A direct pick from the student table goes straight to the blackjack table. */
function dealFor(studentId: string): void {
  if (busy.value) return;
  pickedId.value = studentId;
  toTable();
}

function leaveTable(result: 'answer' | 'pass'): void {
  const id = pickedId.value;
  pickedId.value = null;
  setScene('roulette');
  if (!id) return;
  if (result === 'pass') markPassed(id);
  else emit('answer', id);
}

async function saveSettings(next: CasinoSettings): Promise<string | null> {
  try {
    unwrap(await window.grader.storage.set(SETTINGS_KEY, toPlain(next)));
    settings.value = next;
    return null;
  } catch (e: unknown) {
    return errorText(e);
  }
}

async function toggleSound(): Promise<void> {
  muted.value = !muted.value;
  sound.setEnabled(!muted.value);
  try {
    unwrap(await window.grader.storage.set(MUTED_KEY, muted.value));
  } catch (e: unknown) {
    emit('error', errorText(e));
  }
}

function onKey(event: KeyboardEvent): void {
  if (scene.value !== 'roulette' || props.disabled || editing.value || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button, [contenteditable]')) return;
  if (event.key === ' ') {
    event.preventDefault();
    void spin();
  } else if (event.key === 'Enter' && picked.value && !spinning.value) {
    event.preventDefault();
    toTable();
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  try {
    settings.value = parseCasinoSettings(unwrap(await window.grader.storage.get(SETTINGS_KEY)));
    muted.value = unwrap(await window.grader.storage.get(MUTED_KEY)) === true;
    sound.setEnabled(!muted.value);
  } catch (e: unknown) {
    emit('error', errorText(e));
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  if (scene.value === 'table') setBusy(false);
});

defineExpose({ dealFor });
</script>

<style scoped src="./CasinoStage.css"></style>
