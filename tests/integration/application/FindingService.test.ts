import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteFindingRepository } from '../../../src/infrastructure/persistence/SqliteFindingRepository';
import { SqliteUnitOfWork } from '../../../src/infrastructure/persistence/SqliteUnitOfWork';
import { FindingService } from '../../../src/application/FindingService';
import { NotFoundError } from '../../../src/shared/errors';
import { rejectionMessage } from '../../helpers/rejection';
import type { Note } from '../../../src/domain/grade/Note';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('FindingService', () => {
  let db: Db;
  let service: FindingService;
  let repo: SqliteFindingRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteFindingRepository(db);
    service = new FindingService(repo, new SqliteUnitOfWork(db));

    db.prepare("INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')").run();
    db.prepare("INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-001', 'Max', 'Mustermann', 'class-1')").run();
    db.prepare("INSERT INTO courses (id, title, school_class_id) VALUES ('course-1', 'Mathematik', 'class-1')").run();
    db.prepare("INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('cat-1', 'Mitarbeit', 'TERTIARY', 0, 'course-1')").run();
    db.prepare("INSERT INTO assessments (id, title, category_id, course_id) VALUES ('a-001', 'Mündlich', 'cat-1', 'course-1')").run();
    db.prepare("INSERT INTO student_performances (id, student_id, assessment_id, type) VALUES ('p-001', 's-001', 'a-001', 'participation')").run();
  });

  afterEach(() => {
    db.close();
  });

  it('adds a note', async () => {
    const result = await service.addNote({ performanceId: 'p-001', text: 'Gute Mitarbeit' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('note');
    expect(result.value.text).toBe('Gute Mitarbeit');
  });

  it('adds a document', async () => {
    const result = await service.addDocument({ performanceId: 'p-001', filePath: '/path/to/file.pdf' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('document');
    expect(result.value.filePath).toBe('/path/to/file.pdf');
  });

  it('adds a remote document', async () => {
    const result = await service.addRemoteDocument({ performanceId: 'p-001', url: 'https://example.com/doc' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('remote_document');
    expect(result.value.url).toBe('https://example.com/doc');
  });

  it('lists findings for a performance', async () => {
    await service.addNote({ performanceId: 'p-001', text: 'Note 1' });
    await service.addDocument({ performanceId: 'p-001', filePath: '/doc.pdf' });
    const findings = await service.getFindings('p-001');
    expect(findings).toHaveLength(2);
  });

  it('removes a finding (soft delete)', async () => {
    const created = await service.addNote({ performanceId: 'p-001', text: 'Note' });
    if (!created.ok) return;
    const removed = await service.remove(created.value.id);
    expect(removed.ok).toBe(true);
    const findings = await service.getFindings('p-001');
    expect(findings).toHaveLength(0);
  });

  describe('listNotesBySession', () => {
    beforeEach(() => {
      db.exec(`
        INSERT INTO sessions (id, date, course_id) VALUES ('sess-1', '2025-10-01', 'course-1');
        UPDATE assessments SET session_id = 'sess-1' WHERE id = 'a-001';
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-002', 'Anna', 'Musterfrau', 'class-1');
        INSERT INTO student_performances (id, student_id, assessment_id, type) VALUES ('p-002', 's-002', 'a-001', 'participation');
      `);
    });

    it('returns one entry per performance with a note', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Eins' });
      await service.addNote({ performanceId: 'p-002', text: 'Zwei' });

      const notes = await service.listNotesBySession('sess-1');

      expect(notes).toEqual([
        { performanceId: 'p-001', text: 'Eins' },
        { performanceId: 'p-002', text: 'Zwei' },
      ]);
    });

    it('joins several notes of one performance into one text', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Eins' });
      await service.addNote({ performanceId: 'p-001', text: 'Zwei' });

      expect(await service.listNotesBySession('sess-1')).toEqual([
        { performanceId: 'p-001', text: 'Eins\nZwei' },
      ]);
    });

    it('returns nothing for a session without notes', async () => {
      await service.addDocument({ performanceId: 'p-001', filePath: '/doc.pdf' });
      expect(await service.listNotesBySession('sess-1')).toEqual([]);
    });
  });

  describe('setNote', () => {
    const noteTexts = async (): Promise<string[]> =>
      (await repo.findByPerformance('p-001')).filter((f): f is Note => f.constructor.name === 'Note').map((n) => n.text);

    it('creates the note when there is none', async () => {
      const result = await service.setNote('p-001', 'Neu');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toMatchObject({ performanceId: 'p-001', type: 'note', text: 'Neu' });
      expect(await noteTexts()).toEqual(['Neu']);
    });

    it('replaces the existing note', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Alt' });

      await service.setNote('p-001', 'Neu');

      expect(await noteTexts()).toEqual(['Neu']);
    });

    it('replaces several existing notes by one', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Eins' });
      await service.addNote({ performanceId: 'p-001', text: 'Zwei' });

      await service.setNote('p-001', 'Neu');

      expect(await noteTexts()).toEqual(['Neu']);
    });

    it('trims the text', async () => {
      const result = await service.setNote('p-001', '  Neu \n');
      if (!result.ok) throw result.error;
      expect(result.value?.text).toBe('Neu');
    });

    it('removes the notes and returns null when the text is empty', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Alt' });

      const result = await service.setNote('p-001', '');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBeNull();
      expect(await noteTexts()).toEqual([]);
    });

    it('treats whitespace-only text like empty text', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Alt' });
      const result = await service.setNote('p-001', '   \n ');
      expect(result.ok && result.value === null).toBe(true);
      expect(await noteTexts()).toEqual([]);
    });

    it('keeps documents and links of the performance', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Alt' });
      await service.addDocument({ performanceId: 'p-001', filePath: '/doc.pdf' });
      await service.addRemoteDocument({ performanceId: 'p-001', url: 'https://example.com' });

      await service.setNote('p-001', 'Neu');

      const types = (await service.getFindings('p-001')).map((f) => f.type).sort();
      expect(types).toEqual(['document', 'note', 'remote_document']);
    });

    it('does not touch the notes of other performances', async () => {
      db.exec(`
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-002', 'Anna', 'Musterfrau', 'class-1');
        INSERT INTO student_performances (id, student_id, assessment_id, type) VALUES ('p-002', 's-002', 'a-001', 'participation');
      `);
      await service.addNote({ performanceId: 'p-002', text: 'Andere' });

      await service.setNote('p-001', 'Neu');

      expect((await service.getFindings('p-002')).map((f) => f.text)).toEqual(['Andere']);
    });

    it('fails for an unknown performance and creates nothing', async () => {
      const result = await service.setNote('missing', 'Text');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
      expect(await service.getFindings('missing')).toEqual([]);
    });

    it('fails for a deleted performance', async () => {
      db.prepare("UPDATE student_performances SET deleted_at = datetime('now') WHERE id = 'p-001'").run();

      const result = await service.setNote('p-001', 'Text');

      expect(result.ok).toBe(false);
    });

    it('rolls back the removal of the old note when saving the new one fails', async () => {
      await service.addNote({ performanceId: 'p-001', text: 'Alt' });
      class FailingSave extends SqliteFindingRepository {
        override async save(): Promise<void> {
          throw new Error('disk full');
        }
      }
      const failing = new FindingService(new FailingSave(db), new SqliteUnitOfWork(db));

      const message = await rejectionMessage(failing.setNote('p-001', 'Neu'));

      expect(message).toBe('disk full');
      expect(await noteTexts()).toEqual(['Alt']);
    });
  });
});
