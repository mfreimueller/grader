import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteFindingRepository } from '../../../src/infrastructure/persistence/SqliteFindingRepository';
import { Note } from '../../../src/domain/grade/Note';
import { Document } from '../../../src/domain/grade/Document';
import { RemoteDocument } from '../../../src/domain/grade/RemoteDocument';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteFindingRepository', () => {
  let db: Db;
  let repo: SqliteFindingRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteFindingRepository(db);

    db.prepare(
      "INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')",
    ).run();
    db.prepare(
      "INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-001', 'Max', 'Mustermann', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO courses (id, title, school_class_id) VALUES ('course-1', 'Mathematik', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('cat-1', 'Mitarbeit', 'TERTIARY', 0, 'course-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessments (id, title, category_id, course_id) VALUES ('a-001', 'Mündlich', 'cat-1', 'course-1')",
    ).run();
    db.prepare(
      "INSERT INTO student_performances (id, student_id, assessment_id, type) VALUES ('p-001', 's-001', 'a-001', 'participation')",
    ).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('save and findByPerformance', () => {
    it('persists a Note and retrieves it', async () => {
      const note = new Note('f-001', 'Gute Mitarbeit');
      await repo.save(note, 'p-001');

      const found = await repo.findByPerformance('p-001');
      expect(found).toHaveLength(1);
      expect(found[0]!.id).toBe('f-001');
      expect(found[0]).toBeInstanceOf(Note);
      expect((found[0] as Note).text).toBe('Gute Mitarbeit');
    });

    it('persists a Document and retrieves it', async () => {
      const doc = new Document('f-002', '/path/to/file.pdf');
      await repo.save(doc, 'p-001');

      const found = await repo.findByPerformance('p-001');
      expect(found).toHaveLength(1);
      expect(found[0]).toBeInstanceOf(Document);
      expect((found[0] as Document).filePath).toBe('/path/to/file.pdf');
    });

    it('persists a RemoteDocument and retrieves it', async () => {
      const remote = new RemoteDocument('f-003', 'https://example.com/doc');
      await repo.save(remote, 'p-001');

      const found = await repo.findByPerformance('p-001');
      expect(found).toHaveLength(1);
      expect(found[0]).toBeInstanceOf(RemoteDocument);
      expect((found[0] as RemoteDocument).url).toBe('https://example.com/doc');
    });

    it('returns empty array when performance has no findings', async () => {
      const found = await repo.findByPerformance('nonexistent');
      expect(found).toEqual([]);
    });

    it('stores multiple findings for the same performance', async () => {
      await repo.save(new Note('f-001', 'Note 1'), 'p-001');
      await repo.save(new Note('f-002', 'Note 2'), 'p-001');

      const found = await repo.findByPerformance('p-001');
      expect(found).toHaveLength(2);
    });
  });

  describe('soft delete', () => {
    it('soft-deletes a finding', async () => {
      const note = new Note('f-001', 'Gute Mitarbeit');
      await repo.save(note, 'p-001');

      await repo.delete('f-001');
      const found = await repo.findByPerformance('p-001');
      expect(found).toHaveLength(0);

      const raw = db.prepare('SELECT id, deleted_at FROM findings WHERE id = ?').get('f-001') as {
        id: string;
        deleted_at: string | null;
      };
      expect(raw.deleted_at).not.toBeNull();
    });
  });
});
