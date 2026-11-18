// What the running agent reports. Reading events are sparse, so only counts are shown, never a percentage.

import type { GradeflowProgressDto } from '../../shared/gradeflow-api';

export interface ProgressState {
  model: 'sonnet' | 'opus' | null;
  turns: number;
  /** Students whose hand-in the agent opened, each once. */
  readIds: string[];
  finished: boolean;
}

export const emptyProgress = (): ProgressState => ({ model: null, turns: 0, readIds: [], finished: false });

export function reduceProgress(state: ProgressState, event: GradeflowProgressDto): ProgressState {
  switch (event.kind) {
    case 'started':
      return { model: event.model, turns: 0, readIds: [], finished: false };
    case 'working':
      return { ...state, turns: Math.max(state.turns, event.turns) };
    case 'finished':
      return { ...state, finished: true };
    case 'reading':
      return state.readIds.includes(event.studentId) ? state : { ...state, readIds: [...state.readIds, event.studentId] };
  }
}

const MODEL_NAMES = { sonnet: 'Sonnet', opus: 'Opus' } as const;

export function progressLabel(state: ProgressState): string {
  if (state.model === null) return 'Der Agent wird gestartet …';
  const turns = state.turns === 1 ? '1 Schritt' : `${state.turns} Schritte`;
  const read = state.readIds.length === 1 ? '1 Abgabe' : `${state.readIds.length} Abgaben`;
  const base = `Modell ${MODEL_NAMES[state.model]} · ${turns} · bisher ${read} gelesen`;
  return state.finished ? `${base} · Ergebnis wird geprüft …` : base;
}
