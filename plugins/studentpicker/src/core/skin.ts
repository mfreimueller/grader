/** How the picker looks; chosen per course and kept in the course storage. */
export const SKINS = ['slotmachine', 'wheel', 'casino'] as const;
export type Skin = (typeof SKINS)[number];

export const DEFAULT_SKIN: Skin = 'slotmachine';

/** Reads the stored skin; anything unknown falls back to the slot machine. */
export function parseSkin(stored: unknown): Skin {
  return SKINS.find((skin) => skin === stored) ?? DEFAULT_SKIN;
}
