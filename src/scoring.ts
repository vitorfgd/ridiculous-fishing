import { CONFIG } from "./config";

export function computeScore(fishCaught: number, maxDepthUnits: number): number {
  const mult = Math.max(1, Math.floor(maxDepthUnits * CONFIG.depthMultiplier));
  return fishCaught * mult;
}
