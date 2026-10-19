<template>
  <div class="overlay" @click.self="close">
    <div class="dialog result" style="--dialog-width: 400px" role="dialog" aria-modal="true" :aria-label="t('result.selected', { name: fullName })">
      <div class="avatar" :style="{ background: avatarColor, color: avatarText }">{{ initials }}</div>
      <h2 data-testid="result-name">{{ fullName }}</h2>
      <p class="count" data-testid="result-count">{{ t('result.count', { n: student.pickCount }) }}</p>

      <template v-if="categories.length">
        <label class="caption" for="grade-category">{{ t('result.gradeOptional') }}</label>
        <select id="grade-category" v-model="categoryId" data-testid="grade-category" :disabled="saving" @change="changeCategory">
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>

        <div class="symbols" role="group">
          <button
            v-for="s in SYMBOLS"
            :key="s.value"
            type="button"
            :class="['symbol', { primary: selected === s.value }]"
            :disabled="saving"
            :aria-pressed="selected === s.value"
            :aria-label="t(`result.symbol.${s.value}`)"
            :title="t(`result.symbol.${s.value}`)"
            :data-testid="`grade-${s.value}`"
            @click="choose(s.value)"
          >
            {{ s.glyph }}
          </button>
        </div>
        <p class="caption">{{ t('result.undoHint') }}</p>

        <div class="comment">
          <label class="caption" for="grade-note">{{ t('result.noteLabel') }}</label>
          <textarea
            id="grade-note"
            v-model="note"
            rows="2"
            maxlength="2000"
            data-testid="grade-note"
            :placeholder="t('result.notePlaceholder')"
            @change="saveNote"
          />
          <p v-if="selected === null && note.trim() !== ''" class="caption" data-testid="grade-note-pending">
            {{ t('result.notePending') }}
          </p>
        </div>
      </template>
      <p v-else class="hint" data-testid="no-category">{{ t('result.noCategory') }}</p>

      <p v-if="saved" class="success" data-testid="grade-saved">{{ t('result.saved') }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div class="actions">
        <button class="primary" data-testid="result-close" :disabled="closing" @click="close">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { categoryChoices, defaultCategory } from '../core/categories';
import { GradeRecorder, type GradeOutcome, type GradeSymbol } from '../core/gradeRecorder';
import { labelColor } from '../core/layout';
import { errorText, BridgeFailure } from '../core/bridgeError';
import type { Student } from '../core/types';
import { t } from '../i18n';
import type { PluginCategory } from '../../../../src/shared/plugin-api';

const props = defineProps<{
  student: Student;
  /** All categories of the course; the ones that take a symbol are picked here. */
  allCategories: PluginCategory[];
}>();
const emit = defineEmits<{ close: [] }>();

const SYMBOLS: { value: GradeSymbol; glyph: string }[] = [
  { value: 'PLUS', glyph: '+' },
  { value: 'PLUS_WELLE', glyph: '+~' },
  { value: 'WELLE', glyph: '~' },
  { value: 'MINUS_WELLE', glyph: '−~' },
  { value: 'MINUS', glyph: '−' },
];

const categories = computed(() => categoryChoices(props.allCategories));
const categoryId = ref(defaultCategory(categoryChoices(props.allCategories))?.id ?? '');
const category = computed(() => categories.value.find((c) => c.id === categoryId.value));

// Not reactive on purpose: it only holds the assessment this dialog created, `selected` is what the view shows.
const recorder = new GradeRecorder(window.grader.assessment, props.student.id);
let queue: Promise<void> = Promise.resolve();
const selected = ref<GradeSymbol | null>(null);
const saving = ref(false);
const saved = ref(false);
const error = ref('');
const note = ref('');
const closing = ref(false);

const fullName = computed(() => `${props.student.firstName} ${props.student.lastName}`);
const initials = computed(() => `${props.student.firstName.charAt(0)}${props.student.lastName.charAt(0)}`.toUpperCase());
const avatarColor = computed(() => props.student.color ?? 'var(--color-primary)');
const avatarText = computed(() => (props.student.color ? labelColor(props.student.color) : 'var(--color-primary-contrast)'));

/**
 * Runs one change after the other, so a grade picked while the note is saving still lands. A grade change
 * blocks the controls (a double click must not take the grade back); saving the note does not, otherwise the
 * click that took the focus out of the note field would hit a disabled button.
 */
function save(action: (category: PluginCategory) => Promise<GradeOutcome>, blocksControls = true): Promise<void> {
  const current = category.value;
  if (!current || (blocksControls && saving.value)) return queue;
  if (blocksControls) saving.value = true;
  queue = queue.then(async () => {
    saved.value = false;
    error.value = '';
    try {
      const outcome = await action(current);
      if (outcome.ok) saved.value = recorder.selected !== null;
      else error.value = errorText(new BridgeFailure(outcome.code, outcome.message));
    } catch (e: unknown) {
      error.value = errorText(e);
    } finally {
      // Whatever happened, show what Grader holds.
      selected.value = recorder.selected;
      if (blocksControls) saving.value = false;
    }
  });
  return queue;
}

const choose = (symbol: GradeSymbol): Promise<void> => save((c) => recorder.choose(symbol, c));
const changeCategory = (): Promise<void> => save((c) => recorder.changeCategory(c));
const saveNote = (): Promise<void> => save(() => recorder.setNote(note.value), false);

/** Saves a note still being typed (it is only saved on leaving the field) before the dialog goes away. */
async function close(): Promise<void> {
  if (closing.value) return;
  closing.value = true;
  if (note.value.trim() !== recorder.note) void saveNote();
  await queue;
  closing.value = false;
  if (!error.value) emit('close');
}
</script>

<style scoped>
.result {
  align-items: center;
  text-align: center;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 32px;
  font-size: 20px;
  font-weight: 600;
  line-height: 26px;
}

.count {
  color: var(--color-text-secondary);
}

.symbols {
  display: flex;
  gap: 10px;
}

.symbol {
  width: 56px;
  height: 48px;
  padding: 0;
}

.comment {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: stretch;
  text-align: left;
}

.actions {
  align-self: stretch;
}
</style>
