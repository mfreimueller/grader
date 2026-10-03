import { StudentRepository } from '../domain/student/StudentRepository';
import { SchoolClassRepository } from '../domain/student/SchoolClassRepository';
import { StudentId } from '../domain/student/StudentId';
import { Student } from '../domain/student/Student';
import { Color } from '../domain/student/Color';
import { Name } from '../domain/student/Name';
import { AdditionalInformation } from '../domain/student/AdditionalInformation';
import { Result } from '../domain/shared/Result';
import { NotFoundError } from '../shared/errors';
import { generateId } from '../domain/shared/IdGenerator';

export interface SchoolClassRefDto {
  id: string;
  name: string;
  schoolYear: string;
}

export interface AdditionalInfoEntry {
  key: string;
  value: string;
}

export interface StudentDto {
  id: string;
  firstName: string;
  lastName: string;
  schoolClass: SchoolClassRefDto;
  additionalInfo: AdditionalInfoEntry[];
  color: string | null;
}

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  schoolClassId: string;
  additionalInfo?: AdditionalInfoEntry[];
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  schoolClassId?: string;
  additionalInfo?: AdditionalInfoEntry[];
}

export class StudentService {
  constructor(
    private readonly studentRepo: StudentRepository,
    private readonly schoolClassRepo: SchoolClassRepository,
  ) {}

  async list(schoolClassId?: string): Promise<StudentDto[]> {
    const students = await this.studentRepo.findAll(schoolClassId);
    return students.map(toDto);
  }

  async findById(id: string): Promise<Result<StudentDto>> {
    const sidResult = StudentId.create(id);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const student = await this.studentRepo.findById(sidResult.value);
    if (!student) return Result.fail(new NotFoundError('Student', id));
    return Result.ok(toDto(student));
  }

  async create(input: CreateStudentInput): Promise<Result<StudentDto>> {
    const nameResult = Name.create(input.firstName, input.lastName);
    if (!nameResult.ok) return Result.fail(nameResult.error);

    const schoolClass = await this.schoolClassRepo.findById(input.schoolClassId);
    if (!schoolClass) return Result.fail(new NotFoundError('SchoolClass', input.schoolClassId));

    const sidResult = StudentId.create(generateId());
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const student = Student.create(sidResult.value, nameResult.value, schoolClass);

    if (input.additionalInfo) {
      for (const entry of input.additionalInfo) {
        student.addInformation(new AdditionalInformation(entry.key, entry.value));
      }
    }

    await this.studentRepo.save(student);
    return Result.ok(toDto(student));
  }

  async update(id: string, input: UpdateStudentInput): Promise<Result<StudentDto>> {
    const sidResult = StudentId.create(id);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const existing = await this.studentRepo.findById(sidResult.value);
    if (!existing) return Result.fail(new NotFoundError('Student', id));

    const firstName = input.firstName ?? existing.name.firstName;
    const lastName = input.lastName ?? existing.name.lastName;
    const nameResult = Name.create(firstName, lastName);
    if (!nameResult.ok) return Result.fail(nameResult.error);

    let schoolClass = existing.schoolClass;
    if (input.schoolClassId) {
      const newClass = await this.schoolClassRepo.findById(input.schoolClassId);
      if (!newClass) return Result.fail(new NotFoundError('SchoolClass', input.schoolClassId));
      schoolClass = newClass;
    }

    const updated = Student.create(sidResult.value, nameResult.value, schoolClass, null, existing.color);

    if (input.additionalInfo) {
      for (const entry of input.additionalInfo) {
        updated.addInformation(new AdditionalInformation(entry.key, entry.value));
      }
    }

    await this.studentRepo.save(updated);
    return Result.ok(toDto(updated));
  }

  async setColor(id: string, rawColor: string | null): Promise<Result<StudentDto>> {
    const sidResult = StudentId.create(id);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const existing = await this.studentRepo.findById(sidResult.value);
    if (!existing) return Result.fail(new NotFoundError('Student', id));

    let color: Color | null = null;
    if (rawColor !== null) {
      const colorResult = Color.create(rawColor);
      if (!colorResult.ok) return Result.fail(colorResult.error);
      color = colorResult.value;
    }

    existing.changeColor(color);
    await this.studentRepo.save(existing);
    return Result.ok(toDto(existing));
  }

  async delete(id: string): Promise<Result<void>> {
    const sidResult = StudentId.create(id);
    if (!sidResult.ok) return Result.fail(sidResult.error);

    const existing = await this.studentRepo.findById(sidResult.value);
    if (!existing) return Result.fail(new NotFoundError('Student', id));

    await this.studentRepo.delete(sidResult.value);
    return Result.ok(undefined as void);
  }
}

function toDto(s: Student): StudentDto {
  return {
    id: s.id.value,
    firstName: s.name.firstName,
    lastName: s.name.lastName,
    schoolClass: {
      id: s.schoolClass.id,
      name: s.schoolClass.name,
      schoolYear: s.schoolClass.schoolYear.toString(),
    },
    additionalInfo: s.additionalInformation.map((info) => ({
      key: info.key,
      value: info.value,
    })),
    color: s.color?.value ?? null,
  };
}
