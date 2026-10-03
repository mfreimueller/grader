import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { SchoolYearRolloverService } from '../../application/SchoolYearRolloverService';
import { schoolYearRolloverSchema } from './schemas';

export function registerSchoolYearHandlers(service: SchoolYearRolloverService): void {
  ipcMain.handle(IPC.SCHOOLYEAR_PREVIEW, async () => {
    return await service.preview();
  });

  ipcMain.handle(IPC.SCHOOLYEAR_ROLLOVER, async (_event, data: unknown) => {
    const input = schoolYearRolloverSchema.parse(data);
    return await service.apply(input);
  });
}
