import { SessionRepository } from '../../../../src/domain/grade/SessionRepository';

describe('SessionRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: SessionRepository = {
      findById: async () => null,
      findByCourse: async () => [],
      save: async () => {},
      delete: async () => {},
    };
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByCourse).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});
