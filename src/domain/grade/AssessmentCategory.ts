import { Entity } from '../shared/Entity';
import { GradingType } from './GradingType';

export class AssessmentCategory extends Entity<string> {
  private _title: string;
  private _gradingType: GradingType;
  private _displayAsGrade: boolean;

  constructor(
    id: string,
    title: string,
    gradingType: GradingType,
    displayAsGrade: boolean,
  ) {
    super(id);
    this._title = title;
    this._gradingType = gradingType;
    this._displayAsGrade = displayAsGrade;
  }

  get title(): string {
    return this._title;
  }

  get gradingType(): GradingType {
    return this._gradingType;
  }

  get displayAsGrade(): boolean {
    return this._displayAsGrade;
  }

  updateGradingType(type: GradingType): void {
    this._gradingType = type;
  }

  toggleDisplayAsGrade(): void {
    this._displayAsGrade = !this._displayAsGrade;
  }
}
