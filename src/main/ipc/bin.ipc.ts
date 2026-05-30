import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { BinService } from '../../application/BinService';
import { z } from 'zod';

const restoreSchema = z.object({
  type: z.enum(['student', 'class']),
  id: z.string().min(1),
});

const hardDeleteSchema = z.object({
  type: z.enum(['student', 'class']),
  id: z.string().min(1),
});

export function registerBinHandlers(service: BinService): void {
  ipcMain.handle(IPC.BIN_LIST, async () => {
    return await service.listAll();
  });

  ipcMain.handle(IPC.BIN_RESTORE, async (_event, data: unknown) => {
    const { type, id } = restoreSchema.parse(data);
    if (type === 'student') {
      await service.restoreStudent(id);
    } else {
      await service.restoreClass(id);
    }
  });

  ipcMain.handle(IPC.BIN_HARD_DELETE, async (_event, data: unknown) => {
    const { type, id } = hardDeleteSchema.parse(data);
    if (type === 'student') {
      await service.hardDeleteStudent(id);
    } else {
      await service.hardDeleteClass(id);
    }
  });

  ipcMain.handle(IPC.BIN_EMPTY, async () => {
    await service.emptyBin();
  });
}
