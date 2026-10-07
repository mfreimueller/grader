import { app, dialog, ipcMain } from 'electron';
import { writeFileSync } from 'fs';
import path from 'path';
import { IPC } from '../../shared/ipc-channels';
import { CourseRosterService } from '../../application/CourseRosterService';
import { courseIdParam, setRosterIncludedSchema, setRosterAllSchema } from './schemas';

export function registerRosterHandlers(service: CourseRosterService): void {
  ipcMain.handle(IPC.ROSTER_LIST, async (_event, courseId: string) => {
    courseIdParam.parse({ courseId });
    return await service.list(courseId);
  });

  ipcMain.handle(IPC.ROSTER_MEMBERS, async (_event, courseId: string) => {
    courseIdParam.parse({ courseId });
    return await service.members(courseId);
  });

  ipcMain.handle(IPC.ROSTER_SET_INCLUDED, async (_event, data: unknown) => {
    const { courseId, studentId, included } = setRosterIncludedSchema.parse(data);
    return await service.setIncluded(courseId, studentId, included);
  });

  ipcMain.handle(IPC.ROSTER_SET_ALL, async (_event, data: unknown) => {
    const { courseId, included } = setRosterAllSchema.parse(data);
    return await service.setAll(courseId, included);
  });

  // null means the save dialog was cancelled
  ipcMain.handle(IPC.ROSTER_EXPORT_CSV, async (_event, courseId: string) => {
    courseIdParam.parse({ courseId });
    const csv = await service.exportCsv(courseId);
    if (!csv.ok) return csv;

    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('documents'), 'Schueler.csv'),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (canceled || !filePath) return null;

    writeFileSync(filePath, csv.value, 'utf-8');
    return { ok: true, value: { filePath } };
  });
}
