export type MaterialRole = "assignment" | "solution";
export type MaterialKind = "file" | "directory";

/** Where a teacher's material lands in the workspace: `ASSIGNMENT.md`, `SOLUTION.pdf`, `assignment/`, `solution/`. */
export function workspaceMaterialName(
  role: MaterialRole,
  kind: MaterialKind,
  extension: string,
): string {
  if (kind === "directory") return `${role}/`;
  return `${role.toUpperCase()}${extension}`;
}
