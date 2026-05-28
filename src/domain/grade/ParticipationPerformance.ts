import { StudentPerformance } from './StudentPerformance';
import { ParticipationSymbol } from './ParticipationSymbol';
import { Student } from '../student/Student';
import { Assessment } from './Assessment';
import { Result } from '../shared/Result';

export class ParticipationPerformance extends StudentPerformance {
  private _symbol: ParticipationSymbol;

  private constructor(
    id: string,
    date: Date,
    student: Student,
    assessment: Assessment,
    symbol: ParticipationSymbol,
  ) {
    super(id, date, student, assessment, null);
    this._symbol = symbol;
  }

  static create(
    id: string,
    date: Date,
    student: Student,
    assessment: Assessment,
    symbol: ParticipationSymbol,
  ): Result<ParticipationPerformance> {
    return Result.ok(new ParticipationPerformance(id, date, student, assessment, symbol));
  }

  get symbol(): ParticipationSymbol {
    return this._symbol;
  }

  toScore(): number {
    return this._symbol.toScore();
  }
}
