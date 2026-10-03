import { ipcMain, dialog } from 'electron';
import { readFileSync } from 'node:fs';
import { IPC } from '../../shared/ipc-channels';
import { StudentService, CreateStudentInput, UpdateStudentInput } from '../../application/StudentService';
import { CsvImportService } from '../../application/CsvImportService';
import { createStudentSchema, updateStudentSchema, studentIdParam, setColorSchema } from './schemas';

export function registerStudentHandlers(service: StudentService, csvImportService: CsvImportService): void {
  ipcMain.handle(IPC.STUDENT_LIST, async (_event, schoolClassId?: string) => {
    return await service.list(schoolClassId);
  });

  ipcMain.handle(IPC.STUDENT_GET, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await service.findById(id);
  });

  ipcMain.handle(IPC.STUDENT_CREATE, async (_event, data: unknown) => {
    const input = createStudentSchema.parse(data) as CreateStudentInput;
    return await service.create(input);
  });

  ipcMain.handle(IPC.STUDENT_UPDATE, async (_event, id: string, data: unknown) => {
    studentIdParam.parse({ id });
    const input = updateStudentSchema.parse(data) as UpdateStudentInput;
    return await service.update(id, input);
  });

  ipcMain.handle(IPC.STUDENT_SET_COLOR, async (_event, data: unknown) => {
    const { id, color } = setColorSchema.parse(data);
    return await service.setColor(id, color);
  });

  ipcMain.handle(IPC.STUDENT_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await service.delete(id);
  });

  ipcMain.handle(IPC.STUDENT_IMPORT_CSV, async (_event, hasHeader: boolean) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV-Dateien', extensions: ['csv'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, value: { classesCreated: 0, studentsCreated: 0, studentsUpdated: 0, warnings: [] } };
    }

    const filePath = result.filePaths[0]!;
    const content = readFileSync(filePath, 'utf-8');
    const importResult = await csvImportService.importCsv(content, hasHeader);
    return { ok: true, value: importResult };
  });
}
