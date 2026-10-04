import { FindingRepository } from '../domain/grade/FindingRepository';
import { Note } from '../domain/grade/Note';
import { Document } from '../domain/grade/Document';
import { RemoteDocument } from '../domain/grade/RemoteDocument';
import { Finding } from '../domain/grade/Finding';
import { Result } from '../domain/shared/Result';
import { UnitOfWork } from '../domain/shared/UnitOfWork';
import { generateId } from '../domain/shared/IdGenerator';
import { NotFoundError } from '../shared/errors';

export interface FindingDto {
  id: string;
  performanceId: string;
  type: string;
  text: string | null;
  filePath: string | null;
  url: string | null;
}

export interface SessionNoteDto {
  performanceId: string;
  text: string;
}

export interface AddNoteInput {
  performanceId: string;
  text: string;
}

export interface AddDocumentInput {
  performanceId: string;
  filePath: string;
}

export interface AddRemoteDocumentInput {
  performanceId: string;
  url: string;
}

export class FindingService {
  constructor(
    private readonly findingRepo: FindingRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async getFindings(performanceId: string): Promise<FindingDto[]> {
    const findings = await this.findingRepo.findByPerformance(performanceId);
    return findings.map(f => toDto(f, performanceId));
  }

  /** One entry per performance that has notes; several notes of a performance are joined by a line break. */
  async listNotesBySession(sessionId: string): Promise<SessionNoteDto[]> {
    const texts = new Map<string, string[]>();
    for (const note of await this.findingRepo.findNotesBySession(sessionId)) {
      texts.set(note.performanceId, [...(texts.get(note.performanceId) ?? []), note.text]);
    }
    return [...texts].map(([performanceId, parts]) => ({ performanceId, text: parts.join('\n') }));
  }

  /**
   * Makes `text` the one note of the performance, replacing all existing notes (documents and links stay).
   * Blank text only removes the notes and yields null. Removal and creation happen in one transaction.
   */
  async setNote(performanceId: string, text: string): Promise<Result<FindingDto | null>> {
    if (!(await this.findingRepo.performanceExists(performanceId))) {
      return Result.fail(new NotFoundError('Performance', performanceId));
    }
    const trimmed = text.trim();
    const saved = await this.unitOfWork.run(async () => {
      for (const finding of await this.findingRepo.findByPerformance(performanceId)) {
        if (finding instanceof Note) await this.findingRepo.delete(finding.id);
      }
      if (trimmed === '') return null;
      const note = new Note(generateId(), trimmed);
      await this.findingRepo.save(note, performanceId);
      return toDto(note, performanceId);
    });
    return Result.ok(saved);
  }

  async addNote(input: AddNoteInput): Promise<Result<FindingDto>> {
    const note = new Note(generateId(), input.text);
    await this.findingRepo.save(note, input.performanceId);
    return Result.ok(toDto(note, input.performanceId));
  }

  async addDocument(input: AddDocumentInput): Promise<Result<FindingDto>> {
    const doc = new Document(generateId(), input.filePath);
    await this.findingRepo.save(doc, input.performanceId);
    return Result.ok(toDto(doc, input.performanceId));
  }

  async addRemoteDocument(input: AddRemoteDocumentInput): Promise<Result<FindingDto>> {
    const remote = new RemoteDocument(generateId(), input.url);
    await this.findingRepo.save(remote, input.performanceId);
    return Result.ok(toDto(remote, input.performanceId));
  }

  async remove(id: string): Promise<Result<void>> {
    await this.findingRepo.delete(id);
    return Result.ok(undefined as void);
  }
}

function toDto(f: Finding, performanceId: string): FindingDto {
  return {
    id: f.id,
    performanceId,
    type: f instanceof Note ? 'note' : f instanceof Document ? 'document' : 'remote_document',
    text: f instanceof Note ? f.text : null,
    filePath: f instanceof Document ? f.filePath : null,
    url: f instanceof RemoteDocument ? f.url : null,
  };
}
