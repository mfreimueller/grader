import { SchoolClassRepository } from '../../../../src/domain/student/SchoolClassRepository';

describe('SchoolClassRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: SchoolClassRepository = {
      findAll: async () => [],
      findById: async () => null,
      findByNameAndYear: async () => null,
      findDeleted: async () => [],
      save: async () => {},
      delete: async () => {},
      restore: async (_id: string) => {},
      hardDelete: async (_id: string) => {},
    };
    expect(typeof repo.findAll).toBe('function');
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByNameAndYear).toBe('function');
    expect(typeof repo.findDeleted).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
    expect(typeof repo.restore).toBe('function');
    expect(typeof repo.hardDelete).toBe('function');
  });
});
