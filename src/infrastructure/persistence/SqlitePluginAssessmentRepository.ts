import type { Db } from './db';
import type { PluginAssessmentRepository } from '../../domain/plugin/PluginAssessmentRepository';
import type { PluginId } from '../../domain/plugin/PluginId';

export class SqlitePluginAssessmentRepository implements PluginAssessmentRepository {
  constructor(private readonly db: Db) {}

  async record(pluginId: PluginId, assessmentId: string, createdAt: Date): Promise<void> {
    this.db
      .prepare('INSERT INTO plugin_assessments (assessment_id, plugin_id, created_at) VALUES (?, ?, ?)')
      .run(assessmentId, pluginId.value, createdAt.toISOString());
  }

  async isCreatedBy(pluginId: PluginId, assessmentId: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT 1 AS found FROM plugin_assessments WHERE assessment_id = ? AND plugin_id = ?')
      .get(assessmentId, pluginId.value);
    return row !== undefined;
  }

  async remove(assessmentId: string): Promise<void> {
    this.db.prepare('DELETE FROM plugin_assessments WHERE assessment_id = ?').run(assessmentId);
  }
}
