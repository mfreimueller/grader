<template>
  <div
    class="wheel"
    :class="{ spinning }"
    role="group"
    :aria-label="t('wheel.label')"
    data-testid="picker"
    :data-item-count="items.length"
  >
    <!-- Laid out in design pixels (Figma "Schülerauswahl"), with the disc centre at 0 0, and scaled to the space.
         The view box ends at the rim and the pointer; the rim's shadow is drawn beyond it. -->
    <svg viewBox="-180 -180 376 360" class="stage">
      <defs>
        <pattern id="special-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#fff" stroke-opacity="0.3" stroke-width="2.5" />
        </pattern>
      </defs>
      <image :href="rimUrl" x="-198" y="-190" width="396" height="396" />
      <g class="disc" :style="{ transform: `rotate(${rotation}deg)`, transition: `transform ${transitionMs}ms cubic-bezier(0.12, 0.7, 0.1, 1)` }">
        <g v-for="segment in segments" :key="segment.id" :data-segment="segment.id">
          <path :d="segment.path" :fill="segment.color" class="segment" />
          <path v-if="segment.special" :d="segment.path" fill="url(#special-hatch)" />
          <text
            v-bind="labelPlacement(segment.labelAngle)"
            dominant-baseline="middle"
            :font-size="won && segment.id === winnerId ? fontSize + 1 : fontSize"
            :font-weight="won && segment.id === winnerId ? 700 : 500"
            :fill="segment.textColor"
          >
            {{ segment.label }}
          </text>
        </g>
      </g>
      <!-- The disc spins on a click, too; the button below is the accessible way to start. -->
      <circle class="hit" :r="WHEEL_RADIUS" aria-hidden="true" @click="request" />
      <image :href="hubUrl" x="-40" y="-38" width="80" height="80" />
      <image :href="hubDotUrl" x="-12" y="-12" width="24" height="24" />
      <image :href="pointerUrl" x="154" y="-18" width="40" height="36" />
    </svg>

    <button type="button" class="primary" data-testid="spin" :disabled="disabled" @click="request">{{ t('wheel.spin') }}</button>
    <p class="status" aria-live="polite">{{ spinning ? t('wheel.statusSpinning') : t('wheel.statusIdle') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../i18n';
import type { WheelItem } from '../core/types';
import { computeSegments, computeSpinRotation, isLabelFlipped, WHEEL_RADIUS, wheelFontSize } from '../core/wheelGeometry';
import rimUrl from '../assets/wheel/rim.svg';
import hubUrl from '../assets/wheel/hub.svg';
import hubDotUrl from '../assets/wheel/hub-dot.svg';
import pointerUrl from '../assets/wheel/pointer.svg';

const props = defineProps<{ items: WheelItem[]; disabled?: boolean }>();
const emit = defineEmits<{ spin: [] }>();

const LABEL_X = WHEEL_RADIUS - 20;

const rotation = ref(0);
/** Where the disc comes to rest; the labels are turned for this, so they read upright once it stops. */
const restRotation = ref(0);
const transitionMs = ref(0);
const spinning = ref(false);
const won = ref(false);
const winnerId = ref<string | null>(null);
const timers = new Set<ReturnType<typeof setTimeout>>();

const segments = computed(() => computeSegments(props.items));
const fontSize = computed(() => wheelFontSize(props.items.length));

// A different set of items means different segments: stay where the disc is, without animating back.
watch(
  () => props.items.map((i) => i.id).join('|'),
  () => {
    transitionMs.value = 0;
    rotation.value %= 360;
    restRotation.value = rotation.value;
    won.value = false;
  },
);

/** A label ends 20 px inside the rim, as in the design; on the left half it starts there and reads inwards. */
function labelPlacement(angle: number): { transform: string; 'text-anchor': 'start' | 'end' } {
  return isLabelFlipped(angle, restRotation.value)
    ? { transform: `rotate(${angle}) translate(${LABEL_X} 0) rotate(180)`, 'text-anchor': 'start' }
    : { transform: `rotate(${angle}) translate(${LABEL_X} 0)`, 'text-anchor': 'end' };
}

function request(): void {
  if (!props.disabled && props.items.length > 0) emit('spin');
}

/** Spins the disc so the item ends up under the pointer; resolves when the spin is over. */
function spinTo(id: string, durationMs: number): Promise<void> {
  const index = props.items.findIndex((i) => i.id === id);
  if (index < 0) return Promise.resolve();

  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const ms = reducedMotion ? 0 : durationMs;
  won.value = false;
  winnerId.value = id;
  spinning.value = ms > 0;
  transitionMs.value = ms;
  rotation.value = computeSpinRotation({ count: props.items.length, index, current: rotation.value, jitter: Math.random() - 0.5 });
  restRotation.value = rotation.value;

  return new Promise((resolve) => {
    const handle = setTimeout(() => {
      timers.delete(handle);
      spinning.value = false;
      won.value = true;
      resolve();
    }, ms);
    timers.add(handle);
  });
}

onBeforeUnmount(() => timers.forEach(clearTimeout));

defineExpose({ spinTo });
</script>

<style scoped>
/* Takes the width of its grid column; the wheel inside scales with it but stays on screen. */
.wheel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
}

.stage {
  width: 100%;
  max-height: calc(100vh - 230px);
  min-height: 240px;
  overflow: visible;
}

.disc {
  transform-origin: 0 0;
}

.segment {
  stroke: var(--color-surface);
  stroke-width: 2;
}

.hit {
  fill: transparent;
  cursor: pointer;
}

.wheel:has(button:disabled) .hit {
  cursor: default;
}

.status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
