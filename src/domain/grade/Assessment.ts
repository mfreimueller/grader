import { Entity } from '../shared/Entity';
import { AssessmentCategory } from './AssessmentCategory';
import { Course } from './Course';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export class Assessment extends Entity<string> {
  private _title: string;
  private _category: AssessmentCategory;
  private _course: Course;
  private _isImpromptu: boolean;
  private _sessionId: string;

  constructor(
    id: string,
    title: string,
    category: AssessmentCategory,
    course: Course,
    sessionId: string,
    isImpromptu = false,
  ) {
    super(id);
    this._title = title;
    this._category = category;
    this._course = course;
    this._sessionId = sessionId;
    this._isImpromptu = isImpromptu;
  }

  get title(): string {
    return this._title;
  }

  get category(): AssessmentCategory {
    return this._category;
  }

  get course(): Course {
    return this._course;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get isImpromptu(): boolean {
    return this._isImpromptu;
  }

  changeCategory(category: AssessmentCategory): Result<void> {
    if (category.gradingType !== this._category.gradingType) {
      return Result.fail(
        new ValidationError('Assessment category must have the same grading type'),
      );
    }
    this._category = category;
    return Result.ok(undefined as void);
  }
}
