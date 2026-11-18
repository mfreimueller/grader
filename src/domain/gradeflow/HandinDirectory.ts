import { Result } from "../shared/Result";

/** Reads the folder that holds the hand-ins; a port so the application layer needs no file system. */
export interface HandinDirectory {
  /** Names of the immediate subdirectories (no symlinks followed, no files), sorted. */
  listFolderNames(dir: string): Promise<Result<string[]>>;
  /** True for an existing regular file (a link to one counts); false otherwise. */
  isFile(path: string): Promise<boolean>;
}
