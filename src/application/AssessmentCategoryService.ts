import { CourseRepository } from '../domain/grade/CourseRepository';
import { AssessmentCategory } from '../domain/grade/AssessmentCategory';
import { gradingTypeFromString } from '../domain/grade/GradingType';
import { Course } from '../domain/grade/Course';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';

export interface AssessmentCategoryDto {
  id: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
  courseId: string;
}

export interface CreateAssessmentCategoryInput {
  courseId: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
}

export class AssessmentCategoryService {
  constructor(private readonly courseRepo: CourseRepository) {}

  async listByCourse(courseId: string): Promise<AssessmentCategoryDto[]> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) return [];

    return course.assessmentCategories.map(cat => ({
      id: cat.id,
      title: cat.title,
      gradingType: cat.gradingType,
      displayAsGrade: cat.displayAsGrade,
      courseId: course.id,
    }));
  }

  async create(input: CreateAssessmentCategoryInput): Promise<Result<AssessmentCategoryDto>> {
    console.log("Creating assessment category with input:", input);

    const course = await this.courseRepo.findById(input.courseId);
    if (!course) return Result.fail(new NotFoundError('Course', input.courseId));
    console.log("Found course for new category:", course.title);

    const gradingResult = gradingTypeFromString(input.gradingType);
    if (!gradingResult.ok) return Result.fail(gradingResult.error);
    console.log("Parsed grading type:", gradingResult.value);

    const category = new AssessmentCategory(
      generateId(),
      input.title,
      gradingResult.value,
      input.displayAsGrade,
    );
    console.log("Created category entity:", category);

    const reconstituted = Course.reconstitute(
      course.id,
      course.title,
      course.schoolClass,
      [...course.assessmentCategories, category],
      [...course.gradeCompositions],
    );
    console.log("Reconstituted course with new category:", reconstituted);

    await this.courseRepo.save(reconstituted);
    console.log("Saved course with new category to repository");
    
    return Result.ok({
      id: category.id,
      title: category.title,
      gradingType: category.gradingType,
      displayAsGrade: category.displayAsGrade,
      courseId: course.id,
    });
  }

  async update(id: string, input: { title?: string; gradingType?: string; displayAsGrade?: boolean }): Promise<Result<AssessmentCategoryDto>> {
    const course = await this.findCourseByCategoryId(id);
    if (!course) return Result.fail(new NotFoundError('AssessmentCategory', id));

    const catIndex = course.assessmentCategories.findIndex(c => c.id === id);
    if (catIndex < 0) return Result.fail(new NotFoundError('AssessmentCategory', id));

    const existing = course.assessmentCategories[catIndex]!;
    const title = input.title ?? existing.title;
    const gradingType = input.gradingType
      ? (() => {
          const r = gradingTypeFromString(input.gradingType!);
          if (!r.ok) throw r.error;
          return r.value;
        })()
      : existing.gradingType;
    const displayAsGrade = input.displayAsGrade ?? existing.displayAsGrade;

    const updatedCat = new AssessmentCategory(id, title, gradingType, displayAsGrade);

    const categories = [...course.assessmentCategories];
    categories[catIndex] = updatedCat;

    const reconstituted = Course.reconstitute(
      course.id,
      course.title,
      course.schoolClass,
      categories,
      [...course.gradeCompositions],
    );

    await this.courseRepo.save(reconstituted);
    return Result.ok({
      id: updatedCat.id,
      title: updatedCat.title,
      gradingType: updatedCat.gradingType,
      displayAsGrade: updatedCat.displayAsGrade,
      courseId: course.id,
    });
  }

  async delete(id: string): Promise<Result<void>> {
    const course = await this.findCourseByCategoryId(id);
    if (!course) return Result.fail(new NotFoundError('AssessmentCategory', id));

    const category = course.assessmentCategories.find(c => c.id === id);
    if (category?.title === 'Mitarbeit') {
      return Result.fail(new ValidationError('Cannot delete default "Mitarbeit" category'));
    }

    try {
      await this.courseRepo.deleteCategory(course.id, id);
      return Result.ok(undefined as void);
    } catch (err) {
      return Result.fail(new ValidationError((err as Error).message));
    }
  }

  private async findCourseByCategoryId(categoryId: string): Promise<Course | null> {
    const all = await this.courseRepo.findAll();
    return all.find(c => c.assessmentCategories.some(cat => cat.id === categoryId)) ?? null;
  }
}
