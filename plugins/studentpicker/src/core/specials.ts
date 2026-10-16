import { validateSpecials } from './draw';
import type { Special } from './types';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Reads the stored specials defensively: an entry that is not valid is dropped, the rest is kept. */
export function parseSpecials(stored: unknown): Special[] {
  if (!Array.isArray(stored)) return [];
  const seen = new Set<string>();
  const specials: Special[] = [];
  for (const entry of stored as unknown[]) {
    const special = parseSpecial(entry);
    if (special && !seen.has(special.id)) {
      seen.add(special.id);
      specials.push(special);
    }
  }
  return specials;
}

function parseSpecial(entry: unknown): Special | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const raw = entry as Record<string, unknown>;
  const { id, label, color, kind, probability } = raw;

  if (typeof id !== 'string' || id === '') return null;
  if (typeof label !== 'string' || label.trim() === '') return null;
  if (typeof color !== 'string' || !HEX_COLOR.test(color)) return null;
  if (kind !== 'spin-again' && kind !== 'message') return null;
  if (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 100) return null;
  const showIn = raw['showIn'] ?? 'always';
  if (showIn !== 'always' && showIn !== 'free-only') return null;

  const message = kind === 'message' && typeof raw['message'] === 'string' ? raw['message'].trim() : '';
  return {
    id,
    label: label.trim(),
    color: color.toLowerCase(),
    kind,
    probability,
    showIn,
    ...(message ? { message } : {}),
  };
}

export function newSpecial(id: string): Special {
  return { id, label: '', color: '#6d28d9', kind: 'spin-again', probability: 5, showIn: 'always' };
}

/** Why the draft cannot be saved yet, or null. */
export function specialsProblem(draft: readonly Special[]): 'label' | 'invalid-probability' | 'sum-too-high' | null {
  if (draft.some((s) => s.label.trim() === '')) return 'label';
  const validation = validateSpecials(draft);
  return validation.ok ? null : validation.error;
}

/** The percent of the draws that are left for students. */
export function shareForStudents(specials: readonly Special[]): number {
  const taken = specials.reduce((sum, s) => sum + (Number.isFinite(s.probability) ? s.probability : 0), 0);
  return Math.max(0, 100 - taken);
}

/** What goes into the storage: labels and messages trimmed, a message only where it can be shown. */
export function prepareForSave(draft: readonly Special[]): Special[] {
  return draft.map((special) => {
    const { message, ...rest } = special;
    const text = message?.trim();
    return { ...rest, label: special.label.trim(), ...(special.kind === 'message' && text ? { message: text } : {}) };
  });
}
