<template>
  <TertiaryPicker
    v-if="overlay?.type === 'picker'"
    :cell="overlay.cell"
    :student-name="overlay.studentName"
    :anchor="overlay.anchor"
    @pick="(symbol) => emit('pick', symbol)"
    @close="emit('close')"
  />
  <NewAssessmentPopover
    v-if="overlay?.type === 'new-assessment'"
    :categories="categories"
    :anchor="overlay.anchor"
    :error="errorMessage"
    :busy="creating"
    @submit="(input) => emit('createAssessment', input)"
    @close="emit('close')"
  />
  <GridMenu
    v-if="overlay?.type === 'menu'"
    :entries="cellMenu(overlay.cell)"
    :anchor="overlay.anchor"
    :gap="overlay.gap"
    label="Zellenmenü"
    @select="(action) => emit('selectCellAction', action)"
    @close="emit('close')"
  />
  <GridMenu
    v-if="overlay?.type === 'column-menu'"
    :entries="columnMenu()"
    :anchor="overlay.anchor"
    :gap="overlay.gap"
    label="Spaltenmenü"
    @select="emit('deleteColumn')"
    @close="emit('close')"
  />
  <NoteEditor
    v-if="overlay?.type === 'note'"
    :subject="overlay.cell.title"
    :initial-text="overlay.cell.noteText ?? ''"
    :has-note="overlay.cell.hasNote"
    :student-name="overlay.studentName"
    :anchor="overlay.anchor"
    @save="(text) => emit('saveNote', text)"
    @remove="emit('saveNote', '')"
    @close="emit('close')"
  />
  <NoteEditor
    v-if="overlay?.type === 'student-note'"
    :subject="sessionLabel"
    :initial-text="overlay.text"
    :has-note="overlay.text !== ''"
    :student-name="overlay.studentName"
    :anchor="overlay.anchor"
    @save="(text) => emit('saveStudentNote', text)"
    @remove="emit('saveStudentNote', '')"
    @close="emit('close')"
  />
  <ImpromptuDialog
    v-if="impromptuStudent"
    :student="impromptuStudent"
    :categories="categories"
    :course-id="courseId"
    :session-id="sessionId"
    @close="emit('closeImpromptu')"
    @saved="emit('impromptuSaved')"
  />
  <NoteTooltip v-if="tooltip" :cell="tooltip.cell" :anchor="tooltip.anchor" :session-date="sessionDate" />
  <UndoToast v-if="pendingDelete" :title="pendingDelete.title" :more="pendingCount - 1" @undo="emit('undo', pendingDelete.assessmentId)" />
  <ConfirmDialog
    v-if="confirmation"
    :title="confirmation.title"
    :message="confirmation.message"
    :confirm-label="confirmation.confirmLabel"
    :danger="confirmation.danger"
    @confirm="emit('confirmed')"
    @cancel="emit('dismissed')"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AssessmentCategoryDto, StudentDto } from '../../../../shared/types';
import type { Confirmation, Overlay } from '../../../controllers/useSessionGridInteractions';
import type { NewAssessmentInput, PendingImpromptu } from '../../../controllers/useSessionGrid';
import type { GridCell, GridSymbol } from '../../../utils/sessionGridModel';
import type { PanelAnchor } from '../../../utils/panelAnchor';
import { cellMenu, columnMenu, type CellMenuAction } from '../../../utils/sessionGridMenu';
import TertiaryPicker from './TertiaryPicker.vue';
import NewAssessmentPopover from './NewAssessmentPopover.vue';
import GridMenu from './GridMenu.vue';
import NoteEditor from './NoteEditor.vue';
import NoteTooltip from './NoteTooltip.vue';
import UndoToast from './UndoToast.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import ImpromptuDialog from '../ImpromptuDialog.vue';

const props = defineProps<{
  overlay: Overlay | null;
  tooltip: { cell: GridCell; anchor: PanelAnchor } | null;
  confirmation: Confirmation | null;
  impromptuStudent: StudentDto | null;
  categories: AssessmentCategoryDto[];
  errorMessage: string;
  creating: boolean;
  pendingDelete: PendingImpromptu | null;
  pendingCount: number;
  sessionDate: string | null;
  courseId: string;
  sessionId: string;
}>();

const emit = defineEmits<{
  pick: [symbol: GridSymbol];
  close: [];
  createAssessment: [input: NewAssessmentInput];
  selectCellAction: [action: CellMenuAction];
  deleteColumn: [];
  saveNote: [text: string];
  saveStudentNote: [text: string];
  closeImpromptu: [];
  impromptuSaved: [];
  undo: [assessmentId: string];
  confirmed: [];
  dismissed: [];
}>();

/** What the general student note refers to in the editor caption. */
const sessionLabel = computed(() => (props.sessionDate ? `Sitzung ${props.sessionDate}` : 'Sitzung'));
</script>
