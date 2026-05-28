import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { ReportService } from '../../application/ReportService';
import { reportGenerateSchema } from './schemas';

export function registerReportHandlers(service: ReportService): void {
  ipcMain.handle(IPC.REPORT_GENERATE, async (_event, courseId: string, mode: unknown) => {
    const { courseId: cid, mode: m } = reportGenerateSchema.parse({ courseId, mode });
    return await service.generate(cid, m);
  });
}
