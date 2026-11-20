import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import type { Db } from '../../../src/infrastructure/persistence/db';
import { SqliteJideConnectionRepository } from '../../../src/infrastructure/persistence/SqliteJideConnectionRepository';
import { SqliteJideLinkRepository } from '../../../src/infrastructure/persistence/SqliteJideLinkRepository';

const NOW = new Date('2026-11-20T10:00:00.000Z');
const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

describe('SqliteJideConnectionRepository', () => {
  let db: Db;
  let repo: SqliteJideConnectionRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteJideConnectionRepository(db);
  });
  afterEach(() => db.close());

  it('has no connection at first', async () => {
    expect(await repo.get()).toBeNull();
  });

  it('stores address and encrypted key', async () => {
    await repo.save('https://jide.example', bytes(1, 2, 3), NOW);
    expect(await repo.get()).toEqual({ baseUrl: 'https://jide.example', encryptedKey: bytes(1, 2, 3) });
  });

  it('replaces the connection', async () => {
    await repo.save('https://a.example', bytes(1), NOW);
    await repo.save('https://b.example', bytes(2), NOW);
    expect(await repo.get()).toEqual({ baseUrl: 'https://b.example', encryptedKey: bytes(2) });
  });

  it('keeps the stored key when saving without a new one', async () => {
    await repo.save('https://a.example', bytes(1), NOW);
    await repo.save('https://b.example', null, NOW);
    expect(await repo.get()).toEqual({ baseUrl: 'https://b.example', encryptedKey: bytes(1) });
  });

  it('stores nothing when there is neither a key nor a stored one', async () => {
    await repo.save('https://a.example', null, NOW);
    expect(await repo.get()).toBeNull();
  });

  it('clears the connection', async () => {
    await repo.save('https://a.example', bytes(1), NOW);
    await repo.clear();
    expect(await repo.get()).toBeNull();
  });
});

describe('SqliteJideLinkRepository', () => {
  let db: Db;
  let repo: SqliteJideLinkRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteJideLinkRepository(db);
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '3AHIF', '2026/27');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Programmieren', 'class-1');
    `);
  });
  afterEach(() => db.close());

  it('has no course link at first', async () => {
    expect(await repo.courseLink('c-1')).toBeNull();
  });

  it('sets, replaces and removes the course link', async () => {
    await repo.setCourseLink('c-1', '7');
    expect(await repo.courseLink('c-1')).toBe('7');
    await repo.setCourseLink('c-1', '8');
    expect(await repo.courseLink('c-1')).toBe('8');
    await repo.setCourseLink('c-1', null);
    expect(await repo.courseLink('c-1')).toBeNull();
  });

  it('sets student links and reads back the asked ones only', async () => {
    await repo.setStudentLinks([
      { studentId: 's-1', jideStudentId: '11' },
      { studentId: 's-2', jideStudentId: '12' },
    ]);
    expect([...(await repo.studentLinks(['s-1']))]).toEqual([['s-1', '11']]);
    expect(await repo.studentLinks([])).toEqual(new Map());
  });

  it('replaces and removes student links', async () => {
    await repo.setStudentLinks([{ studentId: 's-1', jideStudentId: '11' }]);
    await repo.setStudentLinks([
      { studentId: 's-1', jideStudentId: '99' },
      { studentId: 's-2', jideStudentId: '12' },
    ]);
    await repo.setStudentLinks([{ studentId: 's-2', jideStudentId: null }]);
    expect([...(await repo.studentLinks(['s-1', 's-2']))]).toEqual([['s-1', '99']]);
  });

  it('removes links with the student and the course', async () => {
    await repo.setCourseLink('c-1', '7');
    await repo.setStudentLinks([{ studentId: 's-1', jideStudentId: '11' }]);
    db.exec("DELETE FROM courses WHERE id = 'c-1'; DELETE FROM students WHERE id = 's-1'");
    expect((db.prepare('SELECT COUNT(*) AS n FROM jide_course_links').get() as { n: number }).n).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM jide_student_links').get() as { n: number }).n).toBe(0);
  });
});
