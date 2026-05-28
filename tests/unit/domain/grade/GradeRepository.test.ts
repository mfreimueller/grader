import { GradeRepository } from '../../../../src/domain/grade/GradeRepository';

describe('GradeRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: GradeRepository = {
      findByStudent: async () => [],
      findByCourseAndStudent: async () => null,
      save: async () => {},
      delete: async () => {},
    };
    expect(typeof repo.findByStudent).toBe('function');
    expect(typeof repo.findByCourseAndStudent).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});
