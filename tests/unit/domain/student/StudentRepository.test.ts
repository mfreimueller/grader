import { StudentRepository } from '../../../../src/domain/student/StudentRepository';

describe('StudentRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: StudentRepository = {
      findById: async () => null,
      findAll: async () => [],
      findByName: async () => [],
      save: async () => {},
      delete: async () => {},
    };
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findAll).toBe('function');
    expect(typeof repo.findByName).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});
