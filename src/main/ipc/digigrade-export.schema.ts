import { z } from 'zod';
import type { DigigradeExport } from '../../application/DigigradeExport';
import { Result } from '../../domain/shared/Result';
import { ValidationError } from '../../shared/errors';

const text = z.string();
const nullableText = z.string().nullable();

const schema = z.object({
  format: z.literal('digigrade-export'),
  version: z.literal(1),
  exportedAt: text,
  classes: z.array(z.object({ id: text, name: text, schoolYear: text })),
  students: z.array(
    z.object({ id: text, classId: text, firstName: text, lastName: text, color: nullableText }),
  ),
  courses: z.array(
    z.object({
      id: text,
      title: text,
      classId: text,
      pickCounts: z.array(z.object({ studentId: text, pickCount: z.number() })),
      categories: z.array(
        z.object({
          id: text,
          title: text,
          gradingType: text,
          displayAsGrade: z.boolean(),
          hidden: z.boolean(),
        }),
      ),
      compositions: z.array(z.object({ categoryId: text, weight: z.number(), subWeightType: text })),
      excludedStudentIds: z.array(text),
      sessions: z.array(
        z.object({
          id: text,
          date: text,
          notes: nullableText,
          assessments: z.array(
            z.object({
              id: text,
              title: text,
              categoryId: text,
              maxPoints: z.number().nullable(),
              impromptu: z.boolean(),
              performances: z.array(
                z.object({
                  studentId: text,
                  score: z.number().nullable(),
                  symbol: nullableText,
                  findings: z.array(z.object({ type: text, text: nullableText, url: nullableText })),
                }),
              ),
            }),
          ),
        }),
      ),
      grades: z.array(z.object({ studentId: text, score: z.number() })),
    }),
  ),
}) satisfies z.ZodType<DigigradeExport>;

/** Checks that raw JSON is a digigrade export in a version this app understands. */
export function parseDigigradeExport(raw: unknown): Result<DigigradeExport> {
  if (typeof raw !== 'object' || raw === null) {
    return Result.fail(new ValidationError('Die Datei ist keine gültige digigrade-Exportdatei.'));
  }
  const header = raw as { format?: unknown; version?: unknown };
  if (header.format !== 'digigrade-export') {
    return Result.fail(new ValidationError('Die Datei ist kein digigrade-Export.'));
  }
  if (header.version !== 1) {
    return Result.fail(
      new ValidationError(
        `Nicht unterstützte Version ${String(header.version)} des digigrade-Exports. Bitte aktualisieren Sie grader.`,
      ),
    );
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue ? issue.path.join('.') : '';
    return Result.fail(
      new ValidationError(`Die digigrade-Exportdatei ist unvollständig oder beschädigt (${where}).`),
    );
  }
  return Result.ok(parsed.data);
}
