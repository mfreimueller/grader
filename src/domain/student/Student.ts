import { Entity } from '../shared/Entity';
import { StudentId } from './StudentId';
import { Name } from './Name';
import { SchoolClass } from './SchoolClass';
import { Color } from './Color';
import { AdditionalInformation } from './AdditionalInformation';

export class Student extends Entity<StudentId> {
  private _name: Name;
  private _schoolClass: SchoolClass;
  private _additionalInformation: AdditionalInformation[];
  private _color: Color | null;
  public readonly deletedAt: string | null;

  private constructor(
    id: StudentId,
    name: Name,
    schoolClass: SchoolClass,
    additionalInformation: AdditionalInformation[],
    deletedAt: string | null,
    color: Color | null,
  ) {
    super(id);
    this._name = name;
    this._schoolClass = schoolClass;
    this._additionalInformation = [...additionalInformation];
    this.deletedAt = deletedAt;
    this._color = color;
  }

  static create(
    id: StudentId,
    name: Name,
    schoolClass: SchoolClass,
    deletedAt?: string | null,
    color?: Color | null,
  ): Student {
    return new Student(id, name, schoolClass, [], deletedAt ?? null, color ?? null);
  }

  get name(): Name {
    return this._name;
  }

  get schoolClass(): SchoolClass {
    return this._schoolClass;
  }

  get color(): Color | null {
    return this._color;
  }

  changeColor(color: Color | null): void {
    this._color = color;
  }

  get additionalInformation(): readonly AdditionalInformation[] {
    return this._additionalInformation;
  }

  addInformation(info: AdditionalInformation): void {
    const existingIndex = this._additionalInformation.findIndex((i) =>
      i.equals(info),
    );
    if (existingIndex >= 0) {
      this._additionalInformation[existingIndex] = info;
    } else {
      this._additionalInformation.push(info);
    }
  }

  removeInformation(key: string): void {
    this._additionalInformation = this._additionalInformation.filter(
      (info) => info.key !== key,
    );
  }

  changeClass(newClass: SchoolClass): void {
    this._schoolClass = newClass;
  }

  equals(other: Student): boolean {
    if (other === null || other === undefined) return false;
    if (this === other) return true;
    return this.id.equals(other.id);
  }
}
