import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { SchoolClass } from '../domain/student/SchoolClass';
import { SchoolYear } from '../domain/student/SchoolYear';
import { suggestNextClassName } from '../domain/student/suggestNextClassName';
import { CourseRepository } from '../domain/grade/CourseRepository';
import { UnitOfWork } from '../domain/shared/UnitOfWork';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';

export interface RolloverClassDto {
  id: string;
  name: string;
  schoolYear: string;
  suggestedName: string | null;
}

export interface RolloverPreviewDto {
  targetSchoolYear: string;
  classes: RolloverClassDto[];
}

export type RolloverAction = { type: 'rename'; newName: string } | { type: 'drop' };

export interface RolloverInput {
  targetSchoolYear: string;
  archiveCourses: boolean;
  entries: { classId: string; action: RolloverAction }[];
}

export interface RolloverSummary {
  renamed: number;
  dropped: number;
  coursesArchived: number;
}

export class SchoolYearRolloverService {
  constructor(
    private readonly classRepo: SchoolClassRepository,
    private readonly courseRepo: CourseRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async preview(): Promise<RolloverPreviewDto> {
    const classes = (await this.classRepo.findAll()).sort(
      (a, b) => a.schoolYear.compareTo(b.schoolYear) || a.name.localeCompare(b.name),
    );
    const latest = classes.reduce<SchoolYear | null>(
      (max, c) => (max === null || c.schoolYear.compareTo(max) > 0 ? c.schoolYear : max),
      null,
    );
    return {
      targetSchoolYear: latest ? latest.next().toString() : '',
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        schoolYear: c.schoolYear.toString(),
        suggestedName: suggestNextClassName(c.name),
      })),
    };
  }

  async apply(input: RolloverInput): Promise<Result<RolloverSummary>> {
    const yearResult = SchoolYear.create(input.targetSchoolYear);
    if (!yearResult.ok) return Result.fail(yearResult.error);
    const targetYear = yearResult.value;

    const liveClasses = await this.classRepo.findAll();
    const checked = this.validate(input, liveClasses, targetYear);
    if (!checked.ok) return Result.fail(checked.error);

    const summary = await this.unitOfWork.run(async () => {
      let renamed = 0;
      let dropped = 0;
      for (const entry of input.entries) {
        if (entry.action.type === 'drop') {
          await this.classRepo.softDeleteWithDependents(entry.classId);
          dropped++;
        }
      }
      for (const entry of input.entries) {
        if (entry.action.type === 'rename') {
          await this.classRepo.save(new SchoolClass(entry.classId, entry.action.newName.trim(), targetYear));
          renamed++;
        }
      }

      let coursesArchived = 0;
      if (input.archiveCourses) {
        const archivedAt = new Date().toISOString();
        for (const course of await this.courseRepo.findAll()) {
          await this.courseRepo.softDelete(course.id, archivedAt);
          coursesArchived++;
        }
      }
      return { renamed, dropped, coursesArchived };
    });
    return Result.ok(summary);
  }

  private validate(input: RolloverInput, liveClasses: SchoolClass[], targetYear: SchoolYear): Result<void> {
    const byId = new Map(liveClasses.map((c) => [c.id, c]));
    const seen = new Set<string>();
    const planned = new Map<string, RolloverAction>();

    for (const entry of input.entries) {
      if (!byId.has(entry.classId)) return Result.fail(new NotFoundError('SchoolClass', entry.classId));
      if (seen.has(entry.classId)) {
        return Result.fail(new ValidationError('Eine Klasse darf nur einmal vorkommen.'));
      }
      seen.add(entry.classId);
      if (entry.action.type === 'rename' && entry.action.newName.trim() === '') {
        return Result.fail(new ValidationError('Der neue Klassenname darf nicht leer sein.'));
      }
      planned.set(entry.classId, entry.action);
    }

    const finalKeys = new Set<string>();
    for (const c of liveClasses) {
      const action = planned.get(c.id);
      if (action?.type === 'drop') continue;
      const key = action?.type === 'rename'
        ? `${action.newName.trim()}|${targetYear.toString()}`
        : `${c.name}|${c.schoolYear.toString()}`;
      if (finalKeys.has(key)) {
        const [name, year] = key.split('|');
        return Result.fail(new ValidationError(`Die Klasse ${name} (${year}) würde doppelt vorkommen.`));
      }
      finalKeys.add(key);
    }
    return Result.ok(undefined as void);
  }
}
