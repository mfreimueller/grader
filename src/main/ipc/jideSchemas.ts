import { z } from 'zod';

/** Everything the renderer sends is untrusted; unknown fields are dropped. */

const id = z.string().min(1).max(200);

export const jideSettingsSchema = z.object({
  baseUrl: z.string().max(500),
  apiKey: z.string().max(500),
});

export const linkOverviewSchema = z.object({
  courseId: id,
  jideCourseId: id.nullable().optional(),
});

export const saveLinksSchema = z.object({
  courseId: id,
  jideCourseId: id.nullable(),
  links: z.array(z.object({ studentId: id, jideStudentId: id.nullable() })).max(2000),
});

export const courseIdSchema = z.object({ courseId: id });
