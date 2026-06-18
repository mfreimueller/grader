import { Entity } from '../shared/Entity';
import { GradingType } from './GradingType';

export class AssessmentCategory extends Entity<string> {
  private _title: string;
  private _gradingType: GradingType;
  private _displayAsGrade: boolean;
  private _isHidden: boolean;

  constructor(
    id: string,
    title: string,
    gradingType: GradingType,
    displayAsGrade: boolean,
    isHidden = false,
  ) {
    super(id);
    this._title = title;
    this._gradingType = gradingType;
    this._displayAsGrade = displayAsGrade;
    this._isHidden = isHidden;
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

  get isHidden(): boolean {
    return this._isHidden;
  }

  updateGradingType(type: GradingType): void {
    this._gradingType = type;
  }

  toggleDisplayAsGrade(): void {
    this._displayAsGrade = !this._displayAsGrade;
  }

  toggleHidden(): void {
    this._isHidden = !this._isHidden;
  }
}
