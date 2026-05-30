import { ipcMain, dialog, app } from 'electron';
import { writeFileSync } from 'fs';
import path from 'path';
import { IPC } from '../../shared/ipc-channels';
import { ReportService } from '../../application/ReportService';
import { reportGenerateSchema } from './schemas';

export function registerReportHandlers(service: ReportService): void {
  ipcMain.handle(IPC.REPORT_GENERATE, async (_event, courseId: string, mode: unknown) => {
    const { courseId: cid, mode: m } = reportGenerateSchema.parse({ courseId, mode });

    const result = await service.generate(cid, m);
    if (!result.ok) return result;

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('documents'), `Bericht_${cid}_${m}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { ok: false, error: { name: 'CanceledError', message: 'Speichern abgebrochen' } };
    }

    writeFileSync(filePath, result.value);
    return { ok: true, value: { filePath } };
  });
}
