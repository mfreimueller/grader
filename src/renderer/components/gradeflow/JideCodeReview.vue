<template>
  <div class="jide-code" data-testid="jide-code">
    <p v-if="info" class="gf-hint">{{ info }}</p>
    <p v-if="stray.length > 0" class="gf-warning" data-testid="jide-stray">
      {{ stray.length }} Zeilenkommentar{{ stray.length === 1 ? ' passt' : 'e passen' }} zu keiner angezeigten Datei oder Zeile und
      {{ stray.length === 1 ? 'wird' : 'werden' }} nicht gesendet.
    </p>
    <p v-if="row.jide && row.jide.files.length === 0" class="gf-hint">Keine Dateien zum Anzeigen.</p>

    <section v-for="file in row.jide?.files ?? []" :key="file.path" class="jide-file">
      <h4>{{ file.path }}</h4>
      <div class="jide-lines">
        <template v-for="line in linesOf(file)" :key="line.number">
          <div class="jide-line" data-testid="jide-line">
            <span class="jide-no">{{ line.number }}</span>
            <pre class="jide-text">{{ line.text }}</pre>
          </div>
          <div v-for="(comment, i) in line.comments" :key="`${line.number}-${i}`" class="jide-comment" data-testid="jide-line-comment">
            <textarea
              v-model="comment.text"
              maxlength="1000"
              :disabled="row.saved"
              :aria-label="`Zeilenkommentar zu ${file.path}, Zeile ${line.number}`"
            ></textarea>
            <button type="button" class="gf-btn gf-btn-secondary" :disabled="row.saved" data-testid="jide-line-comment-delete" @click="remove(comment)">
              Löschen
            </button>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LineCommentDto } from '../../../shared/gradeflow-api';
import { codeLines, describeHandin, strayComments } from '../../utils/gradeflowJide';
import type { ReviewRow } from '../../utils/gradeflowReview';

const props = defineProps<{ row: ReviewRow }>();

const info = computed(() => (props.row.jide ? describeHandin(props.row.jide) : ''));
const stray = computed(() => (props.row.jide ? strayComments(props.row.jide) : []));

const linesOf = (file: { path: string; content: string }) => codeLines(file.content, file.path, props.row.jide?.lineComments ?? []);

function remove(comment: LineCommentDto): void {
  const comments = props.row.jide?.lineComments;
  if (!comments) return;
  const index = comments.indexOf(comment);
  if (index >= 0) comments.splice(index, 1);
}
</script>

<style scoped>
.jide-file { margin-bottom: 12px; }
.jide-file h4 { font-size: 13px; margin-bottom: 4px; }
.jide-lines { border: 1px solid var(--color-border); border-radius: 6px; overflow-x: auto; background: var(--color-bg); font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
.jide-line { display: flex; }
.jide-no { flex: 0 0 44px; text-align: right; padding: 0 8px; color: var(--color-text-secondary); user-select: none; }
.jide-text { margin: 0; white-space: pre; flex: 1; font: inherit; }
.jide-comment { display: flex; gap: 8px; align-items: flex-start; margin: 2px 8px 6px 52px; font-family: inherit; }
.jide-comment textarea { flex: 1; min-height: 44px; padding: 6px 8px; border: 1px solid var(--color-primary); border-radius: 6px; font: 13px/1.4 system-ui, sans-serif; background: var(--color-surface); color: var(--color-text); resize: vertical; }
</style>
