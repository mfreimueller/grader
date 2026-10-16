import { AssessmentRepository } from '../domain/grade/AssessmentRepository';
import { ParticipationSymbol } from '../domain/grade/ParticipationSymbol';
import { PluginAssessmentRepository } from '../domain/plugin/PluginAssessmentRepository';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import {
  CreateImpromptuRequest,
  CreateImpromptuResult,
  PLUGIN_API_VERSION,
  PluginContext,
  PluginStudent,
  SessionTarget,
} from '../shared/plugin-api';
import { AssessmentCategoryService } from './AssessmentCategoryService';
import { AssessmentService } from './AssessmentService';
import { CourseRosterService } from './CourseRosterService';
import { CourseService } from './CourseService';
import { ImpromptuAssessmentService } from './ImpromptuAssessmentService';
import { SessionService } from './SessionService';
import { isCalendarDay, localCalendarDay } from './calendarDay';
import {
  NotInCourseError,
  PluginCaller,
  PluginPermissionDeniedError,
  requirePermission,
} from './PluginCaller';

const MITARBEIT_TITLE = 'Mitarbeit';
const MAX_TITLE_LENGTH = 200;

export interface PluginHostDeps {
  courseService: CourseService;
  rosterService: CourseRosterService;
  categoryService: AssessmentCategoryService;
  sessionService: SessionService;
  assessmentService: AssessmentService;
  impromptuService: ImpromptuAssessmentService;
  assessmentRepo: AssessmentRepository;
  pluginAssessmentRepo: PluginAssessmentRepository;
  now: () => Date;
}

/**
 * What a plugin may read from and write to Grader besides its own key-value store. It only orchestrates
 * the existing services; grading rules stay where they are. Everything is scoped to `caller.courseId`.
 */
export class PluginHostService {
  constructor(private readonly deps: PluginHostDeps) {}

  async context(caller: PluginCaller): Promise<Result<PluginContext>> {
    const allowed = requirePermission(caller, 'course:read');
    if (!allowed.ok) return Result.fail(allowed.error);

    const { courseService, rosterService, categoryService, sessionService } = this.deps;
    const course = await courseService.findById(caller.courseId);
    if (!course.ok) return Result.fail(course.error);
    const roster = await rosterService.rosterOf(caller.courseId);
    if (!roster.ok) return Result.fail(roster.error);

    const today = localCalendarDay(this.deps.now());
    const todaysSession = await sessionService.findOnDate(caller.courseId, today);
    const absent = new Set(todaysSession?.absentStudentIds ?? []);

    const toPluginStudent = (student: (typeof roster.value)[number]): PluginStudent => ({
      id: student.id.value,
      firstName: student.name.firstName,
      lastName: student.name.lastName,
      color: student.color?.value ?? null,
    });

    return Result.ok({
      apiVersion: PLUGIN_API_VERSION,
      plugin: { id: caller.manifest.id.value, version: caller.manifest.version },
      course: { id: course.value.id, title: course.value.title },
      schoolClass: { id: course.value.schoolClass.id, name: course.value.schoolClass.name },
      schoolYear: course.value.schoolClass.schoolYear,
      today,
      students: roster.value.filter((student) => !absent.has(student.id.value)).map(toPluginStudent),
      courseStudents: roster.value.map(toPluginStudent),
      categories: (await categoryService.listByCourse(caller.courseId)).map((category) => ({
        id: category.id,
        title: category.title,
        gradingType: category.gradingType,
        isMitarbeit: category.title === MITARBEIT_TITLE,
        isHidden: category.isHidden,
      })),
      sessions: (await sessionService.listByCourse(caller.courseId)).map((session) => ({
        id: session.id,
        date: session.date.slice(0, 10),
        notes: session.notes,
      })),
    });
  }

  async createImpromptu(
    caller: PluginCaller,
    request: CreateImpromptuRequest,
  ): Promise<Result<CreateImpromptuResult>> {
    const allowed = requirePermission(caller, 'assessment:impromptu');
    if (!allowed.ok) return Result.fail(allowed.error);
    const invalid = validateValues(request);
    if (invalid) return Result.fail(invalid);

    // Everything is checked before a session is created, so a refused request leaves no trace behind.
    const roster = await this.deps.rosterService.rosterOf(caller.courseId);
    if (!roster.ok) return Result.fail(roster.error);
    if (!roster.value.some((student) => student.id.value === request.studentId)) {
      return Result.fail(new NotInCourseError('Student', request.studentId));
    }
    const categories = await this.deps.categoryService.listByCourse(caller.courseId);
    const category = categories.find((c) => c.id === request.categoryId);
    if (!category) return Result.fail(new NotInCourseError('Category', request.categoryId));

    const sessionId = await this.resolveSession(caller, request.session ?? { kind: 'today' });
    if (!sessionId.ok) return Result.fail(sessionId.error);

    const created = await this.deps.impromptuService.create({
      courseId: caller.courseId,
      studentId: request.studentId,
      categoryId: request.categoryId,
      sessionId: sessionId.value,
      title: request.title?.trim() ?? category.title,
      ...(request.symbol !== undefined ? { symbol: request.symbol } : {}),
      ...(request.score !== undefined ? { score: request.score } : {}),
      ...(request.maxPoints !== undefined ? { maxPoints: request.maxPoints } : {}),
    });
    if (!created.ok) return Result.fail(created.error);

    try {
      await this.deps.pluginAssessmentRepo.record(caller.manifest.id, created.value.assessmentId, this.deps.now());
    } catch (error) {
      // An assessment the plugin could never delete again is worse than none.
      await this.deps.assessmentService.delete(created.value.assessmentId);
      throw error;
    }

    return Result.ok({
      assessmentId: created.value.assessmentId,
      performanceId: created.value.performance.id,
      sessionId: sessionId.value,
    });
  }

  /** Only assessments this plugin created in this course can be deleted. */
  async deleteImpromptu(caller: PluginCaller, assessmentId: string): Promise<Result<void>> {
    const allowed = requirePermission(caller, 'assessment:impromptu');
    if (!allowed.ok) return Result.fail(allowed.error);

    const { pluginAssessmentRepo, assessmentRepo, assessmentService } = this.deps;
    if (!(await pluginAssessmentRepo.isCreatedBy(caller.manifest.id, assessmentId))) {
      return Result.fail(new PluginPermissionDeniedError('Assessment was not created by this plugin'));
    }
    const assessment = await assessmentRepo.findById(assessmentId);
    if (!assessment) {
      // The teacher deleted it; forget the leftover record.
      await pluginAssessmentRepo.remove(assessmentId);
      return Result.fail(new NotFoundError('Assessment', assessmentId));
    }
    if (assessment.course.id !== caller.courseId) {
      return Result.fail(new NotInCourseError('Assessment', assessmentId));
    }

    const deleted = await assessmentService.delete(assessmentId);
    if (!deleted.ok) return Result.fail(deleted.error);
    await pluginAssessmentRepo.remove(assessmentId);
    return Result.ok(undefined as void);
  }

  private async resolveSession(caller: PluginCaller, target: SessionTarget): Promise<Result<string>> {
    const { sessionService, now } = this.deps;

    if (target.kind === 'session') {
      const sessions = await sessionService.listByCourse(caller.courseId);
      if (!sessions.some((s) => s.id === target.sessionId)) {
        return Result.fail(new NotInCourseError('Session', target.sessionId));
      }
      return Result.ok(target.sessionId);
    }

    const today = localCalendarDay(now());
    const date = target.kind === 'today' ? today : target.date;
    if (!isCalendarDay(date)) {
      return Result.fail(new ValidationError(`Date must be a calendar day as YYYY-MM-DD, got "${date}"`));
    }
    if (date > today) return Result.fail(new ValidationError(`Date ${date} is in the future`));

    const session = await sessionService.findOrCreateOnDate(caller.courseId, date);
    if (!session.ok) return Result.fail(session.error);
    return Result.ok(session.value.id);
  }
}

function validateValues(request: CreateImpromptuRequest): ValidationError | null {
  if (request.title !== undefined) {
    const length = request.title.trim().length;
    if (length === 0 || length > MAX_TITLE_LENGTH) {
      return new ValidationError(`Title must have 1-${MAX_TITLE_LENGTH} characters`);
    }
  }
  if (request.symbol !== undefined) {
    const symbol = ParticipationSymbol.create(request.symbol);
    if (!symbol.ok) return symbol.error;
  }

  const { score, maxPoints } = request;
  if (score === undefined && maxPoints === undefined) return null;
  if (score === undefined || maxPoints === undefined) {
    return new ValidationError('score and maxPoints must be given together');
  }
  if (!Number.isInteger(maxPoints) || maxPoints <= 0) {
    return new ValidationError('maxPoints must be a positive whole number');
  }
  if (!Number.isInteger(score) || score < 0 || score > maxPoints) {
    return new ValidationError('score must be a whole number between 0 and maxPoints');
  }
  return null;
}
