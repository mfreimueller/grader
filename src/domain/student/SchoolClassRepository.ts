import { SchoolClass } from './SchoolClass';

export interface SchoolClassRepository {
  findAll(): Promise<SchoolClass[]>;
  findById(id: string): Promise<SchoolClass | null>;
  findByNameAndYear(name: string, schoolYear: string): Promise<SchoolClass | null>;
  save(schoolClass: SchoolClass): Promise<void>;
  delete(id: string): Promise<void>;
}
