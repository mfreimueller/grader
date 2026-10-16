import type {
  CreateImpromptuRequest,
  CreateImpromptuResult,
  PluginCategory,
  PluginErrorCode,
  PluginResult,
} from '../../../../src/shared/plugin-api';

export type GradeSymbol = 'PLUS' | 'WELLE' | 'MINUS';

/** The part of `window.grader.assessment` the recorder needs. */
export interface GradeBridge {
  createImpromptu(request: CreateImpromptuRequest): Promise<PluginResult<CreateImpromptuResult>>;
  deleteImpromptu(assessmentId: string): Promise<PluginResult<void>>;
}

export type GradeOutcome = { ok: true } | { ok: false; code: PluginErrorCode; message: string };

/**
 * The grade of one picked student. Grader keeps one assessment per call, so changing or taking back a grade
 * means deleting the assessment this recorder created and, for a change, creating a new one.
 */
export class GradeRecorder {
  private entry: { assessmentId: string; symbol: GradeSymbol } | null = null;

  constructor(
    private readonly bridge: GradeBridge,
    private readonly studentId: string,
  ) {}

  get selected(): GradeSymbol | null {
    return this.entry?.symbol ?? null;
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

    const created = await this.bridge.createImpromptu({
      studentId: this.studentId,
      categoryId: category.id,
      symbol,
      title: category.title,
    });
    if (!created.ok) return { ok: false, ...created.error };
    this.entry = { assessmentId: created.value.assessmentId, symbol };
    return { ok: true };
  }
}
