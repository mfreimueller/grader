import { z } from 'zod';

export const studentIdParam = z.object({ id: z.string().min(1) });

export const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  schoolClassId: z.string().min(1),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  schoolClassId: z.string().min(1).optional(),
});

export const createClassSchema = z.object({
  name: z.string().min(1),
  schoolYear: z.string().min(1),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  schoolYear: z.string().min(1).optional(),
});

export const courseListSchema = z.object({
  schoolYear: z.string().optional(),
});

export const createCourseSchema = z.object({
  title: z.string().min(1),
  schoolClassId: z.string().min(1),
});

export const courseCloneSchema = z.object({
  id: z.string().min(1),
  targetClassId: z.string().min(1),
});

export const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
});

export const createCategorySchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  gradingType: z.enum(['NUMERIC', 'TERTIARY']),
  displayAsGrade: z.boolean(),
});

export const updateCategorySchema = z.object({
  title: z.string().min(1).optional(),
  gradingType: z.enum(['NUMERIC', 'TERTIARY']).optional(),
  displayAsGrade: z.boolean().optional(),
});

export const createSessionSchema = z.object({
  courseId: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
});

export const createAssessmentSchema = z.object({
  sessionId: z.string().optional(),
  title: z.string().min(1),
  date: z.string().min(1),
  categoryId: z.string().min(1),
  courseId: z.string().min(1),
  maxPoints: z.number().int().positive().optional(),
});

export const recordPerformanceSchema = z.object({
  studentId: z.string().min(1),
  assessmentId: z.string().min(1),
  date: z.string().optional(),
  score: z.number().int().min(0).optional(),
  symbol: z.string().optional(),
});

export const saveGradeSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  score: z.number().int().min(1).max(5),
});

export const impromptuSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  date: z.string().min(1),
  categoryId: z.string().min(1),
  title: z.string().optional(),
  score: z.number().int().min(0).optional(),
  symbol: z.string().optional(),
  maxPoints: z.number().int().positive().optional(),
});

export const addNoteSchema = z.object({
  performanceId: z.string().min(1),
  text: z.string().min(1),
});

export const addDocumentSchema = z.object({
  performanceId: z.string().min(1),
  filePath: z.string().min(1),
});

export const addRemoteDocumentSchema = z.object({
  performanceId: z.string().min(1),
  url: z.string().min(1),
});

export const reportGenerateSchema = z.object({
  courseId: z.string().min(1),
  mode: z.enum(['full', 'reduced']),
});
