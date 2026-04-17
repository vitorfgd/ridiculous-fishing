import type { FishInstance } from "./fish";

/** Circle (hook) vs axis-aligned rectangle (fish). */
export function circleHitsAabb(
  cx: number,
  cy: number,
  radius: number,
  fx: number,
  fy: number,
  halfW: number,
  halfH: number,
): boolean {
  const nx = Math.max(fx - halfW, Math.min(cx, fx + halfW));
  const ny = Math.max(fy - halfH, Math.min(cy, fy + halfH));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

export function findFirstFishHit(
  cx: number,
  cy: number,
  radius: number,
  fish: FishInstance[],
): FishInstance | null {
  for (const f of fish) {
    if (!f.alive) continue;
    if (f.state !== "swim") continue;
    if (
      circleHitsAabb(cx, cy, radius, f.x, f.y, f.hitHalfW, f.hitHalfH)
    ) {
      return f;
    }
  }
  return null;
}
