<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="dialog" style="--dialog-width: 400px" role="dialog" aria-modal="true" :aria-label="special.label">
      <h2 data-testid="special-label">{{ special.label }}</h2>
      <p v-if="special.message">{{ special.message }}</p>
      <div class="actions">
        <button class="primary" @click="emit('close')">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Special } from '../core/types';
import { t } from '../i18n';

defineProps<{ special: Special }>();
const emit = defineEmits<{ close: [] }>();
</script>
