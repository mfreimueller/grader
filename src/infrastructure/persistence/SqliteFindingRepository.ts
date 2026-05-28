import type { Db } from './db';
import { FindingRepository } from '../../domain/grade/FindingRepository';
import { Finding } from '../../domain/grade/Finding';
import { Note } from '../../domain/grade/Note';
import { Document } from '../../domain/grade/Document';
import { RemoteDocument } from '../../domain/grade/RemoteDocument';

interface FindingRow {
  id: string;
  student_performance_id: string;
  type: string;
  file_path: string | null;
  text_content: string | null;
  url: string | null;
}

export class SqliteFindingRepository implements FindingRepository {
  constructor(private readonly db: Db) {}

  async findByPerformance(performanceId: string): Promise<Finding[]> {
    const rows = this.db
      .prepare(
        'SELECT id, student_performance_id, type, file_path, text_content, url FROM findings WHERE student_performance_id = ? AND deleted_at IS NULL',
      )
      .all(performanceId) as FindingRow[];

    return rows.map(r => this.rowToFinding(r));
  }

  async save(finding: Finding, performanceId: string): Promise<void> {
    let type: string;
    let filePath: string | null = null;
    let textContent: string | null = null;
    let url: string | null = null;

    if (finding instanceof Note) {
      type = 'note';
      textContent = finding.text;
    } else if (finding instanceof Document) {
      type = 'document';
      filePath = finding.filePath;
    } else if (finding instanceof RemoteDocument) {
      type = 'remote_document';
      url = finding.url;
    } else {
      throw new Error(`Unknown finding type: ${finding.constructor.name}`);
    }

    this.db
      .prepare(
        `INSERT OR REPLACE INTO findings
         (id, student_performance_id, type, file_path, text_content, url)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(finding.id, performanceId, type, filePath, textContent, url);
  }

  async delete(id: string): Promise<void> {
    this.db
      .prepare("UPDATE findings SET deleted_at = datetime('now') WHERE id = ?")
      .run(id);
  }

  private rowToFinding(row: FindingRow): Finding {
    switch (row.type) {
      case 'note':
        return new Note(row.id, row.text_content ?? '');
      case 'document':
        return new Document(row.id, row.file_path ?? '');
      case 'remote_document':
        return new RemoteDocument(row.id, row.url ?? '');
      default:
        throw new Error(`Unknown finding type: ${row.type}`);
    }
  }
}
