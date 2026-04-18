/**
 * Depth-based fish economy (names, $ values, presentation accents).
 * Depth is meters below surface at spawn time.
 */

export type EconomyTierDef = {
  id: string;
  name: string;
  /** Inclusive lower bound (m). */
  depthMinM: number;
  /** Exclusive upper bound (m); last tier uses a large cap. */
  depthMaxM: number;
  value: number;
  /** Hex tint multiplied onto sprite base color. */
  accentHex: string;
  /** Extra scale on top of progressive spawn sizing. */
  visualScale: number;
};

export const ECONOMY_TIERS: readonly EconomyTierDef[] = [
  {
    id: "sardine",
    name: "Sardine",
    depthMinM: 0,
    depthMaxM: 20,
    value: 250,
    accentHex: "#9ae0ff",
    visualScale: 0.9,
  },
  {
    id: "trout",
    name: "Trout",
    depthMinM: 20,
    depthMaxM: 50,
    value: 500,
    accentHex: "#ffd48a",
    visualScale: 1,
  },
  {
    id: "tuna",
    name: "Tuna",
    depthMinM: 50,
    depthMaxM: 1e6,
    value: 1000,
    accentHex: "#d4b8ff",
    visualScale: 1.1,
  },
] as const;

export function economyTierForSpawnDepthM(depthM: number): EconomyTierDef {
  for (const t of ECONOMY_TIERS) {
    if (depthM >= t.depthMinM && depthM < t.depthMaxM) return t;
  }
  return ECONOMY_TIERS[ECONOMY_TIERS.length - 1]!;
}

export function formatMoney(n: number): string {
  const v = Math.round(n);
  return `$${v.toLocaleString("en-US")}`;
}
