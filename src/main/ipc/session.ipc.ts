import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { SessionService } from '../../application/SessionService';
import { createSessionSchema, updateSessionSchema, setSessionAbsenceSchema, studentIdParam } from './schemas';

export function registerSessionHandlers(service: SessionService): void {
  ipcMain.handle(IPC.SESSION_LIST_BY_COURSE, async (_event, courseId: string) => {
    studentIdParam.parse({ id: courseId });
    return await service.listByCourse(courseId);
  });

  ipcMain.handle(IPC.SESSION_CREATE, async (_event, data: unknown) => {
    const input = createSessionSchema.parse(data);
    return await service.create(input as Parameters<SessionService['create']>[0]);
  });

  ipcMain.handle(IPC.SESSION_DELETE, async (_event, id: string) => {
    studentIdParam.parse({ id });
    return await service.delete(id);
  });

  ipcMain.handle(IPC.SESSION_SET_ABSENCE, async (_event, id: string, data: unknown) => {
    studentIdParam.parse({ id });
    const input = setSessionAbsenceSchema.parse(data);
    return await service.setAbsence(id, input.studentId, input.absent);
  });

  ipcMain.handle(IPC.SESSION_UPDATE, async (_event, id: string, data: unknown) => {
    studentIdParam.parse({ id });
    const input = updateSessionSchema.parse(data) as { date?: string; notes?: string };
    return await service.update(id, input);
  });
}
