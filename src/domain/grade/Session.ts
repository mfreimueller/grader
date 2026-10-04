import { Entity } from '../shared/Entity';
import { Course } from './Course';
import { Student } from '../student/Student';
import { StudentId } from '../student/StudentId';
import { Assessment } from './Assessment';

export interface StudentNote {
  studentId: string;
  text: string;
}

export class Session extends Entity<string> {
  private _date: Date;
  private _notes: string;
  private _course: Course;
  private _students: Student[];
  private _assessments: Assessment[];
  private _absentStudentIds: Set<string>;
  private _studentNotes: Map<string, string>;

  private constructor(
    id: string,
    date: Date,
    notes: string,
    course: Course,
    students: Student[],
    assessments: Assessment[],
    absentStudentIds: readonly string[],
    studentNotes: readonly StudentNote[],
  ) {
    super(id);
    this._date = date;
    this._notes = notes;
    this._course = course;
    this._students = [...students];
    this._assessments = [...assessments];
    this._absentStudentIds = new Set(absentStudentIds);
    this._studentNotes = new Map(studentNotes.map((n) => [n.studentId, n.text]));
  }

  static create(id: string, date: Date, notes: string, course: Course): Session {
    const mitarbeit = course.getMitarbeitCategory();
    const muendlich = new Assessment(
      `${id}:muendlich`,
      'Mündlich',
      mitarbeit!,
      course,
      id,
    );
    return new Session(id, date, notes, course, [], [muendlich], [], []);
  }

  static reconstitute(
    id: string,
    date: Date,
    notes: string,
    course: Course,
    students: Student[],
    assessments: Assessment[],
    absentStudentIds: readonly string[] = [],
    studentNotes: readonly StudentNote[] = [],
  ): Session {
    return new Session(id, date, notes, course, students, assessments, absentStudentIds, studentNotes);
  }

  get date(): Date {
    return this._date;
  }

  get notes(): string {
    return this._notes;
  }

  get course(): Course {
    return this._course;
  }

  get students(): readonly Student[] {
    return this._students;
  }

  get assessments(): readonly Assessment[] {
    return this._assessments;
  }

  get absentStudentIds(): readonly string[] {
    return [...this._absentStudentIds];
  }

  /** The general notes of this session, one per student at most (e.g. "beteiligt sich nicht"). */
  get studentNotes(): readonly StudentNote[] {
    return [...this._studentNotes].map(([studentId, text]) => ({ studentId, text }));
  }

  studentNoteOf(studentId: StudentId): string | null {
    return this._studentNotes.get(studentId.value) ?? null;
  }

  /** Sets the student's note; blank text removes it. */
  setStudentNote(studentId: StudentId, text: string): void {
    const trimmed = text.trim();
    if (trimmed === '') this._studentNotes.delete(studentId.value);
    else this._studentNotes.set(studentId.value, trimmed);
  }

  isAbsent(studentId: StudentId): boolean {
    return this._absentStudentIds.has(studentId.value);
  }

  markAbsent(studentId: StudentId): void {
    this._absentStudentIds.add(studentId.value);
  }

  markPresent(studentId: StudentId): void {
    this._absentStudentIds.delete(studentId.value);
  }

  addStudent(student: Student): void {
    const exists = this._students.some((s) => s.id.equals(student.id));
    if (!exists) {
      this._students.push(student);
    }
  }

  removeStudent(studentId: StudentId): void {
    this._students = this._students.filter((s) => !s.id.equals(studentId));
  }

  updateDate(date: Date): void {
    this._date = date;
  }

  updateNotes(notes: string): void {
    this._notes = notes;
  }
}
