import { PluginId } from './PluginId';

/** Remembers which assessments a plugin created, so it may only delete those. */
export interface PluginAssessmentRepository {
  record(pluginId: PluginId, assessmentId: string, createdAt: Date): Promise<void>;
  isCreatedBy(pluginId: PluginId, assessmentId: string): Promise<boolean>;
  remove(assessmentId: string): Promise<void>;
}
