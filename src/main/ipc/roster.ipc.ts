import { ipcMain } from 'electron';
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
}
