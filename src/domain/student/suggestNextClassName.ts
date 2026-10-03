const LEADING_GRADE = /^(\d+)(.*)$/s;

/** Suggests the class name for the next school year by incrementing the leading grade digit(s). */
export function suggestNextClassName(name: string): string | null {
  const match = name.trim().match(LEADING_GRADE);
  if (!match) return null;
  const grade = parseInt(match[1]!, 10);
  return `${grade + 1}${match[2]}`;
}
