import { ipcMain, dialog, app } from 'electron';
import { writeFileSync } from 'fs';
import path from 'path';
import { IPC } from '../../shared/ipc-channels';
import { ReportService } from '../../application/ReportService';
import { reportGenerateSchema, reportGenerateSingleSchema } from './schemas';

function getFormatConfig(format: string): { ext: string; name: string } {
  return format === 'adoc'
    ? { ext: 'adoc', name: 'AsciiDoc' }
    : { ext: 'pdf', name: 'PDF' };
}

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

  ipcMain.handle(IPC.REPORT_GENERATE_SINGLE, async (_event, courseId: string, studentId: string, mode: unknown, format: unknown) => {
    const { courseId: cid, studentId: sid, mode: m, format: fmt } = reportGenerateSingleSchema.parse({ courseId, studentId, mode, format });

    const result = await service.generateSingle(cid, sid, m, fmt);
    if (!result.ok) return result;

    const fc = getFormatConfig(fmt);
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('documents'), `Bericht_${sid}_${cid}_${m}.${fc.ext}`),
      filters: [{ name: fc.name, extensions: [fc.ext] }],
    });

    if (canceled || !filePath) {
      return { ok: false, error: { name: 'CanceledError', message: 'Speichern abgebrochen' } };
    }

    writeFileSync(filePath, result.value);
    return { ok: true, value: { filePath } };
  });
}
