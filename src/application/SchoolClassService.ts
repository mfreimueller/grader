import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { SchoolClass } from '../domain/student/SchoolClass';
import { SchoolYear } from '../domain/student/SchoolYear';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';

export interface SchoolClassDto {
  id: string;
  name: string;
  schoolYear: string;
}

export interface CreateSchoolClassInput {
  name: string;
  schoolYear: string;
}

export class SchoolClassService {
  constructor(private readonly schoolClassRepo: SchoolClassRepository) {}

  async list(): Promise<SchoolClassDto[]> {
    const classes = await this.schoolClassRepo.findAll();
    return classes.map(toDto);
  }

  async findById(id: string): Promise<Result<SchoolClassDto>> {
    const sc = await this.schoolClassRepo.findById(id);
    if (!sc) return Result.fail(new NotFoundError('SchoolClass', id));
    return Result.ok(toDto(sc));
  }

  async create(input: CreateSchoolClassInput): Promise<Result<SchoolClassDto>> {
    const yearResult = SchoolYear.create(input.schoolYear);
    if (!yearResult.ok) return Result.fail(yearResult.error);

    const schoolClass = new SchoolClass(generateId(), input.name, yearResult.value);
    await this.schoolClassRepo.save(schoolClass);
    return Result.ok(toDto(schoolClass));
  }

  async update(id: string, input: { name?: string; schoolYear?: string }): Promise<Result<SchoolClassDto>> {
    const existing = await this.schoolClassRepo.findById(id);
    if (!existing) return Result.fail(new NotFoundError('SchoolClass', id));

    const name = input.name ?? existing.name;
    const yearResult = input.schoolYear
      ? SchoolYear.create(input.schoolYear)
      : Result.ok(existing.schoolYear);
    if (!yearResult.ok) return Result.fail(yearResult.error);

    const updated = new SchoolClass(id, name, yearResult.value);
    await this.schoolClassRepo.save(updated);
    return Result.ok(toDto(updated));
  }

  async delete(id: string): Promise<Result<void>> {
    const existing = await this.schoolClassRepo.findById(id);
    if (!existing) return Result.fail(new NotFoundError('SchoolClass', id));
    await this.schoolClassRepo.delete(id);
    return Result.ok(undefined as void);
  }
}

function toDto(sc: SchoolClass): SchoolClassDto {
  return { id: sc.id, name: sc.name, schoolYear: sc.schoolYear.toString() };
}
