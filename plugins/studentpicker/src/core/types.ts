export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  /** `#rrggbb` or null. */
  color: string | null;
  /** How often the student was picked in this course. */
  pickCount: number;
}

export type SpecialKind = 'spin-again' | 'message';
export type SpecialVisibility = 'always' | 'free-only';

/** An extra field on the machine that counts and records nothing, such as "spin again". */
export interface Special {
  id: string;
  label: string;
  /** `#rrggbb` */
  color: string;
  kind: SpecialKind;
  message?: string;
  /** Percent of the draws, 0 to 100. */
  probability: number;
  showIn: SpecialVisibility;
}

/** One name on the reels or the wheel: a student or a special. */
export interface WheelItem {
  id: string;
  label: string;
  /** Own `#rrggbb` of the student or special; the wheel falls back to its palette. */
  color: string | null;
  special: boolean;
  kind: SpecialKind | null;
}
