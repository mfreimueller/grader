import { Entity } from '../shared/Entity';
import { SchoolClass } from '../student/SchoolClass';
import { AssessmentCategory } from './AssessmentCategory';
import { GradeComposition } from './GradeComposition';
import { GradingType } from './GradingType';

export class Course extends Entity<string> {
  private _title: string;
  private _schoolClass: SchoolClass;
  private _assessmentCategories: AssessmentCategory[];
  private _gradeCompositions: GradeComposition[];

  private constructor(
    id: string,
    title: string,
    schoolClass: SchoolClass,
    assessmentCategories: AssessmentCategory[],
    gradeCompositions: GradeComposition[],
  ) {
    super(id);
    this._title = title;
    this._schoolClass = schoolClass;
    this._assessmentCategories = [...assessmentCategories];
    this._gradeCompositions = [...gradeCompositions];
  }

  static create(id: string, title: string, schoolClass: SchoolClass): Course {
    const mitarbeit = new AssessmentCategory(
      `${id}:mitarbeit`,
      'Mitarbeit',
      GradingType.TERTIARY,
      false,
      false,
    );
    return new Course(id, title, schoolClass, [mitarbeit], []);
  }

  static reconstitute(
    id: string,
    title: string,
    schoolClass: SchoolClass,
    assessmentCategories: AssessmentCategory[],
    gradeCompositions: GradeComposition[],
  ): Course {
    return new Course(id, title, schoolClass, assessmentCategories, gradeCompositions);
  }

  get title(): string {
    return this._title;
  }

  get schoolClass(): SchoolClass {
    return this._schoolClass;
  }

  get assessmentCategories(): readonly AssessmentCategory[] {
    return this._assessmentCategories;
  }

  get gradeCompositions(): readonly GradeComposition[] {
    return this._gradeCompositions;
  }

  addAssessmentCategory(category: AssessmentCategory): void {
    this._assessmentCategories.push(category);
  }

  addGradeComposition(composition: GradeComposition): void {
    this._gradeCompositions.push(composition);
  }

  removeGradeComposition(categoryId: string): void {
    this._gradeCompositions = this._gradeCompositions.filter(
      (c) => c.assessmentCategory.id !== categoryId,
    );
  }

  getMitarbeitCategory(): AssessmentCategory | undefined {
    return this._assessmentCategories.find((c) => c.title === 'Mitarbeit');
  }
}
