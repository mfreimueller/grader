// The snow that falls over the whole window while the Adventkalender skin is shown.

export interface Snowflake {
  id: number;
  /** Start position in percent of the window width. */
  left: number;
  /** Diameter in px. */
  size: number;
  opacity: number;
  /** Time for one fall from the top to the bottom edge. */
  durationMs: number;
  /** Never positive: the flake starts part of the way down, so the window is full of snow from the first frame. */
  delayMs: number;
  /** How far it sways sideways in either direction, in px. */
  sway: number;
}

/** `count` flakes, decided by `random` (Math.random in the app) so the tests can pin them down. */
export function snowflakes(count: number, random: () => number): Snowflake[] {
  return Array.from({ length: count }, (_, id) => {
    const left = random() * 100;
    const size = 2 + random() * 5;
    const opacity = 0.4 + random() * 0.5;
    const durationMs = 8000 + random() * 10000;
    return { id, left, size, opacity, durationMs, delayMs: -(random() * durationMs), sway: (random() - 0.5) * 60 };
  });
}
