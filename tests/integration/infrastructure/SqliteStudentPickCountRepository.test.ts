import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteStudentPickCountRepository } from '../../../src/infrastructure/persistence/SqliteStudentPickCountRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { StudentId } from '../../../src/domain/student/StudentId';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteStudentPickCountRepository', () => {
  let db: Db;
  let repo: SqliteStudentPickCountRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteStudentPickCountRepository(db);
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4A', '2025/26');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-2', 'Physik', 'class-1');
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('returns an empty map when nobody was picked yet', async () => {
    expect((await repo.findByCourse('c-1')).size).toBe(0);
  });

  it('increments from zero and returns the new count', async () => {
    expect(await repo.increment('c-1', 's-1')).toBe(1);
    expect(await repo.increment('c-1', 's-1')).toBe(2);

    expect((await repo.findByCourse('c-1')).get('s-1')).toBe(2);
  });

  it('keeps counts per course', async () => {
    await repo.increment('c-1', 's-1');
    await repo.increment('c-2', 's-1');
    await repo.increment('c-2', 's-1');

    expect((await repo.findByCourse('c-1')).get('s-1')).toBe(1);
    expect((await repo.findByCourse('c-2')).get('s-1')).toBe(2);
  });

  it('sets a count absolutely', async () => {
    await repo.increment('c-1', 's-1');

    await repo.setCount('c-1', 's-1', 5);
    await repo.setCount('c-1', 's-1', 5);
    await repo.setCount('c-1', 's-2', 0);

    const counts = await repo.findByCourse('c-1');
    expect(counts.get('s-1')).toBe(5);
    expect(counts.get('s-2')).toBe(0);
  });

  it('resets only the given course', async () => {
    await repo.increment('c-1', 's-1');
    await repo.increment('c-2', 's-1');

    await repo.reset('c-1');

    expect((await repo.findByCourse('c-1')).size).toBe(0);
    expect((await repo.findByCourse('c-2')).get('s-1')).toBe(1);
  });

  it('removes a students pick counts when the student is hard-deleted', async () => {
    await repo.increment('c-1', 's-1');
    const id = StudentId.create('s-1');
    if (!id.ok) throw new Error('creation failed');

    await new SqliteStudentRepository(db).hardDelete(id.value);

    expect((await repo.findByCourse('c-1')).size).toBe(0);
  });

  it('removes a courses pick counts when the course is hard-deleted', async () => {
    await repo.increment('c-1', 's-1');

    await new SqliteCourseRepository(db).hardDelete('c-1');

    expect((await repo.findByCourse('c-1')).size).toBe(0);
  });
});
