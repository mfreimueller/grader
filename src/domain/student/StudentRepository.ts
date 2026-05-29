import { Student } from './Student';
import { StudentId } from './StudentId';

export interface StudentRepository {
  findById(id: StudentId): Promise<Student | null>;
  findAll(): Promise<Student[]>;
  findByName(firstName: string, lastName: string): Promise<Student[]>;
  save(student: Student): Promise<void>;
  delete(id: StudentId): Promise<void>;
}
