import { isAbsolute } from 'node:path';
import { GradingType } from '../domain/grade/GradingType';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import type { CurrentResultDto, PrepareInput, PrepareJideInput } from '../shared/gradeflow-api';
import type { CheckedInput, CheckedJideInput, RunAssessment } from './GradeflowRunState';
import type { GradeflowDeps } from './GradeflowTypes';

const invalid = (message: string): Result<never> => Result.fail(new ValidationError(message));

type CommonInput = Pick<PrepareInput, 'courseId' | 'assessmentId' | 'skillId'>;
type Common = CheckedJideInput;

/** The course roster, the assessment and the skill of a request: what every kind of run needs. */
async function checkCommon(deps: GradeflowDeps, input: CommonInput): Promise<Result<Common>> {
  const { rosterService, sessionService, assessmentService, skillCatalog } = deps;
  const roster = await rosterService.rosterOf(input.courseId);
  if (!roster.ok) return Result.fail(roster.error);

  let found: RunAssessment | null = null;
  for (const session of await sessionService.listByCourse(input.courseId)) {
    const match = (await assessmentService.listBySession(session.id)).find((a) => a.id === input.assessmentId);
    if (!match) continue;
    if (match.isImpromptu) return invalid('Impromptu assessments cannot be graded with Gradeflow');
    const gradingType = match.category.gradingType as GradingType;
    if (gradingType === GradingType.NUMERIC && !(match.maxPoints !== null && match.maxPoints > 0)) {
      return invalid('A numeric assessment needs maxPoints');
    }
    found = { id: match.id, sessionId: session.id, gradingType, maxPoints: match.maxPoints };
    break;
  }
  if (!found) return Result.fail(new NotFoundError('Assessment', input.assessmentId));

  const skills = await skillCatalog.list();
  const skill = skills.skills.find((s) => s.id === input.skillId);
  const skillDir = skill ? await skillCatalog.dirOf(skill.id) : null;
  if (!skill || skillDir === null) return invalid('Unknown or invalid skill');

  return Result.ok({
    assessment: found,
    skill: { dir: skillDir, model: skill.model },
    students: roster.value.map((s) => ({
      id: s.id.value,
      firstName: s.name.firstName,
      lastName: s.name.lastName,
    })),
  });
}

/** Validates a prepare request against the course, the assessment, the skill and the files. */
export async function checkInput(deps: GradeflowDeps, input: PrepareInput): Promise<Result<CheckedInput>> {
  const { handinDirectory } = deps;
  const common = await checkCommon(deps, input);
  if (!common.ok) return Result.fail(common.error);

  const paths = [input.handinsDir, input.assignmentPath, ...(input.solutionPath === null ? [] : [input.solutionPath])];
  if (!paths.every((p) => isAbsolute(p))) return invalid('Paths must be absolute');
  const assignmentKind = await handinDirectory.kindOf(input.assignmentPath);
  if (assignmentKind === null) return invalid('The assignment does not exist');
  const solutionKind = input.solutionPath === null ? null : await handinDirectory.kindOf(input.solutionPath);
  if (input.solutionPath !== null && solutionKind === null) return invalid('The solution does not exist');

  return Result.ok({ assignmentKind, solutionKind, ...common.value });
}

/** Validates a J;DE prepare request: J;DE grades are symbols, so the column must be a symbol column. */
export async function checkJideInput(deps: GradeflowDeps, input: PrepareJideInput): Promise<Result<CheckedJideInput>> {
  const common = await checkCommon(deps, input);
  if (!common.ok) return Result.fail(common.error);
  if (common.value.assessment.gradingType !== GradingType.TERTIARY) {
    return invalid('J;DE-Bewertungen sind Symbole: Bitte eine Leistung mit Symbolen wählen.');
  }
  return common;
}

/** The saved results (and note texts) of the assessment, by student id. */
export async function currentResults(
  deps: Pick<GradeflowDeps, 'gradingService' | 'findingService'>,
  assessment: RunAssessment,
): Promise<Map<string, CurrentResultDto>> {
  const { gradingService, findingService } = deps;
  const notes = new Map(
    (await findingService.listNotesBySession(assessment.sessionId)).map((n) => [n.performanceId, n.text]),
  );
  const current = new Map<string, CurrentResultDto>();
  for (const p of await gradingService.getPerformancesByAssessment(assessment.id)) {
    current.set(p.studentId, { symbol: p.symbol, score: p.score, note: notes.get(p.id) ?? null });
  }
  return current;
}
