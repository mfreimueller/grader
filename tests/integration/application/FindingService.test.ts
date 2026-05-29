import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteFindingRepository } from '../../../src/infrastructure/persistence/SqliteFindingRepository';
import { FindingService } from '../../../src/application/FindingService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('FindingService', () => {
  let db: Db;
  let service: FindingService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    service = new FindingService(new SqliteFindingRepository(db));

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
});
