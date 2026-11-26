<template>
  <div class="snow" aria-hidden="true" data-testid="snow">
    <i
      v-for="f in flakes"
      :key="f.id"
      class="flake"
      data-testid="snowflake"
      :style="{
        left: `${f.left}%`,
        width: `${f.size}px`,
        height: `${f.size}px`,
        opacity: f.opacity,
        animationDuration: `${f.durationMs}ms`,
        animationDelay: `${f.delayMs}ms`,
        '--sway': `${f.sway}px`,
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { snowflakes } from '../core/snow';

const FLAKES = 70;

// People who ask for less motion get no snow at all.
const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const flakes = reducedMotion ? [] : snowflakes(FLAKES, Math.random);
</script>

<style scoped>
/* Over the page but below the dialogs (z-index 10) and the confetti (20), and never in the way of a click. */
.snow {
  position: fixed;
  inset: 0;
  z-index: 5;
  overflow: hidden;
  pointer-events: none;
}

.flake {
  position: absolute;
  top: -10px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 30%, rgb(255 255 255 / 0%) 100%);
  box-shadow: 0 0 4px rgb(255 255 255 / 60%);
  animation: fall linear infinite;
}

/* The sway is a second movement on top of the fall: the flake drifts to one side and back while it falls. */
@keyframes fall {
  0% {
    transform: translate(0, 0);
  }

  25% {
    transform: translate(var(--sway), 27vh);
  }

  50% {
    transform: translate(0, 54vh);
  }

  75% {
    transform: translate(calc(var(--sway) * -1), 81vh);
  }

  100% {
    transform: translate(0, calc(100vh + 20px));
  }
}
</style>
