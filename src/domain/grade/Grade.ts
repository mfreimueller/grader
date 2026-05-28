import { Entity } from '../shared/Entity';
import { Student } from '../student/Student';
import { Course } from './Course';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export class Grade extends Entity<string> {
  private _student: Student;
  private _course: Course;
  private _score: number;

  private constructor(id: string, student: Student, course: Course, score: number) {
    super(id);
    this._student = student;
    this._course = course;
    this._score = score;
  }

  static create(
    id: string,
    student: Student,
    course: Course,
    score: number,
  ): Result<Grade> {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return Result.fail(
        new ValidationError('Grade score must be an integer between 1 and 5'),
      );
    }
    return Result.ok(new Grade(id, student, course, score));
  }

  get student(): Student {
    return this._student;
  }

  get course(): Course {
    return this._course;
  }

  get score(): number {
    return this._score;
  }
}
