import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqlitePluginAssessmentRepository } from '../../../src/infrastructure/persistence/SqlitePluginAssessmentRepository';
import { PluginId } from '../../../src/domain/plugin/PluginId';
import type { Db } from '../../../src/infrastructure/persistence/db';

const aPluginId = (raw: string): PluginId => {
  const result = PluginId.create(raw);
  if (!result.ok) throw new Error('PluginId creation failed');
  return result.value;
};

const NOW = new Date('2026-10-12T10:00:00.000Z');

describe('SqlitePluginAssessmentRepository', () => {
  let db: Db;
  let repo: SqlitePluginAssessmentRepository;
  const tool = aPluginId('at.example.tool');
  const other = aPluginId('at.example.other');

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqlitePluginAssessmentRepository(db);
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26');
      INSERT INTO courses (id, title, school_class_id) VALUES ('course-1', 'Mathematik', 'class-1');
      INSERT INTO assessment_categories (id, title, grading_type, course_id) VALUES ('cat-1', 'Mitarbeit', 'TERTIARY', 'course-1');
      INSERT INTO sessions (id, date, course_id) VALUES ('sess-1', '2026-10-12', 'course-1');
      INSERT INTO assessments (id, title, category_id, course_id, session_id) VALUES ('a-1', 'Mitarbeit', 'cat-1', 'course-1', 'sess-1');
      INSERT INTO assessments (id, title, category_id, course_id, session_id) VALUES ('a-2', 'Mitarbeit', 'cat-1', 'course-1', 'sess-1');
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('knows that an assessment was created by the plugin that recorded it', async () => {
    await repo.record(tool, 'a-1', NOW);

    expect(await repo.isCreatedBy(tool, 'a-1')).toBe(true);
  });

  it('does not attribute the assessment to another plugin', async () => {
    await repo.record(tool, 'a-1', NOW);

    expect(await repo.isCreatedBy(other, 'a-1')).toBe(false);
  });

  it('does not attribute an assessment nobody recorded', async () => {
    expect(await repo.isCreatedBy(tool, 'a-2')).toBe(false);
  });

  it('forgets an assessment when it is removed', async () => {
    await repo.record(tool, 'a-1', NOW);

    await repo.remove('a-1');

    expect(await repo.isCreatedBy(tool, 'a-1')).toBe(false);
  });

  it('does nothing when removing an assessment that was never recorded', async () => {
    await expect(repo.remove('a-2')).resolves.toBeUndefined();
  });

  it('still knows the assessment after the session was saved again, which replaces its row', async () => {
    await repo.record(tool, 'a-1', NOW);

    db.prepare(
      "INSERT OR REPLACE INTO assessments (id, title, category_id, course_id, is_impromptu, max_points, session_id) VALUES ('a-1', 'Mitarbeit', 'cat-1', 'course-1', 1, NULL, 'sess-1')",
    ).run();

    expect(await repo.isCreatedBy(tool, 'a-1')).toBe(true);
  });

  it('refuses to record the same assessment twice', async () => {
    await repo.record(tool, 'a-1', NOW);

    // Matched on the SQLite code: native errors are not `instanceof Error` inside Jest's vm context.
    await expect(repo.record(other, 'a-1', NOW)).rejects.toMatchObject({
      code: 'SQLITE_CONSTRAINT_PRIMARYKEY',
    });
  });
});
