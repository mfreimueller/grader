<template>
  <div ref="box" class="roulette" data-testid="picker" :data-item-count="items.length" role="img" :aria-label="t('casino.wheelLabel')" @click="request">
    <div ref="plane" class="plane">
      <canvas ref="bowl" class="layer" />
      <canvas ref="head" class="layer head" />
      <div class="light" />
    </div>
    <canvas ref="ball" class="ball" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { roulettePockets } from '../../core/rouletteGeometry';
import type { WheelItem } from '../../core/types';
import { RouletteRenderer } from '../../casino/RouletteRenderer';
import { sound } from '../../casino/sound';
import { t } from '../../i18n';

const props = defineProps<{ items: WheelItem[]; disabled?: boolean }>();
const emit = defineEmits<{ spin: [] }>();

const box = ref<HTMLElement | null>(null);
const plane = ref<HTMLElement | null>(null);
const bowl = ref<HTMLCanvasElement | null>(null);
const head = ref<HTMLCanvasElement | null>(null);
const ball = ref<HTMLCanvasElement | null>(null);
let renderer: RouletteRenderer | null = null;

onMounted(() => {
  if (!box.value || !plane.value || !bowl.value || !head.value || !ball.value) return;
  renderer = new RouletteRenderer(
    { box: box.value, plane: plane.value, bowl: bowl.value, head: head.value, ball: ball.value },
    (event) => (event.kind === 'roll' ? sound.roll(event.seconds) : sound.clack(event.intensity)),
  );
  renderer.setPockets(roulettePockets(props.items));
});
onBeforeUnmount(() => renderer?.destroy());

watch(
  () => props.items.map((i) => `${i.id}:${i.label}`).join('|'),
  () => renderer?.setPockets(roulettePockets(props.items)),
);

function request(): void {
  if (!props.disabled && props.items.length > 0) emit('spin');
}

/** Rolls the ball into the pocket of the item; resolves when it rests there. */
function spinTo(id: string, durationMs: number): Promise<void> {
  return renderer?.spinTo(id, durationMs) ?? Promise.resolve();
}

defineExpose({ spinTo });
</script>

<style scoped>
.roulette {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  cursor: pointer;
}

.plane {
  position: absolute;
  transform-origin: 50% 50%;
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.head {
  will-change: transform;
}

.light {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(ellipse 46% 34% at 36% 24%, rgb(255 248 230 / 20%), rgb(255 248 230 / 0%) 70%),
    radial-gradient(circle at 50% 50%, rgb(0 0 0 / 0%) 60%, rgb(0 0 0 / 18%) 100%);
}

.ball {
  position: absolute;
  left: -10%;
  top: -10%;
  width: 120%;
  height: 120%;
  pointer-events: none;
}
</style>
