import { Entity } from '../shared/Entity';
import { Student } from '../student/Student';
import { Assessment } from './Assessment';

export abstract class StudentPerformance extends Entity<string> {
  private _student: Student;
  private _assessment: Assessment;
  private _score: number | null;

  constructor(
    id: string,
    student: Student,
    assessment: Assessment,
    score: number | null,
  ) {
    super(id);
    this._student = student;
    this._assessment = assessment;
    this._score = score;
  }

  get student(): Student {
    return this._student;
  }

  get assessment(): Assessment {
    return this._assessment;
  }

  get score(): number | null {
    return this._score;
  }

  get findings(): unknown[] {
    return [];
  }
}
