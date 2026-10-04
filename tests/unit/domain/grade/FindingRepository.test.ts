import { FindingRepository } from '../../../../src/domain/grade/FindingRepository';

describe('FindingRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: FindingRepository = {
      findByPerformance: async () => [],
      save: async () => {},
      delete: async () => {},
      findNotesBySession: async () => [],
      performanceExists: async () => true,
    };
    expect(typeof repo.findByPerformance).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
    expect(typeof repo.findNotesBySession).toBe('function');
    expect(typeof repo.performanceExists).toBe('function');
  });
});
