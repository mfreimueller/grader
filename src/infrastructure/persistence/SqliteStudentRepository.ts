import type { Db } from './db';
import { StudentRepository } from '../../domain/student/StudentRepository';
import { Student } from '../../domain/student/Student';
import { StudentId } from '../../domain/student/StudentId';
import { Color } from '../../domain/student/Color';
import { Name } from '../../domain/student/Name';
import { SchoolClass } from '../../domain/student/SchoolClass';
import { SchoolYear } from '../../domain/student/SchoolYear';
import { AdditionalInformation } from '../../domain/student/AdditionalInformation';

export class SqliteStudentRepository implements StudentRepository {
  constructor(private readonly db: Db) {}

  async findById(id: StudentId): Promise<Student | null> {
    const row = this.db
      .prepare(
        `SELECT s.id, s.first_name, s.last_name, s.school_class_id, s.color,
                sc.name AS class_name, sc.school_year
         FROM students s
         JOIN school_classes sc ON s.school_class_id = sc.id
         WHERE s.id = ? AND s.deleted_at IS NULL AND sc.deleted_at IS NULL`,
      )
      .get(id.value) as Record<string, unknown> | undefined;

    if (!row) return null;

    return this.rowToStudent(row);
  }

  async findByName(firstName: string, lastName: string): Promise<Student[]> {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.first_name, s.last_name, s.school_class_id, s.color,
                sc.name AS class_name, sc.school_year
         FROM students s
         JOIN school_classes sc ON s.school_class_id = sc.id
         WHERE s.first_name = ? AND s.last_name = ? AND s.deleted_at IS NULL AND sc.deleted_at IS NULL`,
      )
      .all(firstName, lastName) as Record<string, unknown>[];

    return rows.map(r => this.rowToStudent(r));
  }

  async findAll(schoolClassId?: string): Promise<Student[]> {
    let sql = `SELECT s.id, s.first_name, s.last_name, s.school_class_id, s.color,
                sc.name AS class_name, sc.school_year
         FROM students s
         JOIN school_classes sc ON s.school_class_id = sc.id
         WHERE s.deleted_at IS NULL AND sc.deleted_at IS NULL`;
    const params: unknown[] = [];
    if (schoolClassId) {
      sql += ` AND s.school_class_id = ?`;
      params.push(schoolClassId);
    }
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];

    return rows.map(r => this.rowToStudent(r));
  }

  async save(student: Student): Promise<void> {
    const schoolClass = student.schoolClass;

    this.db
      .prepare(
        `INSERT OR REPLACE INTO school_classes (id, name, school_year)
         VALUES (?, ?, ?)`,
      )
      .run(schoolClass.id, schoolClass.name, schoolClass.schoolYear.toString());

    this.db
      .prepare('DELETE FROM student_additional_information WHERE student_id = ?')
      .run(student.id.value);

    this.db
      .prepare(
        `INSERT OR REPLACE INTO students (id, first_name, last_name, school_class_id, color)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        student.id.value,
        student.name.firstName,
        student.name.lastName,
        schoolClass.id,
        student.color?.value ?? null,
      );

    const insertInfo = this.db.prepare(
      'INSERT INTO student_additional_information (id, student_id, key, value) VALUES (?, ?, ?, ?)',
    );

    for (const info of student.additionalInformation) {
      insertInfo.run(
        `${student.id.value}:${info.key}`,
        student.id.value,
        info.key,
        info.value,
      );
    }
  }

  async delete(id: StudentId): Promise<void> {
    this.db
      .prepare('UPDATE students SET deleted_at = datetime(\'now\') WHERE id = ?')
      .run(id.value);
  }

  async findDeleted(): Promise<Student[]> {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.first_name, s.last_name, s.school_class_id, s.color, s.deleted_at,
                sc.name AS class_name, sc.school_year
         FROM students s
         JOIN school_classes sc ON s.school_class_id = sc.id
         WHERE s.deleted_at IS NOT NULL`,
      )
      .all() as Record<string, unknown>[];

    return rows.map(r => this.rowToStudent(r));
  }

  async restore(id: StudentId): Promise<void> {
    this.db
      .prepare('UPDATE students SET deleted_at = NULL WHERE id = ?')
      .run(id.value);
  }

  async hardDelete(id: StudentId): Promise<void> {
    this.db
      .prepare('DELETE FROM student_additional_information WHERE student_id = ?')
      .run(id.value);
    this.db
      .prepare('DELETE FROM course_student_picks WHERE student_id = ?')
      .run(id.value);
    this.db
      .prepare('DELETE FROM course_excluded_students WHERE student_id = ?')
      .run(id.value);
    this.db
      .prepare('DELETE FROM session_students WHERE student_id = ?')
      .run(id.value);
    this.db
      .prepare('DELETE FROM session_absences WHERE student_id = ?')
      .run(id.value);
    this.db
      .prepare('DELETE FROM grades WHERE student_id = ?')
      .run(id.value);
    this.db
      .prepare(
        'DELETE FROM findings WHERE student_performance_id IN (SELECT id FROM student_performances WHERE student_id = ?)',
      )
      .run(id.value);
    this.db
      .prepare('DELETE FROM student_performances WHERE student_id = ?')
      .run(id.value);
    this.db
      .prepare('DELETE FROM students WHERE id = ?')
      .run(id.value);
  }

  private rowToStudent(row: Record<string, unknown>): Student {
    const studentIdResult = StudentId.create(row.id as string);
    if (!studentIdResult.ok) throw studentIdResult.error;

    const nameResult = Name.create(
      row.first_name as string,
      row.last_name as string,
    );
    if (!nameResult.ok) throw nameResult.error;

    const yearResult = SchoolYear.create(row.school_year as string);
    if (!yearResult.ok) throw yearResult.error;

    const schoolClass = new SchoolClass(
      row.school_class_id as string,
      row.class_name as string,
      yearResult.value,
    );

    const rawColor = row.color as string | null | undefined;
    let colorResult: Color | null = null;
    if (rawColor) {
      const parsed = Color.create(rawColor);
      if (!parsed.ok) throw parsed.error;
      colorResult = parsed.value;
    }

    const student = Student.create(
      studentIdResult.value,
      nameResult.value,
      schoolClass,
      (row.deleted_at as string | undefined) ?? null,
      colorResult,
    );

    const infoRows = this.db
      .prepare(
        'SELECT key, value FROM student_additional_information WHERE student_id = ?',
      )
      .all(student.id.value) as { key: string; value: string }[];

    for (const info of infoRows) {
      student.addInformation(new AdditionalInformation(info.key, info.value));
    }

    return student;
  }
}
