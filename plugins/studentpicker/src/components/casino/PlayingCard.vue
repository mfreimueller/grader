<template>
  <div class="card" :class="{ down: faceDown }" :style="{ '--i': index, '--rot': `${rotation}deg` }" :aria-label="faceDown ? t('casino.cardHidden') : label">
    <div class="tilt">
      <div class="inner">
        <div class="face front" :class="red ? 'red' : 'black'">
          <div class="idx tl"><b>{{ card.rank }}</b><i>{{ suit }}</i></div>
          <div v-if="card.rank === 'A'" class="ace" :class="{ spades: card.suit === '♠' }">{{ suit }}</div>
          <svg v-else-if="court" class="court" viewBox="0 0 60 90" aria-hidden="true">
            <rect x="1" y="1" width="58" height="88" rx="3" fill="#fbf8ef" :stroke="ink" stroke-width="1.3" />
            <rect x="4.5" y="4.5" width="51" height="81" rx="1.5" fill="none" stroke="#c9a23a" stroke-width=".8" />
            <path d="M4.5 85.5 55.5 4.5" :stroke="ink" stroke-width=".7" opacity=".45" />
            <g v-for="turn in [0, 180]" :key="turn" :transform="`rotate(${turn} 30 45)`">
              <path :d="court" transform="translate(7 8)" fill="#d6a933" :stroke="ink" stroke-width=".9" stroke-linejoin="round" />
              <text x="37" y="31" text-anchor="middle" class="court-rank" :fill="ink">{{ card.rank }}</text>
              <text x="15" y="40" text-anchor="middle" font-family="Georgia, serif" font-size="14" :fill="ink">{{ suit }}</text>
            </g>
          </svg>
          <div v-else class="pips">
            <span v-for="([x, y], k) in pips" :key="k" class="pip" :class="{ flip: y > 50 }" :style="{ left: `${x}%`, top: `${y}%` }">{{ suit }}</span>
          </div>
          <div class="idx br"><b>{{ card.rank }}</b><i>{{ suit }}</i></div>
        </div>
        <div class="face back" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Card } from '../../core/blackjack';
import { t } from '../../i18n';

const props = defineProps<{ card: Card; index: number; faceDown?: boolean }>();

// The variation selector keeps the suits as text instead of emoji.
const VS = '︎';
const SUIT_NAMES: Record<Card['suit'], string> = { '♠': 'Pik', '♥': 'Herz', '♦': 'Karo', '♣': 'Kreuz' };
const CROWNS: Partial<Record<Card['rank'], string>> = {
  K: 'M2 13V5l4 3.5L10 2l4 6.5L18 5v8z',
  Q: 'M2 13l1-7 3 3.5 2-5 2 5 2-5 2 5 3-3.5 1 7z',
  J: 'M3 13c0-5.5 3-8 7-8s7 2.5 7 8zM10 5c1.2-2.6 4-3.6 6.5-2.6-2.2.2-4 1.1-5 2.8',
};
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 0], [50, 100]],
  3: [[50, 0], [50, 50], [50, 100]],
  4: [[0, 0], [100, 0], [0, 100], [100, 100]],
  5: [[0, 0], [100, 0], [50, 50], [0, 100], [100, 100]],
  6: [[0, 0], [100, 0], [0, 50], [100, 50], [0, 100], [100, 100]],
  7: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [0, 100], [100, 100]],
  8: [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [50, 75], [0, 100], [100, 100]],
  9: [[0, 0], [100, 0], [0, 33.3], [100, 33.3], [50, 50], [0, 66.7], [100, 66.7], [0, 100], [100, 100]],
  10: [[0, 0], [100, 0], [50, 16.7], [0, 33.3], [100, 33.3], [0, 66.7], [100, 66.7], [50, 83.3], [0, 100], [100, 100]],
};

const suit = computed(() => props.card.suit + VS);
const red = computed(() => props.card.suit === '♥' || props.card.suit === '♦');
const ink = computed(() => (red.value ? '#a5141f' : '#151312'));
const court = computed(() => CROWNS[props.card.rank] ?? null);
const pips = computed(() => PIPS[Number(props.card.rank)] ?? []);
const label = computed(() => `${SUIT_NAMES[props.card.suit]} ${props.card.rank}`);
// A slightly crooked card looks dealt by hand; fixed per card so it does not wobble on re-render.
const rotation = ((props.index * 37) % 9) / 2 - 2;
</script>

<style scoped>
.card {
  position: absolute;
  top: 0;
  left: calc(var(--i) * var(--fan));
  z-index: var(--i);
  width: var(--cw);
  height: var(--ch);
  animation: deal 0.48s cubic-bezier(0.16, 0.8, 0.26, 1) both;
}

@keyframes deal {
  from {
    opacity: 0;
    transform: translate(calc(var(--cw) * 4), calc(var(--ch) * -2.2)) rotate(-62deg) scale(0.7);
  }

  10% {
    opacity: 1;
  }
}

.tilt {
  width: 100%;
  height: 100%;
  transform: rotate(var(--rot, 0deg));
  perspective: 1000px;
}

.inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.42s cubic-bezier(0.3, 0.7, 0.3, 1);
}

.card.down .inner {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  border-radius: calc(var(--cw) * 0.07);
  overflow: hidden;
  backface-visibility: hidden;
}

.front {
  background: linear-gradient(170deg, #fff 0%, #f7f5ef 100%);
  box-shadow: 0 4px 10px rgb(0 0 0 / 35%), 0 1px 2px rgb(0 0 0 / 35%), inset 0 0 0 1px rgb(0 0 0 / 12%);
  font-family: var(--f-card);
}

.front.red {
  color: var(--c-red);
}

.front.black {
  color: var(--c-black);
}

.back {
  transform: rotateY(180deg);
  border: calc(var(--cw) * 0.06) solid #fff;
  background:
    repeating-linear-gradient(45deg, rgb(255 255 255 / 28%) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(-45deg, rgb(255 255 255 / 28%) 0 1px, transparent 1px 6px),
    var(--c-red);
  box-shadow: 0 4px 10px rgb(0 0 0 / 35%), 0 1px 2px rgb(0 0 0 / 35%);
}

.idx {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 0.92;
  font-weight: 700;
}

.idx b {
  font-size: calc(var(--cw) * 0.25);
  letter-spacing: -0.06em;
}

.idx i {
  font-style: normal;
  font-size: calc(var(--cw) * 0.17);
  font-family: Georgia, serif;
}

.tl {
  top: 5%;
  left: 6%;
}

.br {
  bottom: 5%;
  right: 6%;
  transform: rotate(180deg);
}

.pips {
  position: absolute;
  inset: 15% 30%;
}

.pip {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: Georgia, serif;
  font-size: calc(var(--cw) * 0.2);
  line-height: 1;
}

.pip.flip {
  transform: translate(-50%, -50%) rotate(180deg);
}

.ace {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: Georgia, serif;
  font-size: calc(var(--cw) * 0.48);
}

.ace.spades {
  font-size: calc(var(--cw) * 0.7);
}

.court {
  position: absolute;
  left: 19%;
  top: 12%;
  width: 62%;
  height: 76%;
}

.court-rank {
  font-family: var(--f-card);
  font-weight: 700;
  font-size: 24px;
}

@media (prefers-reduced-motion: reduce) {
  .card {
    animation: none;
  }

  .inner {
    transition: none;
  }
}
</style>
