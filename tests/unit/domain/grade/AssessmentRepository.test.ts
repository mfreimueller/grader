import { AssessmentRepository } from '../../../../src/domain/grade/AssessmentRepository';

describe('AssessmentRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: AssessmentRepository = {
      findById: async () => null,
      findBySession: async () => [],
      save: async () => {},
      delete: async () => {},
    };
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findBySession).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});
