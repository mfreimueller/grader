import { Result } from "../shared/Result";
import { MaterialKind } from "./WorkspaceMaterial";

/** Reads the folder that holds the hand-ins; a port so the application layer needs no file system. */
export interface HandinDirectory {
  /** Names of the immediate subdirectories (no symlinks followed, no files), sorted. */
  listFolderNames(dir: string): Promise<Result<string[]>>;
  /** `file` / `directory` for an existing regular file / folder (a link to one counts); null otherwise. */
  kindOf(path: string): Promise<MaterialKind | null>;
}
