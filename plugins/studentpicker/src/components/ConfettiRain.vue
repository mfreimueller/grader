<template>
  <div v-if="pieces.length" class="confetti" aria-hidden="true" data-testid="confetti">
    <i
      v-for="p in pieces"
      :key="p.id"
      :class="['piece', p.shape]"
      :style="{
        left: `${p.left}%`,
        width: `${p.width}px`,
        height: `${p.height}px`,
        background: p.color,
        opacity: p.opacity,
        animationDelay: `${p.delayMs}ms`,
        animationDuration: `${p.durationMs}ms`,
        '--rotation': `${p.rotation}deg`,
        '--spin': `${p.spin}deg`,
        '--drift': `${p.drift}px`,
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { confettiPieces } from '../core/confetti';

const emit = defineEmits<{ done: [] }>();

const PIECES = 140;

// People who ask for less motion get no confetti at all.
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const pieces = reducedMotion ? [] : confettiPieces(PIECES, Math.random);
let timer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  const lastMs = Math.max(0, ...pieces.map((p) => p.delayMs + p.durationMs));
  timer = setTimeout(() => emit('done'), lastMs);
});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<style scoped>
/* Above the result dialog, and never in the way of a click. */
.confetti {
  position: fixed;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  pointer-events: none;
}

.piece {
  position: absolute;
  top: -24px;
  transform: rotate(var(--rotation));
  animation-name: fall;
  animation-timing-function: cubic-bezier(0.3, 0.5, 0.6, 1);
  animation-fill-mode: both;
}

.strip {
  border-radius: 2px;
}

.dot {
  border-radius: 50%;
}

@keyframes fall {
  to {
    transform: translate(var(--drift), calc(100vh + 48px)) rotate(calc(var(--rotation) + var(--spin)));
  }
}
</style>
