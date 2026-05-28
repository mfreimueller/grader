import { FindingRepository } from '../../../../src/domain/grade/FindingRepository';

describe('FindingRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: FindingRepository = {
      findByPerformance: async () => [],
      save: async () => {},
      delete: async () => {},
    };
    expect(typeof repo.findByPerformance).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});
