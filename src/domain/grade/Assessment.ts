import { Entity } from '../shared/Entity';
import { AssessmentCategory } from './AssessmentCategory';
import { Course } from './Course';

export class Assessment extends Entity<string> {
  private _title: string;
  private _date: Date;
  private _category: AssessmentCategory;
  private _course: Course;
  private _isImpromptu: boolean;

  constructor(
    id: string,
    title: string,
    date: Date,
    category: AssessmentCategory,
    course: Course,
    isImpromptu = false,
  ) {
    super(id);
    this._title = title;
    this._date = date;
    this._category = category;
    this._course = course;
    this._isImpromptu = isImpromptu;
  }

  get title(): string {
    return this._title;
  }

  get date(): Date {
    return this._date;
  }

  get category(): AssessmentCategory {
    return this._category;
  }

  get course(): Course {
    return this._course;
  }

  get isImpromptu(): boolean {
    return this._isImpromptu;
  }
}
