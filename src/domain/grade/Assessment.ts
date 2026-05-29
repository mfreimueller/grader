import { Entity } from '../shared/Entity';
import { AssessmentCategory } from './AssessmentCategory';
import { Course } from './Course';

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
}
