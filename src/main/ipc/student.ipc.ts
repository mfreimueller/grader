import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { StudentService, CreateStudentInput } from '../../application/StudentService';
import { createStudentSchema, updateStudentSchema, studentIdParam } from './schemas';

export function registerStudentHandlers(service: StudentService): void {
  ipcMain.handle(IPC.STUDENT_LIST, async () => {
    return await service.list();
  });

  ipcMain.handle(IPC.STUDENT_CREATE, async (_event, data: unknown) => {
    const input: CreateStudentInput = createStudentSchema.parse(data);
    return await service.create(input);
  });

  ipcMain.handle(IPC.STUDENT_UPDATE, async (_event, id: string, data: unknown) => {
    studentIdParam.parse({ id });
    const input = updateStudentSchema.parse(data);
    return await service.update(id, input as Parameters<StudentService['update']>[1]);
  });

  ipcMain.handle(IPC.STUDENT_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await service.delete(id);
  });
}
