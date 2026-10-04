import { z } from 'zod';

export const studentIdParam = z.object({ id: z.string().min(1) });

const additionalInfoEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const createStudentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  schoolClassId: z.string().min(1),
  additionalInfo: z.array(additionalInfoEntrySchema).optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  schoolClassId: z.string().min(1).optional(),
  additionalInfo: z.array(additionalInfoEntrySchema).optional(),
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
  gradeCompositions: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        weight: z.number().int().min(1).max(99),
        subWeightType: z.enum(['NONE', 'CHRONOLOGICAL']).optional(),
      }),
    )
    .optional(),
});

export const createCategorySchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  gradingType: z.enum(['NUMERIC', 'TERTIARY']),
  displayAsGrade: z.boolean(),
  isHidden: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  title: z.string().min(1).optional(),
  gradingType: z.enum(['NUMERIC', 'TERTIARY']).optional(),
  displayAsGrade: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const createSessionSchema = z.object({
  courseId: z.string().min(1),
  date: z.string().min(1),
  notes: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
});

export const updateSessionSchema = z.object({
  date: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export const setSessionAbsenceSchema = z.object({
  studentId: z.string().min(1),
  absent: z.boolean(),
});

export const SESSION_STUDENT_NOTE_MAX_LENGTH = 2000;

export const setSessionStudentNoteSchema = z.object({
  studentId: z.string().min(1),
  text: z.string().max(SESSION_STUDENT_NOTE_MAX_LENGTH),
});

export const createAssessmentSchema = z.object({
  sessionId: z.string().min(1),
  title: z.string().min(1),
  categoryId: z.string().min(1),
  courseId: z.string().min(1),
  maxPoints: z.number().int().positive().optional(),
});

export const recordPerformanceSchema = z.object({
  studentId: z.string().min(1),
  assessmentId: z.string().min(1),
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
  categoryId: z.string().min(1),
  sessionId: z.string().min(1),
  title: z.string().optional(),
  score: z.number().int().min(0).optional(),
  symbol: z.string().optional(),
  maxPoints: z.number().int().positive().optional(),
});

export const setNoteSchema = z.object({
  performanceId: z.string().min(1),
  text: z.string().max(2000),
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

export const reportGenerateSingleSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  mode: z.enum(['full', 'reduced']),
  format: z.enum(['pdf', 'adoc']),
});

export const schoolYearRolloverSchema = z.object({
  targetSchoolYear: z.string().min(1),
  archiveCourses: z.boolean(),
  entries: z.array(
    z.object({
      classId: z.string().min(1),
      action: z.discriminatedUnion('type', [
        z.object({ type: z.literal('rename'), newName: z.string() }),
        z.object({ type: z.literal('drop') }),
      ]),
    }),
  ),
});

export const courseIdParam = z.object({ courseId: z.string().min(1) });

export const setColorSchema = z.object({
  id: z.string().min(1),
  color: z.string().nullable(),
});

export const pickRandomSchema = z.object({
  courseId: z.string().min(1),
  fair: z.boolean(),
});

export const pickStudentSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
});

export const setPickCountSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  count: z.number(),
});

export const recordMitarbeitPickSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  symbol: z.string().min(1),
  date: z.string().min(1),
  categoryId: z.string().min(1).optional(),
});

export const setRosterIncludedSchema = z.object({
  courseId: z.string().min(1),
  studentId: z.string().min(1),
  included: z.boolean(),
});

export const setRosterAllSchema = z.object({
  courseId: z.string().min(1),
  included: z.boolean(),
});
