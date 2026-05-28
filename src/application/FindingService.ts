import { FindingRepository } from '../domain/grade/FindingRepository';
import { Note } from '../domain/grade/Note';
import { Document } from '../domain/grade/Document';
import { RemoteDocument } from '../domain/grade/RemoteDocument';
import { Finding } from '../domain/grade/Finding';
import { Result } from '../domain/shared/Result';
import { generateId } from '../domain/shared/IdGenerator';

export interface FindingDto {
  id: string;
  performanceId: string;
  type: string;
  text: string | null;
  filePath: string | null;
  url: string | null;
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
  constructor(private readonly findingRepo: FindingRepository) {}

  async getFindings(performanceId: string): Promise<FindingDto[]> {
    const findings = await this.findingRepo.findByPerformance(performanceId);
    return findings.map(f => toDto(f, performanceId));
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
