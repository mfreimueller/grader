<template>
  <div class="overlay">
    <div class="dialog" style="--dialog-width: 420px" role="alertdialog" aria-modal="true" :aria-label="t('casino.disclaimerTitle')" data-testid="casino-disclaimer">
      <h2>{{ t('casino.disclaimerTitle') }}</h2>
      <p>{{ t('casino.disclaimer') }}</p>
      <div class="actions">
        <button ref="ok" class="primary" data-testid="casino-disclaimer-ok" @click="emit('close')">{{ t('casino.understood') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { t } from '../../i18n';

const emit = defineEmits<{ close: [] }>();
const ok = ref<HTMLButtonElement | null>(null);
onMounted(() => ok.value?.focus());
</script>
