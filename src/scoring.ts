import { CONFIG } from "./config";
import { ECONOMY_TIERS } from "./fishEconomy";

export type FishHaulRow = {
  tierId: string;
  name: string;
  count: number;
  unitValue: number;
  lineTotal: number;
  accentHex: string;
};

export type FishHaulBreakdown = {
  rows: FishHaulRow[];
  subtotal: number;
  depthMult: number;
  fishPayout: number;
};

export function depthScoreMult(depthM: number): number {
  return Math.max(1, Math.floor(depthM * CONFIG.depthMultiplier));
}

/**
 * Groups caught fish by economy tier and applies depth multiplier to subtotal.
 * `fishPayout = floor(subtotal * depthMult)`.
 */
export function buildFishHaulBreakdown(
  counts: Map<string, number>,
  maxDepthM: number,
): FishHaulBreakdown {
  const rows: FishHaulRow[] = [];
  let subtotal = 0;
  for (const t of ECONOMY_TIERS) {
    const c = counts.get(t.id) ?? 0;
    if (c <= 0) continue;
    const lineTotal = c * t.value;
    subtotal += lineTotal;
    rows.push({
      tierId: t.id,
      name: t.name,
      count: c,
      unitValue: t.value,
      lineTotal,
      accentHex: t.accentHex,
    });
  }
  const depthMult = depthScoreMult(maxDepthM);
  const fishPayout = Math.floor(subtotal * depthMult);
  return { rows, subtotal, depthMult, fishPayout };
}

export function haulSubtotalFromCounts(counts: Map<string, number>): number {
  let s = 0;
  for (const t of ECONOMY_TIERS) {
    const c = counts.get(t.id) ?? 0;
    s += c * t.value;
  }
  return s;
}
