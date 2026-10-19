import type {
  CreateImpromptuRequest,
  CreateImpromptuResult,
  PluginCategory,
  PluginErrorCode,
  PluginResult,
} from '../../../../src/shared/plugin-api';

export type GradeSymbol = 'PLUS' | 'PLUS_WELLE' | 'WELLE' | 'MINUS_WELLE' | 'MINUS';

/** The part of `window.grader.assessment` the recorder needs. */
export interface GradeBridge {
  createImpromptu(request: CreateImpromptuRequest): Promise<PluginResult<CreateImpromptuResult>>;
  deleteImpromptu(assessmentId: string): Promise<PluginResult<void>>;
  setImpromptuNote(assessmentId: string, note: string): Promise<PluginResult<void>>;
}

export type GradeOutcome = { ok: true } | { ok: false; code: PluginErrorCode; message: string };

/**
 * The grade of one picked student. Grader keeps one assessment per call, so changing or taking back a grade
 * means deleting the assessment this recorder created and, for a change, creating a new one.
 * The note (e.g. the topics asked) can be written before or after the grade and goes with it.
 */
export class GradeRecorder {
  private entry: { assessmentId: string; symbol: GradeSymbol; savedNote: string } | null = null;
  private currentNote = '';

  constructor(
    private readonly bridge: GradeBridge,
    private readonly studentId: string,
  ) {}

  get selected(): GradeSymbol | null {
    return this.entry?.symbol ?? null;
  }

  get note(): string {
    return this.currentNote;
  }

  /** Keeps the note for the grade; once a grade is recorded, a changed note is saved on it right away. */
  async setNote(text: string): Promise<GradeOutcome> {
    this.currentNote = text.trim();
    if (!this.entry || this.entry.savedNote === this.currentNote) return { ok: true };

    const saved = await this.bridge.setImpromptuNote(this.entry.assessmentId, this.currentNote);
    if (!saved.ok) return { ok: false, ...saved.error };
    this.entry.savedNote = this.currentNote;
    return { ok: true };
  }

  /** Records the symbol; choosing the symbol that is already recorded takes the grade back. */
  async choose(symbol: GradeSymbol, category: Pick<PluginCategory, 'id' | 'title'>): Promise<GradeOutcome> {
    return this.record(this.entry?.symbol === symbol ? null : symbol, category);
  }

  /** Moves the recorded grade, if there is one, to another category. */
  async changeCategory(category: Pick<PluginCategory, 'id' | 'title'>): Promise<GradeOutcome> {
    return this.entry ? this.record(this.entry.symbol, category) : { ok: true };
  }

  private async record(symbol: GradeSymbol | null, category: Pick<PluginCategory, 'id' | 'title'>): Promise<GradeOutcome> {
    // The old grade goes first. If that fails nothing changed; if recording the new one fails afterwards,
    // there is no grade, which is exactly what Grader holds.
    if (this.entry) {
      const removed = await this.bridge.deleteImpromptu(this.entry.assessmentId);
      if (!removed.ok) return { ok: false, ...removed.error };
      this.entry = null;
    }
    if (symbol === null) return { ok: true };

    const note = this.currentNote;
    const created = await this.bridge.createImpromptu({
      studentId: this.studentId,
      categoryId: category.id,
      symbol,
      title: category.title,
      ...(note !== '' ? { note } : {}),
    });
    if (!created.ok) return { ok: false, ...created.error };
    this.entry = { assessmentId: created.value.assessmentId, symbol, savedNote: note };
    return { ok: true };
  }
}
