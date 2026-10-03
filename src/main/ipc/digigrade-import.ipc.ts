import { ipcMain, dialog, BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import { IPC } from '../../shared/ipc-channels';
import type { ResultDto, DigigradeImportResultDto } from '../../shared/types';
import { DigigradeImportService } from '../../application/DigigradeImportService';
import { parseDigigradeExport } from './digigrade-export.schema';

type ImportOutcome = ResultDto<DigigradeImportResultDto> | null;

function failure(message: string): ImportOutcome {
  return { ok: false, error: { name: 'ValidationError', message } };
}

/** Lets the user pick a digigrade export, validates it and merges it. null means the dialog was cancelled. */
export async function importDigigradeViaDialog(win: BrowserWindow, service: DigigradeImportService): Promise<ImportOutcome> {
  const picked = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'digigrade-Export', extensions: ['json'] }],
  });
  const path = picked.filePaths[0];
  if (picked.canceled || !path) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return failure('Die Datei konnte nicht gelesen werden oder ist kein gültiges JSON.');
  }

  const parsed = parseDigigradeExport(raw);
  if (!parsed.ok) return failure(parsed.error.message);

  try {
    return { ok: true, value: await service.import(parsed.value) };
  } catch (error: unknown) {
    console.error('[import] digigrade import failed', error);
    return failure('Der Import ist fehlgeschlagen. Es wurden keine Daten verändert.');
  }
}

export function registerDigigradeImportHandlers(win: BrowserWindow, service: DigigradeImportService): void {
  ipcMain.handle(IPC.IMPORT_DIGIGRADE, () => importDigigradeViaDialog(win, service));
}
