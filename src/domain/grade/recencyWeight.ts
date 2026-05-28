export function recencyWeight(daysBetween: number): number {
  return 1 / (daysBetween + 1);
}
