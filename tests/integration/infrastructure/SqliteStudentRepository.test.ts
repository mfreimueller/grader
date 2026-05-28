import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { AdditionalInformation } from '../../../src/domain/student/AdditionalInformation';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteStudentRepository', () => {
  let db: Db;
  let repo: SqliteStudentRepository;
  let schoolClass: SchoolClass;

  function seedSchoolClass(): void {
    db.prepare(
      "INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')",
    ).run();
    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw new Error('SchoolYear creation failed');
    schoolClass = new SchoolClass('class-1', '1A', year.value);
  }

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteStudentRepository(db);
    seedSchoolClass();
  });

  afterEach(() => {
    db.close();
  });

  describe('save and findById', () => {
    it('persists a student and retrieves it by id', async () => {
      const id = StudentId.create('s-001');
      const name = Name.create('Max', 'Mustermann');
      if (!id.ok || !name.ok) throw new Error('creation failed');
      const student = Student.create(id.value, name.value, schoolClass);

      await repo.save(student);
      const found = await repo.findById(id.value);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe('s-001');
      expect(found!.name.firstName).toBe('Max');
      expect(found!.name.lastName).toBe('Mustermann');
      expect(found!.schoolClass.id).toBe('class-1');
    });

    it('returns null for non-existent id', async () => {
      const id = StudentId.create('nonexistent');
      if (!id.ok) throw new Error('creation failed');
      const found = await repo.findById(id.value);
      expect(found).toBeNull();
    });

    it('updates an existing student on save', async () => {
      const id = StudentId.create('s-001');
      const name = Name.create('Max', 'Mustermann');
      if (!id.ok || !name.ok) throw new Error('creation failed');
      const student = Student.create(id.value, name.value, schoolClass);

      await repo.save(student);

      const updatedName = Name.create('Maxi', 'Mustermann');
      if (!updatedName.ok) throw new Error('creation failed');
      const updatedSchoolYear = SchoolYear.create('2025/26');
      if (!updatedSchoolYear.ok) throw new Error('creation failed');
      const updatedClass = new SchoolClass('class-1', '1A', updatedSchoolYear.value);
      const updatedStudent = Student.create(id.value, updatedName.value, updatedClass);
      await repo.save(updatedStudent);

      const found = await repo.findById(id.value);
      expect(found).not.toBeNull();
      expect(found!.name.firstName).toBe('Maxi');
    });
  });

  describe('findAll', () => {
    it('returns all students', async () => {
      const id1 = StudentId.create('s-001');
      const name1 = Name.create('Max', 'Mustermann');
      if (!id1.ok || !name1.ok) throw new Error('creation failed');
      await repo.save(Student.create(id1.value, name1.value, schoolClass));

      const id2 = StudentId.create('s-002');
      const name2 = Name.create('Anna', 'Muster');
      if (!id2.ok || !name2.ok) throw new Error('creation failed');
      await repo.save(Student.create(id2.value, name2.value, schoolClass));

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
    });

    it('returns empty array when no students exist', async () => {
      const all = await repo.findAll();
      expect(all).toEqual([]);
    });
  });

  describe('delete', () => {
    it('removes a student from the database', async () => {
      const id = StudentId.create('s-001');
      const name = Name.create('Max', 'Mustermann');
      if (!id.ok || !name.ok) throw new Error('creation failed');
      await repo.save(Student.create(id.value, name.value, schoolClass));

      const idToDelete = StudentId.create('s-001');
      if (!idToDelete.ok) throw new Error('creation failed');
      await repo.delete(idToDelete.value);

      const found = await repo.findById(id.value);
      expect(found).toBeNull();
    });

    it('does nothing when deleting a non-existent student', async () => {
      const id = StudentId.create('nonexistent');
      if (!id.ok) throw new Error('creation failed');
      await expect(repo.delete(id.value)).resolves.toBeUndefined();
    });
  });

  describe('additional information', () => {
    it('saves and retrieves additional information', async () => {
      const id = StudentId.create('s-001');
      const name = Name.create('Max', 'Mustermann');
      if (!id.ok || !name.ok) throw new Error('creation failed');
      const student = Student.create(id.value, name.value, schoolClass);
      student.addInformation(new AdditionalInformation('email', 'max@school.at'));
      student.addInformation(new AdditionalInformation('phone', '12345'));

      await repo.save(student);

      const found = await repo.findById(id.value);
      expect(found).not.toBeNull();
      expect(found!.additionalInformation).toHaveLength(2);
    });
  });
});
