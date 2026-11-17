<template>
  <section class="table rail" data-testid="blackjack-table" :data-phase="phase">
    <div class="felt baize">
      <div class="shoe" :title="t('casino.shoeLeft', { n: shoeLeft })"><div class="shoe-body"><div class="shoe-stack" :style="{ '--fill': shoeFill }" /></div></div>

      <div class="zone">
        <div class="plate"><span class="role">{{ t('casino.bank') }}</span><strong>{{ settings.dealerName }}</strong></div>
        <div class="hand-row">
          <div class="hand dealer">
            <div class="total" :class="dealerTotal.cls" data-testid="dealer-total">{{ dealerTotal.text }}</div>
            <div class="cards" :style="{ '--k': Math.max(0, dealerCards.length - 1) }">
              <PlayingCard v-for="(c, i) in dealerCards" :key="`d${i}`" :card="c" :index="i" :face-down="i === 1 && !holeOpen" />
            </div>
          </div>
        </div>
      </div>

      <svg class="print" viewBox="0 0 800 90" aria-hidden="true">
        <path id="arc" d="M60 20 Q400 110 740 20" fill="none" />
        <text class="print-big"><textPath href="#arc" startOffset="50%" text-anchor="middle">BLACKJACK ZAHLT 3 ZU 2</textPath></text>
        <text x="400" y="86" text-anchor="middle" class="print-small">{{ t('casino.printRules') }}</text>
      </svg>

      <div class="zone">
        <div class="hand-row">
          <div class="hand" :class="{ bust: result?.outcome.result === 'bust' }">
            <div class="total" :class="playerTotal.cls" data-testid="player-total">{{ playerTotal.text }}</div>
            <div class="cards" :style="{ '--k': Math.max(0, playerCards.length - 1) }">
              <PlayingCard v-for="(c, i) in playerCards" :key="`p${i}`" :card="c" :index="i" />
            </div>
            <div class="bet" :class="chipsState">
              <i v-for="k in chipCount" :key="k" class="chip"><span>5</span></i>
            </div>
          </div>
        </div>
        <div class="plate" :class="{ turn: phase === 'player' }">
          <span class="role">{{ phase === 'player' ? t('casino.yourMove') : t('casino.player') }}</span>
          <strong data-testid="table-student">{{ studentName }}</strong>
        </div>
      </div>

      <p class="toast" :class="{ show: toast !== '' }" aria-live="polite">{{ toast }}</p>

      <div v-if="result" class="banner" :class="bannerKind" role="status" data-testid="table-result" :data-result="result.outcome.result" :data-consequence="result.consequence">
        <div class="banner-title">{{ bannerTitle }}</div>
        <div v-if="bannerLine" class="banner-line">{{ bannerLine }}</div>
        <div class="banner-stake">{{ stakeText }}</div>
      </div>
    </div>
  </section>

  <div class="controls">
    <template v-if="phase === 'player'">
      <button type="button" class="act" data-testid="bj-hit" @click="act('hit')">{{ t('casino.hit') }} <kbd>H</kbd></button>
      <button type="button" class="act stand" data-testid="bj-stand" @click="act('stand')">{{ t('casino.stand') }} <kbd>S</kbd></button>
      <button type="button" class="act double" data-testid="bj-double" :disabled="!allowed.double" @click="act('double')">{{ t('casino.double') }} <kbd>D</kbd></button>
    </template>
    <template v-else-if="phase === 'result' && result">
      <button v-if="result.consequence === 'pass'" type="button" class="btn-casino quiet" data-testid="bj-grade-anyway" @click="emit('finished', 'answer')">
        {{ t('casino.gradeAnyway') }} <kbd>B</kbd>
      </button>
      <button type="button" class="btn-casino primary" data-testid="bj-continue" @click="primary">{{ primaryLabel }} <kbd>Enter</kbd></button>
    </template>
  </div>

  <ConfettiRain v-if="confetti" :key="confetti" @done="confetti = 0" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import PlayingCard from './PlayingCard.vue';
import ConfettiRain from '../ConfettiRain.vue';
import * as bj from '../../core/blackjack';
import { consequence, type CasinoSettings, type Consequence } from '../../core/casino';
import { shoe } from '../../casino/session';
import { sound } from '../../casino/sound';
import { t } from '../../i18n';

const props = defineProps<{ studentName: string; settings: CasinoSettings; disabled?: boolean }>();
const emit = defineEmits<{ outcome: [outcome: bj.Outcome]; finished: [consequence: 'answer' | 'pass'] }>();

type Phase = 'dealing' | 'player' | 'revealing' | 'result';
type Action = 'hit' | 'stand' | 'double';

const STEP_MS = 450;
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const round = shallowRef<bj.Round | null>(null);
const shownPlayer = ref(0);
const shownDealer = ref(0);
const holeOpen = ref(false);
const phase = ref<Phase>('dealing');
const result = shallowRef<{ outcome: bj.Outcome; consequence: Consequence } | null>(null);
const toast = ref('');
const confetti = ref(0);
let alive = true;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, reducedMotion ? Math.min(ms, 150) : ms));

const playerCards = computed(() => round.value?.player.slice(0, shownPlayer.value) ?? []);
const dealerCards = computed(() => round.value?.dealer.slice(0, shownDealer.value) ?? []);
const allowed = computed(() => (round.value && phase.value === 'player' ? bj.allowedActions(round.value) : { hit: false, stand: false, double: false }));
const shoeLeft = computed(() => shoe.value?.cards.length ?? 312);
const shoeFill = computed(() => (shoeLeft.value / 312).toFixed(3));
const chipCount = computed(() => {
  const stake = round.value?.doubled ? 2 : 1;
  const won = result.value && result.value.outcome.net > 0 ? Math.ceil(result.value.outcome.net) : 0;
  return stake + won;
});
const chipsState = computed(() => (result.value ? (result.value.outcome.net < 0 ? 'lost' : result.value.outcome.net > 0 ? 'won' : '') : ''));

function totalOf(cards: readonly bj.Card[], canBlackjack: boolean): { text: string; cls: string } {
  if (cards.length === 0) return { text: '', cls: '' };
  const v = bj.handValue(cards);
  if (canBlackjack && bj.isBlackjack(cards)) return { text: 'Blackjack', cls: 'show bj' };
  if (v.total > 21) return { text: t('casino.totalBust', { n: v.total }), cls: 'show bust' };
  if (v.total === 21) return { text: '21', cls: 'show gold' };
  return { text: v.soft ? `${v.total - 10} / ${v.total}` : String(v.total), cls: 'show' };
}

const playerTotal = computed(() => totalOf(playerCards.value, true));
const dealerTotal = computed(() => totalOf(holeOpen.value ? dealerCards.value : dealerCards.value.slice(0, 1), holeOpen.value));

const bannerKind = computed(() => {
  const r = result.value?.outcome.result;
  return r === 'blackjack' ? 'blackjack' : r === 'win' ? 'win' : r === 'push' ? 'push' : 'lose';
});
const bannerTitle = computed(() => {
  const o = result.value?.outcome;
  if (!o) return '';
  if (o.result === 'blackjack') return 'Blackjack!';
  if (o.winner === 'player') return t('casino.playerWins', { name: props.studentName });
  if (o.winner === 'bank') return t('casino.bankWins', { name: props.settings.dealerName });
  return t('casino.push');
});
const bannerLine = computed(() => {
  const r = round.value;
  const o = result.value?.outcome;
  if (!r || !o) return '';
  if (o.result === 'bust') return t('casino.playerBust', { name: props.studentName });
  if (bj.isBlackjack(r.dealer) && o.winner === 'bank') return t('casino.dealerBlackjack', { name: props.settings.dealerName });
  if (bj.handValue(r.dealer).total > 21) return t('casino.dealerBust', { name: props.settings.dealerName });
  return '';
});
const stakeText = computed(() => {
  const c = result.value?.consequence;
  return c === 'pass' ? props.settings.winText : c === 'answer' ? props.settings.loseText : t('casino.pushAgain');
});
const primaryLabel = computed(() => {
  const c = result.value?.consequence;
  return c === 'answer' ? t('casino.toGrading') : c === 'pass' ? t('casino.backToWheel') : t('casino.dealAgain');
});

function say(text: string, ms: number): void {
  toast.value = text;
  setTimeout(() => {
    if (toast.value === text) toast.value = '';
  }, ms);
}

async function startHand(): Promise<void> {
  phase.value = 'dealing';
  result.value = null;
  holeOpen.value = false;
  shownPlayer.value = 0;
  shownDealer.value = 0;
  await wait(300);
  const current = shoe.value;
  if (!current || bj.needsShuffle(current)) {
    say(t('casino.shuffling'), 1500);
    sound.shuffle();
    await wait(1100);
  }
  const next = bj.deal(current ?? bj.newShoe(Math.random), Math.random);
  shoe.value = next.shoe;
  round.value = next;
  for (const who of ['player', 'dealer', 'player', 'dealer'] as const) {
    if (!alive) return;
    if (who === 'player') shownPlayer.value += 1;
    else shownDealer.value += 1;
    sound.deal();
    if (who === 'player' || shownDealer.value === 1) setTimeout(() => sound.flip(), 150);
    await wait(STEP_MS);
  }
  const up = next.dealer[0]?.value;
  if (up === 1 || up === 10) {
    say(t('casino.peek'), 1300);
    sound.peek();
    await wait(1200);
    if (!bj.isBlackjack(next.dealer)) say(t('casino.noBlackjack'), 1100);
  }
  if (next.phase === 'done') await finish(next);
  else phase.value = 'player';
}

async function act(action: Action): Promise<void> {
  const current = round.value;
  if (!current || phase.value !== 'player' || !allowed.value[action]) return;
  sound.click();
  phase.value = 'revealing';
  const next = action === 'hit' ? bj.hit(current) : action === 'stand' ? bj.stand(current) : bj.double(current);
  if (action === 'double') sound.chip();
  shoe.value = next.shoe;
  round.value = next;
  while (shownPlayer.value < next.player.length) {
    shownPlayer.value += 1;
    sound.deal();
    setTimeout(() => sound.flip(), 150);
    await wait(STEP_MS);
  }
  if (next.phase === 'done') await finish(next);
  else phase.value = 'player';
}

async function finish(r: bj.Round): Promise<void> {
  phase.value = 'revealing';
  if (bj.handValue(r.player).total > 21) {
    sound.bust();
    await wait(700);
  }
  holeOpen.value = true;
  sound.flip();
  await wait(700);
  while (shownDealer.value < r.dealer.length) {
    shownDealer.value += 1;
    sound.deal();
    setTimeout(() => sound.flip(), 150);
    await wait(650);
  }
  const o = bj.outcome(r);
  if (!o || !alive) return;
  result.value = { outcome: o, consequence: consequence(o, props.settings) };
  emit('outcome', o);
  phase.value = 'result';
  if (o.result === 'blackjack') sound.blackjack();
  else if (o.winner === 'player') sound.win();
  else if (o.winner === 'bank') sound.lose();
  else sound.push();
  if (o.winner === 'player') confetti.value += 1;
}

function primary(): void {
  const c = result.value?.consequence;
  if (c === 'deal-again') void startHand();
  else if (c) emit('finished', c);
}

function onKey(event: KeyboardEvent): void {
  if (props.disabled || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  // A focused button handles Enter itself; a second, keyboard-made call would deal twice.
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, button, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (phase.value === 'player' && (key === 'h' || key === 's' || key === 'd')) {
    event.preventDefault();
    void act(key === 'h' ? 'hit' : key === 's' ? 'stand' : 'double');
  } else if (phase.value === 'result' && key === 'enter') {
    event.preventDefault();
    primary();
  } else if (phase.value === 'result' && key === 'b' && result.value?.consequence === 'pass') {
    event.preventDefault();
    emit('finished', 'answer');
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
  void startHand();
});
onBeforeUnmount(() => {
  alive = false;
  window.removeEventListener('keydown', onKey);
});
</script>

<style scoped src="./BlackjackTable.css"></style>
