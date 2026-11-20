/** Data shapes of the J;DE connection (settings, links), shared by the application layer, the IPC layer and the renderer. */

export interface JideSettingsDto {
  baseUrl: string;
  /** Whether an API key is stored. The key itself never leaves the main process. */
  hasKey: boolean;
  /** False when the system offers no secure storage; the key cannot be saved then. */
  encryptionAvailable: boolean;
}

export interface JideSettingsInput {
  baseUrl: string;
  /** Empty keeps the stored key. */
  apiKey: string;
}

export interface JideTestResultDto {
  courseCount: number;
}

export interface JideCourseDto {
  id: string;
  subject: string;
  className: string;
}

export interface JideStudentLinkDto {
  studentId: string;
  firstName: string;
  lastName: string;
  /** The confirmed link, if any. */
  jideStudentId: string | null;
  /** A name-based proposal for a student without a confirmed link. */
  suggestedJideStudentId: string | null;
}

export interface JideLinkOverviewDto {
  jideCourses: JideCourseDto[];
  /** The J;DE course the overview shows: the stored link, else the proposal, else null. */
  jideCourseId: string | null;
  /** True when `jideCourseId` is the stored link, false when it is only a proposal. */
  courseConfirmed: boolean;
  jideStudents: { id: string; name: string }[];
  students: JideStudentLinkDto[];
}

export interface JideSaveLinksInput {
  courseId: string;
  jideCourseId: string | null;
  links: { studentId: string; jideStudentId: string | null }[];
}

export interface JideExerciseDto {
  id: string;
  slug: string;
  title: string;
}

export interface JideErrorDto {
  name: string;
  message: string;
}

export type JideResultDto<T> = { ok: true; value: T } | { ok: false; error: JideErrorDto };
