<template>
  <div class="advent" role="group" :aria-label="t('advent.label')" data-testid="advent">
    <AdventScene />
    <div class="doors">
      <button
        v-for="cell in cells"
        :key="cell.door"
        type="button"
        class="door"
        :class="{ open: cell.content, wobbling: cell.wobbling, even: cell.door % 2 === 0 }"
        :data-testid="`advent-door-${cell.door}`"
        :aria-label="cell.content ? t('advent.doorOpen', { n: cell.door, name: contentText(cell.content) }) : t('advent.door', { n: cell.door })"
        :disabled="disabled || !!cell.content"
        @click="emit('open', cell.door)"
      >
        <span v-if="cell.content" class="inside" :style="insideStyle(cell.content)">
          <span class="small-number">{{ cell.door }}</span>
          <span class="content" :class="sizeClass(contentText(cell.content))">{{ contentText(cell.content) }}</span>
        </span>
        <span class="leaf" aria-hidden="true">
          <span class="number">{{ cell.door }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue';
import { t } from '../i18n';
import type { AdventCalendar, DoorContent } from '../core/advent';
import AdventScene from './AdventScene.vue';

const props = defineProps<{ calendar: AdventCalendar; disabled?: boolean }>();
const emit = defineEmits<{ open: [door: number] }>();

type Phase = 'wobble' | 'open' | 'done';
/** The door that is being opened right now. The calendar only learns about it afterwards. */
const revealing = shallowRef<{ door: number; content: DoorContent; phase: Phase } | null>(null);
const timers = new Set<ReturnType<typeof setTimeout>>();

const cells = computed(() =>
  props.calendar.order.map((door) => {
    const current = revealing.value?.door === door ? revealing.value : null;
    const content = props.calendar.doors[door] ?? (current && current.phase !== 'wobble' ? current.content : null);
    return { door, content, wobbling: current?.phase === 'wobble' };
  }),
);

function contentText(content: DoorContent): string {
  return content.kind === 'student' ? content.name : content.label;
}

function insideStyle(content: DoorContent): Record<string, string> {
  return content.kind === 'special' ? { '--paper': content.color, '--ink': inkOn(content.color) } : {};
}

/** Dark or white ink, whichever reads better on the color. */
function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 150 ? '#1f2937' : '#ffffff';
}

/** Long names get smaller letters so they stay inside the door. */
function sizeClass(text: string): string {
  return text.length <= 12 ? 'large' : text.length <= 20 ? 'medium' : 'small';
}

function later(ms: number, action: () => void): void {
  const handle = setTimeout(() => {
    timers.delete(handle);
    action();
  }, ms);
  timers.add(handle);
}

/**
 * Opens the door with what the draw decided: it wobbles for a moment, then swings open on its hinge.
 * Resolves when it is open. People who ask for less motion get a quick fade instead.
 */
function reveal(door: number, content: DoorContent, durationMs: number): Promise<void> {
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const total = reducedMotion ? 150 : durationMs;
  const wobble = reducedMotion ? 0 : total * 0.35;
  revealing.value = { door, content, phase: wobble > 0 ? 'wobble' : 'open' };

  return new Promise((resolve) => {
    later(wobble, () => {
      revealing.value = { door, content, phase: 'open' };
      later(total - wobble, () => {
        revealing.value = { door, content, phase: 'done' };
        resolve();
      });
    });
  });
}

onBeforeUnmount(() => timers.forEach(clearTimeout));

defineExpose({ reveal });
</script>

<style scoped>
/* The scene is 3:2 and scales with the column, but stays on screen. */
.advent {
  --gold: #e3b95a;

  position: relative;
  width: min(100%, calc((100vh - 200px) * 1.5));
  aspect-ratio: 3 / 2;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgb(7 13 39 / 45%);
}

/* Six by four doors over the sky; the village stays visible below them. */
.doors {
  position: absolute;
  inset: 4% 3.5% 28%;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 2.4% 1.6%;
}

.door {
  position: relative;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  perspective: 500px;
  container-type: inline-size;
  cursor: pointer;
}

.door:hover:not(:disabled),
.door:disabled {
  background: none;
}

.door:disabled:not(.open) {
  cursor: default;
  filter: brightness(0.8);
}

.door.open:disabled {
  opacity: 1;
  cursor: default;
}

.door:hover:not(:disabled) .leaf {
  filter: brightness(1.15);
}

/* What is behind the door: warm paper, or the color of the special. */
.inside {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14% 8% 8%;
  border-radius: 3px;
  background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--paper, #fff6dc) 90%, #fff) 0%, var(--paper, #f1dca0) 100%);
  box-shadow: inset 0 0 0 2px var(--gold), inset 0 3px 10px rgb(60 30 0 / 35%);
  color: var(--ink, #4a2c12);
}

.small-number {
  position: absolute;
  top: 4%;
  left: 7%;
  font: 600 9px/1 'Bodoni Moda', Georgia, serif;
  opacity: 0.7;
}

.content {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  font-family: 'Bodoni Moda', Georgia, serif;
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  overflow-wrap: anywhere;
  hyphens: auto;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.content.large {
  font-size: 17cqw;
}

.content.medium {
  font-size: 13cqw;
}

.content.small {
  font-size: 10cqw;
}

/* The door itself: green and red, with a golden frame. It turns on the hinge at its left edge. */
.leaf {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 14%) 0%, rgb(255 255 255 / 0%) 45%),
    linear-gradient(160deg, #1f6b47 0%, #134d33 100%);
  box-shadow: inset 0 0 0 2px var(--gold), inset 0 0 0 5px rgb(0 0 0 / 22%), 0 2px 4px rgb(0 0 0 / 45%);
  transform-origin: left center;
  transition: transform 900ms cubic-bezier(0.3, 0.1, 0.2, 1), opacity 300ms;
}

.door.even .leaf {
  background:
    linear-gradient(135deg, rgb(255 255 255 / 14%) 0%, rgb(255 255 255 / 0%) 45%),
    linear-gradient(160deg, #b3263a 0%, #801a2b 100%);
}

.door.open .leaf {
  transform: rotateY(-78deg);
}

.door.wobbling .leaf {
  animation: wobble 420ms ease-in-out;
}

.number {
  font: 700 28cqw/1 'Bodoni Moda', Georgia, serif;
  color: #fbe9b0;
  text-shadow: 0 1px 2px rgb(0 0 0 / 55%);
}

@keyframes wobble {
  0%,
  100% {
    transform: rotate(0);
  }

  20% {
    transform: rotate(-2.5deg) translateX(-1px);
  }

  45% {
    transform: rotate(2.5deg) translateX(1px);
  }

  70% {
    transform: rotate(-1.5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .leaf {
    transition: opacity 150ms;
  }

  .door.open .leaf {
    transform: none;
    opacity: 0;
  }

  .door.wobbling .leaf {
    animation: none;
  }
}
</style>
