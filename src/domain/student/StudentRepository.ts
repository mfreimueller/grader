import { Student } from './Student';
import { StudentId } from './StudentId';

export interface StudentRepository {
  findById(id: StudentId): Promise<Student | null>;
  findAll(schoolClassId?: string): Promise<Student[]>;
  findByName(firstName: string, lastName: string): Promise<Student[]>;
  findDeleted(): Promise<Student[]>;
  save(student: Student): Promise<void>;
  delete(id: StudentId): Promise<void>;
  restore(id: StudentId): Promise<void>;
  hardDelete(id: StudentId): Promise<void>;
}
