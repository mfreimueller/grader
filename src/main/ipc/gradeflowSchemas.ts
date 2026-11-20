import { z } from 'zod';
import {
  MAX_BUDGET_USD,
  MAX_TIMEOUT_MINUTES,
  MIN_BUDGET_USD,
  MIN_TIMEOUT_MINUTES,
} from '../gradeflowSettings';

/** Everything the renderer sends is untrusted; unknown fields are dropped. */

const id = z.string().min(1).max(200);
const path = z.string().min(1).max(4096);

export const prepareSchema = z.object({
  courseId: id,
  assessmentId: id,
  handinsDir: path,
  assignmentPath: path,
  solutionPath: path.nullable(),
  skillId: id,
});

export const prepareJideSchema = z.object({
  courseId: id,
  assessmentId: id,
  jideExerciseId: id,
  skillId: id,
});

export const runIdSchema = z.object({ runId: id });

export const confirmSchema = z.object({
  runId: id,
  overrides: z.array(z.object({ moodleId: id, studentId: id.nullable() })).max(5000),
});

export const excludeFilesSchema = z.object({
  runId: id,
  files: z.array(z.object({ studentId: id, path })).max(20000),
});

export const saveSchema = z.object({
  runId: id,
  rows: z
    .array(
      z.object({
        studentId: id,
        symbol: z.string().max(40).optional(),
        score: z.number().optional(),
        comment: z.string().max(20000),
        include: z.boolean(),
        lineComments: z
          .array(z.object({ path: z.string().min(1).max(500), line: z.number().int(), text: z.string().max(5000) }))
          .max(1000)
          .optional(),
        skipGrader: z.boolean().optional(),
        skipJide: z.boolean().optional(),
      }),
    )
    .max(5000),
  overwriteConfirmed: z.boolean(),
});

export const pickPathSchema = z.object({
  kind: z.enum(['file', 'directory']),
  title: z.string().max(200),
});

export const gradeflowSettingsSchema = z.object({
  maxBudgetUsd: z.number().min(MIN_BUDGET_USD).max(MAX_BUDGET_USD),
  timeoutMinutes: z.number().int().min(MIN_TIMEOUT_MINUTES).max(MAX_TIMEOUT_MINUTES),
});
