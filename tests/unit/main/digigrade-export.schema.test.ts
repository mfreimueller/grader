import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDigigradeExport } from '../../../src/main/ipc/digigrade-export.schema';

const fixture = (): unknown => JSON.parse(readFileSync(join(__dirname, '../../fixtures/digigrade-export.json'), 'utf-8'));

const withChange = (change: (doc: Record<string, unknown>) => void): unknown => {
  const doc = fixture() as Record<string, unknown>;
  change(doc);
  return doc;
};

describe('parseDigigradeExport', () => {
  it('accepts the version 1 fixture produced by digigrade', () => {
    const result = parseDigigradeExport(fixture());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.classes).toHaveLength(2);
    expect(result.value.courses[0]!.sessions[0]!.assessments[0]!.performances[0]!.findings).toHaveLength(2);
  });

  it('rejects something that is not an object', () => {
    expect(parseDigigradeExport('hello').ok).toBe(false);
    expect(parseDigigradeExport(null).ok).toBe(false);
  });

  it('rejects a file from another application', () => {
    const result = parseDigigradeExport(withChange((d) => { d['format'] = 'something-else'; }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('digigrade');
  });

  it('rejects an unknown version with a hint to update', () => {
    const result = parseDigigradeExport(withChange((d) => { d['version'] = 2; }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Version');
  });

  it('rejects a document with missing sections', () => {
    const result = parseDigigradeExport(withChange((d) => { delete d['students']; }));

    expect(result.ok).toBe(false);
  });

  it('rejects wrongly typed fields deep in the document', () => {
    const result = parseDigigradeExport(
      withChange((d) => {
        const courses = d['courses'] as { grades: { score: unknown }[] }[];
        courses[0]!.grades[0]!.score = 'two';
      }),
    );

    expect(result.ok).toBe(false);
  });
});
