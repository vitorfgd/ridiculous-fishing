/**
 * Which fish texture to show (0 classic sheet, 1 snapper, 2 angler).
 * Progresses with spawn depth: classic fades out, new art dominates, angler stays rare (global cap).
 */

/** Max anglerfish instances in one field (third species). */
export const MAX_ANGLER_IN_FIELD = 3;

/**
 * @param depthM meters below surface at spawn
 * @param anglerState mutable counter for angler spawns this field
 */
export function pickFishArtVariant(
  depthM: number,
  anglerState: { n: number },
): 0 | 1 | 2 {
  // Classic nearly gone by ~55m; 0% by ~58m.
  const pClassic = Math.max(0, Math.min(0.94, 1 - (depthM - 5) / 53));
  const r = Math.random();
  if (r < pClassic) return 0;

  // Among new fish: angler ramps with depth but stays a minority until cap.
  const pAngler = Math.max(0, Math.min(0.26, (depthM - 18) / 160));
  const canAngler = anglerState.n < MAX_ANGLER_IN_FIELD;
  const r2 = Math.random();
  if (canAngler && r2 < pAngler) {
    anglerState.n += 1;
    return 2;
  }
  return 1;
}
