<template>
  <div class="overlay">
    <div class="dialog" style="--dialog-width: 720px" role="dialog" aria-modal="true" :aria-label="t('specials.title')">
      <h2>{{ t('specials.title') }}</h2>
      <p class="hint">{{ t('specials.intro') }}</p>

      <p v-if="draft.length === 0" data-testid="specials-empty">{{ t('specials.empty') }}</p>
      <ul class="rows">
        <li v-for="(s, i) in draft" :key="s.id" class="row" :data-testid="`special-row-${i}`">
          <input v-model="s.color" type="color" :aria-label="t('specials.color')">
          <input v-model="s.label" class="label" :placeholder="t('specials.label')" :aria-label="t('specials.label')" :data-testid="`special-label-${i}`">
          <select v-model="s.kind" :aria-label="t('specials.kind')" :data-testid="`special-kind-${i}`">
            <option value="spin-again">{{ t('specials.kinds.spin-again') }}</option>
            <option value="message">{{ t('specials.kinds.message') }}</option>
          </select>
          <label class="prob">
            <input v-model.number="s.probability" type="number" min="0" max="99.9" step="0.5" :aria-label="t('specials.probability')" :data-testid="`special-prob-${i}`">
            %
          </label>
          <select v-model="s.showIn" :aria-label="t('specials.showIn')" :data-testid="`special-showin-${i}`">
            <option value="always">{{ t('specials.always') }}</option>
            <option value="free-only">{{ t('specials.freeOnly') }}</option>
          </select>
          <button type="button" :aria-label="t('specials.remove')" :data-testid="`special-remove-${i}`" @click="draft.splice(i, 1)">×</button>
          <textarea
            v-if="s.kind === 'message'"
            v-model="s.message"
            class="message"
            rows="2"
            :placeholder="t('specials.message')"
            :aria-label="t('specials.message')"
          />
        </li>
      </ul>

      <button type="button" data-testid="special-add" @click="add">{{ t('specials.add') }}</button>

      <p class="small" data-testid="specials-share">{{ t('specials.share', { n: share.toFixed(1) }) }}</p>
      <p v-if="problemText" class="error" role="alert" data-testid="specials-error">{{ problemText }}</p>

      <div class="actions">
        <button type="button" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="button" class="primary" data-testid="specials-save" :disabled="!!problemText || saving" @click="save">
          {{ t('specials.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { newSpecial, prepareForSave, shareForStudents, specialsProblem } from '../core/specials';
import type { Special } from '../core/types';
import { t } from '../i18n';

const props = defineProps<{
  specials: Special[];
  /** Stores the specials; answers with the reason it failed, or null. */
  persist: (specials: Special[]) => Promise<string | null>;
}>();
const emit = defineEmits<{ close: [] }>();

const draft = ref<Special[]>(props.specials.map((s) => ({ ...s })));
const saving = ref(false);
const failure = ref('');

const share = computed(() => shareForStudents(draft.value));
const problemText = computed(() => {
  if (failure.value) return failure.value;
  const problem = specialsProblem(draft.value);
  return problem ? t(`specials.errors.${problem}`) : '';
});

function add(): void {
  draft.value.push(newSpecial(`sp_${crypto.randomUUID()}`));
}

async function save(): Promise<void> {
  saving.value = true;
  failure.value = '';
  try {
    const failed = await props.persist(prepareForSave(draft.value));
    if (failed) failure.value = failed;
    else emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.label {
  flex: none;
  width: 200px;
}

.prob {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 18px;
}

.prob input {
  width: 56px;
}

.message {
  flex-basis: 100%;
  height: 56px;
}

.dialog > button {
  align-self: flex-start;
}
</style>
