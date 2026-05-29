import { SchoolClassRepository } from '../../../../src/domain/student/SchoolClassRepository';

describe('SchoolClassRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: SchoolClassRepository = {
      findAll: async () => [],
      findById: async () => null,
      findByNameAndYear: async () => null,
      save: async () => {},
      delete: async () => {},
    };
    expect(typeof repo.findAll).toBe('function');
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findByNameAndYear).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
  });
});
