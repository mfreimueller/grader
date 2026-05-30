import { StudentRepository } from '../domain/student/StudentRepository';
import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { StudentId } from '../domain/student/StudentId';
import { Student } from '../domain/student/Student';
import { SchoolClass } from '../domain/student/SchoolClass';
import { SchoolYear } from '../domain/student/SchoolYear';
import { Name } from '../domain/student/Name';
import { generateId } from '../domain/shared/IdGenerator';

export interface CsvRow {
  className: string;
  schoolYear: string;
  lastName: string;
  firstName: string;
}

export interface ImportResult {
  classesCreated: number;
  studentsCreated: number;
  studentsUpdated: number;
  warnings: string[];
}

export class CsvImportService {
  constructor(
    private readonly classRepo: SchoolClassRepository,
    private readonly studentRepo: StudentRepository,
  ) {}

  async importCsv(csvContent: string, hasHeader: boolean = true): Promise<ImportResult> {
    const rows = this.parseCsv(csvContent, hasHeader);
    const result: ImportResult = {
      classesCreated: 0,
      studentsCreated: 0,
      studentsUpdated: 0,
      warnings: [],
    };

    for (const [index, row] of rows.entries()) {
      try {
        await this.processRow(row, result);
      } catch (e) {
        result.warnings.push(
          `Zeile ${index + 2}: ${(e as Error).message}`,
        );
      }
    }

    return result;
  }

  private parseCsv(content: string, hasHeader: boolean): CsvRow[] {
    const cleaned = content.replace(/^\uFEFF/, '');
    const lines = cleaned.split('\n');
    const startIndex = hasHeader ? 1 : 0;
    if (lines.length <= startIndex) return [];

    const rows: CsvRow[] = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      const parts = line.split(';');
      if (parts.length < 4) {
        throw new Error(
          `Ungültiges Format, erwarte 4 semikolon-getrennte Spalten`,
        );
      }
      rows.push({
        className: parts[0]!.trim(),
        schoolYear: parts[1]!.trim(),
        lastName: parts[2]!.trim(),
        firstName: parts[3]!.trim(),
      });
    }
    return rows;
  }

  private async processRow(
    row: CsvRow,
    result: ImportResult,
  ): Promise<void> {
    const schoolClass = await this.findOrCreateClass(row, result);
    if (!schoolClass) return;

    const existing = await this.studentRepo.findByName(
      row.firstName,
      row.lastName,
    );

    if (existing.length === 0) {
      await this.createStudent(row, schoolClass, result);
      return;
    }

    await this.handleExistingStudent(row, schoolClass, existing, result);
  }

  private async findOrCreateClass(
    row: CsvRow,
    result: ImportResult,
  ): Promise<SchoolClass | null> {
    const existing = await this.classRepo.findByNameAndYear(
      row.className,
      row.schoolYear,
    );
    if (existing) return existing;

    const yearResult = SchoolYear.create(row.schoolYear);
    if (!yearResult.ok) {
      result.warnings.push(
        `Ungültiges Schuljahr "${row.schoolYear}" für Klasse "${row.className}": ${yearResult.error.message}`,
      );
      return null;
    }

    const schoolClass = new SchoolClass(
      generateId(),
      row.className,
      yearResult.value,
    );
    await this.classRepo.save(schoolClass);
    result.classesCreated++;
    return schoolClass;
  }

  private async createStudent(
    row: CsvRow,
    schoolClass: SchoolClass,
    result: ImportResult,
  ): Promise<void> {
    const nameResult = Name.create(row.firstName, row.lastName);
    if (!nameResult.ok) {
      result.warnings.push(
        `Ungültiger Name "${row.firstName} ${row.lastName}": ${nameResult.error.message}`,
      );
      return;
    }

    const sidResult = StudentId.create(generateId());
    if (!sidResult.ok) {
      result.warnings.push(sidResult.error.message);
      return;
    }

    const student = Student.create(
      sidResult.value,
      nameResult.value,
      schoolClass,
    );
    await this.studentRepo.save(student);
    result.studentsCreated++;
  }

  private async handleExistingStudent(
    row: CsvRow,
    schoolClass: SchoolClass,
    existing: Student[],
    result: ImportResult,
  ): Promise<void> {
    const sameClass = existing.find(
      (s) => s.schoolClass.id === schoolClass.id,
    );
    if (sameClass) return;

    const sameYear = existing.find(
      (s) => s.schoolClass.schoolYear.toString() === row.schoolYear,
    );
    if (sameYear) {
      result.warnings.push(
        `"${row.firstName} ${row.lastName}" existiert bereits in Klasse "${sameYear.schoolClass.name}" (${row.schoolYear}). Überspringe.`,
      );
      return;
    }

    const student = existing[0]!;
    const nameResult = Name.create(row.firstName, row.lastName);
    if (!nameResult.ok) {
      result.warnings.push(
        `Ungültiger Name für "${row.firstName} ${row.lastName}": ${nameResult.error.message}`,
      );
      return;
    }

    const updated = Student.create(student.id, nameResult.value, schoolClass);
    for (const info of student.additionalInformation) {
      updated.addInformation(info);
    }
    await this.studentRepo.save(updated);
    result.studentsUpdated++;
  }
}
