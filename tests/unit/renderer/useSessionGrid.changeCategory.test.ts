import type { AssessmentDto, ResultDto } from '../../../src/shared/types';
import { useSessionGrid } from '../../../src/renderer/controllers/useSessionGrid';

const anAssessment = (categoryId: string): AssessmentDto => ({
  id: 'a-1',
  title: 'Test',
  date: '2025-10-01',
  category: { id: categoryId, title: categoryId, gradingType: 'TERTIARY', displayAsGrade: false, isHidden: false },
  courseId: 'course-1',
  isImpromptu: false,
  maxPoints: null,
});

function stubApi(change: () => Promise<ResultDto<AssessmentDto>>) {
  const changeCategory = jest.fn(change);
  const listBySession = jest.fn(async () => [anAssessment('cat-2')]);
  const getPerformancesByAssessment = jest.fn(async () => []);
  const listNotesBySession = jest.fn(async () => []);
  Object.assign(globalThis, {
    window: {
      grdr: {
        assessment: { changeCategory, listBySession },
        grade: { getPerformancesByAssessment },
        finding: { listNotesBySession },
      },
    },
  });
  return { changeCategory, listBySession };
}

describe('useSessionGrid', () => {
  describe('changeCategory', () => {
    it('sends the change and reloads the assessments', async () => {
      const api = stubApi(async () => ({ ok: true, value: anAssessment('cat-2') }));
      const grid = useSessionGrid('course-1', 'session-1');

      const ok = await grid.changeCategory('a-1', 'cat-2');

      expect(ok).toBe(true);
      expect(api.changeCategory).toHaveBeenCalledWith({ assessmentId: 'a-1', categoryId: 'cat-2' });
      expect(api.listBySession).toHaveBeenCalledWith('session-1');
      expect(grid.model.value.columns.map((c) => c.categoryId)).toEqual(['cat-2']);
    });

    it('reports the error and does not reload when the change fails', async () => {
      const api = stubApi(async () => ({ ok: false, error: { name: 'ValidationError', message: 'nope' } }));
      const grid = useSessionGrid('course-1', 'session-1');

      const ok = await grid.changeCategory('a-1', 'cat-2');

      expect(ok).toBe(false);
      expect(grid.errorMessage.value).toBe('nope');
      expect(api.listBySession).not.toHaveBeenCalled();
    });
  });
});
