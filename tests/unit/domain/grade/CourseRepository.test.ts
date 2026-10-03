import { CourseRepository } from '../../../../src/domain/grade/CourseRepository';

describe('CourseRepository', () => {
  it('is a valid interface (compilation check)', () => {
    const repo: CourseRepository = {
      findById: async () => null,
      findAll: async () => [],
      findBySchoolYear: async () => [],
      save: async () => {},
      delete: async () => {},
      deleteCategory: async () => {},
      softDelete: async () => {},
      findDeleted: async () => [],
      restore: async () => {},
      hardDelete: async () => {},
    };
    expect(typeof repo.findById).toBe('function');
    expect(typeof repo.findAll).toBe('function');
    expect(typeof repo.findBySchoolYear).toBe('function');
    expect(typeof repo.save).toBe('function');
    expect(typeof repo.delete).toBe('function');
    expect(typeof repo.deleteCategory).toBe('function');
  });
});
