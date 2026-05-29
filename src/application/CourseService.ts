import { CourseRepository } from '../domain/grade/CourseRepository';
import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { Course } from '../domain/grade/Course';
import { AssessmentCategory } from '../domain/grade/AssessmentCategory';
import { GradeComposition } from '../domain/grade/GradeComposition';
import { SchoolYear } from '../domain/student/SchoolYear';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';

export interface AssessmentCategoryRefDto {
  id: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
}

export interface GradeCompositionDto {
  categoryId: string;
  weight: number;
}

export interface SchoolClassRefDto {
  id: string;
  name: string;
  schoolYear: string;
}

export interface CourseDto {
  id: string;
  title: string;
  schoolClass: SchoolClassRefDto;
  assessmentCategories: AssessmentCategoryRefDto[];
  gradeCompositions: GradeCompositionDto[];
}

export interface CreateCourseInput {
  title: string;
  schoolClassId: string;
}

export class CourseService {
  constructor(
    private readonly courseRepo: CourseRepository,
    private readonly schoolClassRepo: SchoolClassRepository,
  ) {}

  async list(schoolYearStr?: string): Promise<CourseDto[]> {
    if (schoolYearStr) {
      const yearResult = SchoolYear.create(schoolYearStr);
      if (!yearResult.ok) return [];
      const courses = await this.courseRepo.findBySchoolYear(yearResult.value);
      return courses.map(toDto);
    }
    const courses = await this.courseRepo.findAll();
    return courses.map(toDto);
  }

  async findById(id: string): Promise<Result<CourseDto>> {
    const course = await this.courseRepo.findById(id);
    if (!course) return Result.fail(new NotFoundError('Course', id));
    return Result.ok(toDto(course));
  }

  async create(input: CreateCourseInput): Promise<Result<CourseDto>> {
    const schoolClass = await this.schoolClassRepo.findById(input.schoolClassId);
    if (!schoolClass) return Result.fail(new NotFoundError('SchoolClass', input.schoolClassId));

    const course = Course.create(generateId(), input.title, schoolClass);
    await this.courseRepo.save(course);
    return Result.ok(toDto(course));
  }

  async clone(id: string, targetSchoolClassId: string): Promise<Result<CourseDto>> {
    const source = await this.courseRepo.findById(id);
    if (!source) return Result.fail(new NotFoundError('Course', id));

    const targetClass = await this.schoolClassRepo.findById(targetSchoolClassId);
    if (!targetClass) return Result.fail(new NotFoundError('SchoolClass', targetSchoolClassId));

    const newId = generateId();
    const cloned = Course.reconstitute(
      newId,
      source.title,
      targetClass,
      source.assessmentCategories.map(cat => new AssessmentCategory(
        `${newId}:${cat.title.toLowerCase()}`,
        cat.title,
        cat.gradingType,
        cat.displayAsGrade,
      )),
      source.gradeCompositions.map(gc => {
        const matchingCat = source.assessmentCategories.find(c => c.id === gc.assessmentCategory.id);
        if (!matchingCat) return gc;
        const newCat = new AssessmentCategory(
          `${newId}:${matchingCat.title.toLowerCase()}`,
          matchingCat.title,
          matchingCat.gradingType,
          matchingCat.displayAsGrade,
        );
        const compResult = GradeComposition.create(newCat, gc.weight);
        if (!compResult.ok) throw compResult.error;
        return compResult.value;
      }),
    );

    await this.courseRepo.save(cloned);
    return Result.ok(toDto(cloned));
  }

  async update(
    id: string,
    input: { title?: string; gradeCompositions?: GradeCompositionDto[] },
  ): Promise<Result<CourseDto>> {
    const existing = await this.courseRepo.findById(id);
    if (!existing) return Result.fail(new NotFoundError('Course', id));

    const title = input.title ?? existing.title;

    const compositions = input.gradeCompositions
      ? input.gradeCompositions.map(gc => {
          const cat = existing.assessmentCategories.find(c => c.id === gc.categoryId);
          if (!cat) throw new Error(`Category ${gc.categoryId} not found in course ${id}`);
          const result = GradeComposition.create(cat, gc.weight);
          if (!result.ok) throw result.error;
          return result.value;
        })
      : [...existing.gradeCompositions];

    const updated = Course.reconstitute(id, title, existing.schoolClass, [
      ...existing.assessmentCategories,
    ], compositions);
    await this.courseRepo.save(updated);
    return Result.ok(toDto(updated));
  }

  async delete(id: string): Promise<Result<void>> {
    const existing = await this.courseRepo.findById(id);
    if (!existing) return Result.fail(new NotFoundError('Course', id));
    await this.courseRepo.delete(id);
    return Result.ok(undefined as void);
  }
}

function toDto(c: Course): CourseDto {
  return {
    id: c.id,
    title: c.title,
    schoolClass: {
      id: c.schoolClass.id,
      name: c.schoolClass.name,
      schoolYear: c.schoolClass.schoolYear.toString(),
    },
    assessmentCategories: c.assessmentCategories.map(cat => ({
      id: cat.id,
      title: cat.title,
      gradingType: cat.gradingType,
      displayAsGrade: cat.displayAsGrade,
    })),
    gradeCompositions: c.gradeCompositions.map(gc => ({
      categoryId: gc.assessmentCategory.id,
      weight: gc.weight,
    })),
  };
}
