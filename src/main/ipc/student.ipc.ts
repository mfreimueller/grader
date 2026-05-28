import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { StudentService, CreateStudentInput, UpdateStudentInput } from '../../application/StudentService';
import { createStudentSchema, updateStudentSchema, studentIdParam } from './schemas';

export function registerStudentHandlers(service: StudentService): void {
  ipcMain.handle(IPC.STUDENT_LIST, async () => {
    return await service.list();
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

  ipcMain.handle(IPC.STUDENT_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await service.delete(id);
  });
}
