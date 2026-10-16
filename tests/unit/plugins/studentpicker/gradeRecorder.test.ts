import { categoryChoices, defaultCategory } from '../../../../plugins/studentpicker/src/core/categories';
import { GradeBridge, GradeRecorder } from '../../../../plugins/studentpicker/src/core/gradeRecorder';
import type { CreateImpromptuRequest, PluginCategory, PluginResult } from '../../../../src/shared/plugin-api';

const aCategory = (overrides: Partial<PluginCategory> = {}): PluginCategory => ({
  id: 'cat-m',
  title: 'Mitarbeit',
  gradingType: 'TERTIARY',
  isMitarbeit: true,
  isHidden: false,
  ...overrides,
});

describe('categoryChoices', () => {
  it('offers tertiary categories only, since a symbol cannot be recorded in a points category', () => {
    const categories = [
      aCategory(),
      aCategory({ id: 'cat-s', title: 'Schularbeit', gradingType: 'NUMERIC', isMitarbeit: false }),
      aCategory({ id: 'cat-w', title: 'Wiederholung', isMitarbeit: false }),
    ];

    expect(categoryChoices(categories).map((c) => c.id)).toEqual(['cat-m', 'cat-w']);
  });

  it('leaves out hidden categories', () => {
    expect(categoryChoices([aCategory({ isHidden: true })])).toEqual([]);
  });
});

describe('defaultCategory', () => {
  it('prefers Mitarbeit', () => {
    const choices = [aCategory({ id: 'cat-w', title: 'Wiederholung', isMitarbeit: false }), aCategory()];

    expect(defaultCategory(choices)?.id).toBe('cat-m');
  });

  it('falls back to the first category', () => {
    const choices = [aCategory({ id: 'cat-w', isMitarbeit: false }), aCategory({ id: 'cat-x', isMitarbeit: false })];

    expect(defaultCategory(choices)?.id).toBe('cat-w');
  });

  it('is undefined without categories', () => {
    expect(defaultCategory([])).toBeUndefined();
  });
});

class FakeBridge implements GradeBridge {
  readonly calls: string[] = [];
  readonly created: CreateImpromptuRequest[] = [];
  failCreate: { code: 'NOT_IN_COURSE' | 'VALIDATION'; message: string } | null = null;
  failDelete: { code: 'PERMISSION_DENIED'; message: string } | null = null;
  private next = 1;

  createImpromptu(request: CreateImpromptuRequest): Promise<PluginResult<{ assessmentId: string; performanceId: string; sessionId: string }>> {
    this.calls.push(`create:${request.symbol}:${request.categoryId}`);
    this.created.push(request);
    if (this.failCreate) return Promise.resolve({ ok: false, error: this.failCreate });
    const n = this.next++;
    return Promise.resolve({ ok: true, value: { assessmentId: `a-${n}`, performanceId: `p-${n}`, sessionId: 'se-1' } });
  }

  deleteImpromptu(assessmentId: string): Promise<PluginResult<void>> {
    this.calls.push(`delete:${assessmentId}`);
    if (this.failDelete) return Promise.resolve({ ok: false, error: this.failDelete });
    return Promise.resolve({ ok: true, value: undefined });
  }
}

describe('GradeRecorder', () => {
  let bridge: FakeBridge;
  let recorder: GradeRecorder;
  const mitarbeit = aCategory();
  const wiederholung = aCategory({ id: 'cat-w', title: 'Wiederholung', isMitarbeit: false });

  beforeEach(() => {
    bridge = new FakeBridge();
    recorder = new GradeRecorder(bridge, 's-1');
  });

  it('starts without a grade', () => {
    expect(recorder.selected).toBeNull();
  });

  describe('choose', () => {
    it('records the symbol for the student under the title of the category', async () => {
      const result = await recorder.choose('PLUS', mitarbeit);

      expect(result).toEqual({ ok: true });
      expect(bridge.created).toEqual([{ studentId: 's-1', categoryId: 'cat-m', symbol: 'PLUS', title: 'Mitarbeit' }]);
      expect(recorder.selected).toBe('PLUS');
    });

    it('replaces the grade when another symbol is chosen: the old one goes first, then the new one is recorded', async () => {
      await recorder.choose('PLUS', mitarbeit);

      await recorder.choose('MINUS', mitarbeit);

      expect(bridge.calls).toEqual(['create:PLUS:cat-m', 'delete:a-1', 'create:MINUS:cat-m']);
      expect(recorder.selected).toBe('MINUS');
    });

    it('takes the grade back when the active symbol is chosen again', async () => {
      await recorder.choose('WELLE', mitarbeit);

      const result = await recorder.choose('WELLE', mitarbeit);

      expect(result).toEqual({ ok: true });
      expect(bridge.calls).toEqual(['create:WELLE:cat-m', 'delete:a-1']);
      expect(recorder.selected).toBeNull();
    });

    it('can record again after a grade was taken back', async () => {
      await recorder.choose('PLUS', mitarbeit);
      await recorder.choose('PLUS', mitarbeit);

      await recorder.choose('PLUS', mitarbeit);

      expect(bridge.calls).toEqual(['create:PLUS:cat-m', 'delete:a-1', 'create:PLUS:cat-m']);
      expect(recorder.selected).toBe('PLUS');
    });
  });

  describe('changeCategory', () => {
    it('records the selected symbol again in the new category', async () => {
      await recorder.choose('PLUS', mitarbeit);

      const result = await recorder.changeCategory(wiederholung);

      expect(result).toEqual({ ok: true });
      expect(bridge.calls).toEqual(['create:PLUS:cat-m', 'delete:a-1', 'create:PLUS:cat-w']);
      expect(bridge.created[1]).toMatchObject({ categoryId: 'cat-w', title: 'Wiederholung' });
      expect(recorder.selected).toBe('PLUS');
    });

    it('does nothing while there is no grade yet', async () => {
      const result = await recorder.changeCategory(wiederholung);

      expect(result).toEqual({ ok: true });
      expect(bridge.calls).toEqual([]);
    });
  });

  describe('when the bridge refuses', () => {
    it('reports a failed recording and stays without a grade', async () => {
      bridge.failCreate = { code: 'NOT_IN_COURSE', message: 'Student s-1 does not belong to this course' };

      const result = await recorder.choose('PLUS', mitarbeit);

      expect(result).toEqual({ ok: false, code: 'NOT_IN_COURSE', message: 'Student s-1 does not belong to this course' });
      expect(recorder.selected).toBeNull();
    });

    it('keeps the old grade when it cannot be removed, and records nothing new', async () => {
      await recorder.choose('PLUS', mitarbeit);
      bridge.failDelete = { code: 'PERMISSION_DENIED', message: 'Assessment was not created by this plugin' };

      const result = await recorder.choose('MINUS', mitarbeit);

      expect(result).toMatchObject({ ok: false, code: 'PERMISSION_DENIED' });
      expect(recorder.selected).toBe('PLUS');
      expect(bridge.calls).toEqual(['create:PLUS:cat-m', 'delete:a-1']);
    });

    it('has no grade left when the new one cannot be recorded after the old one was removed', async () => {
      await recorder.choose('PLUS', mitarbeit);
      bridge.failCreate = { code: 'VALIDATION', message: 'nope' };

      const result = await recorder.choose('MINUS', mitarbeit);

      expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
      expect(recorder.selected).toBeNull();
    });

    it('stays consistent after a failure: the next choice records normally', async () => {
      bridge.failCreate = { code: 'VALIDATION', message: 'nope' };
      await recorder.choose('PLUS', mitarbeit);
      bridge.failCreate = null;

      const result = await recorder.choose('PLUS', mitarbeit);

      expect(result).toEqual({ ok: true });
      expect(recorder.selected).toBe('PLUS');
    });
  });
});
