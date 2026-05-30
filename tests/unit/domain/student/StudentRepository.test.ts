import { StudentRepository } from '../../../../src/domain/student/StudentRepository';
import { StudentId } from '../../../../src/domain/student/StudentId';

describe('StudentRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: StudentRepository = {
      findById: async () => null,
      findAll: async () => [],
      findByName: async () => [],
      findDeleted: async () => [],
      save: async () => {},
      delete: async () => {},
      restore: async (_id: StudentId) => {},
      hardDelete: async (_id: StudentId) => {},
    };
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findAll).toBe('function');
    expect(typeof repo.findByName).toBe('function');
    expect(typeof repo.findDeleted).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
    expect(typeof repo.restore).toBe('function');
    expect(typeof repo.hardDelete).toBe('function');
  });
});
