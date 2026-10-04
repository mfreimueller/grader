<template>
  <div class="wheel-wrap">
    <svg
      viewBox="-112 -112 224 224"
      class="wheel"
      role="group"
      :aria-label="ariaLabel"
    >
      <g
        class="disc"
        :style="{ transform: `rotate(${rotation}deg)`, transition: `transform ${transitionMs}ms cubic-bezier(0.12, 0.7, 0.1, 1)` }"
      >
        <g
          v-for="segment in segments"
          :key="segment.studentId"
          :class="['segment', { 'segment--disabled': disabled }]"
          role="button"
          :tabindex="disabled ? -1 : 0"
          :aria-label="segment.label"
          @click="select(segment.studentId)"
          @keydown.enter.prevent="select(segment.studentId)"
          @keydown.space.prevent="select(segment.studentId)"
        >
          <path :d="segment.path" :fill="segment.color" stroke="#fff" stroke-width="1" />
          <text
            :transform="`rotate(${segment.labelAngle}) translate(${labelX} 0)`"
            text-anchor="end"
            dominant-baseline="middle"
            :font-size="fontSize"
            fill="#fff"
          >
            {{ segment.label }}
          </text>
        </g>
      </g>
      <polygon points="98,0 112,-9 112,9" class="pointer" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { StudentPickDto } from '../../../shared/types';
import { computeSegments, computeSpinRotation, wheelFontSize } from '../../utils/wheelGeometry';

const props = defineProps<{
  students: StudentPickDto[];
  disabled?: boolean;
  ariaLabel?: string;
}>();

const emit = defineEmits<{ segmentClick: [studentId: string] }>();

const LABEL_INSET = 8;
const labelX = 100 - LABEL_INSET;

const rotation = ref(0);
const transitionMs = ref(0);

const segments = computed(() => computeSegments(props.students));
const fontSize = computed(() => wheelFontSize(props.students.length));

// A different set of students means different segments: drop back to rest without animating.
watch(
  () => props.students.map((s) => s.studentId).join('|'),
  () => {
    transitionMs.value = 0;
    rotation.value = 0;
  },
);

function select(studentId: string): void {
  if (!props.disabled) emit('segmentClick', studentId);
}

/** Spins the disc so the student's segment ends up under the pointer; resolves when the spin is over. */
function spinTo(studentId: string, durationMs: number): Promise<void> {
  const index = props.students.findIndex((s) => s.studentId === studentId);
  if (index < 0) return Promise.resolve();

  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  transitionMs.value = reducedMotion ? 0 : durationMs;
  rotation.value = computeSpinRotation({
    count: props.students.length,
    index,
    current: rotation.value,
    jitter: Math.random() - 0.5,
  });
  return new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : durationMs));
}

defineExpose({ spinTo });
</script>

<style scoped>
.wheel-wrap {
  display: flex;
  justify-content: center;
}

.wheel {
  width: min(100%, 630px);
  height: auto;
}

.disc {
  transform-origin: 0 0;
}

.segment {
  cursor: pointer;
  outline: none;
}

.segment:focus-visible path {
  stroke: var(--color-text);
  stroke-width: 3;
}

.segment--disabled {
  cursor: default;
}

.pointer {
  fill: var(--color-text);
}

text {
  pointer-events: none;
  font-weight: 600;
}
</style>
