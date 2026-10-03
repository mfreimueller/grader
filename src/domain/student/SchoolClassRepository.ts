import { SchoolClass } from './SchoolClass';

export interface ClassDependentsCount {
  students: number;
  courses: number;
}

export interface SchoolClassRepository {
  findAll(): Promise<SchoolClass[]>;
  findById(id: string): Promise<SchoolClass | null>;
  findByNameAndYear(name: string, schoolYear: string): Promise<SchoolClass | null>;
  findDeleted(): Promise<SchoolClass[]>;
  save(schoolClass: SchoolClass): Promise<void>;
  delete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  /** Live students and courses that deleting the class would take with it. */
  countDependents(id: string): Promise<ClassDependentsCount>;
  /** Atomically soft-deletes the class and its live students and courses with one shared timestamp. */
  softDeleteWithDependents(id: string): Promise<void>;
  /** Restores the class plus exactly the students and courses that were deleted together with it. */
  restoreWithDependents(id: string): Promise<void>;
}
