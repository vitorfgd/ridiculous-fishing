export enum AppState {
  Ready = "Ready",
  Playing = "Playing",
  /** Brief surface celebration before bonus toss (same run, no new mechanics). */
  SurfacePayoff = "SurfacePayoff",
  BonusToss = "BonusToss",
  Result = "Result",
}

export enum PlayPhase {
  Descent = "Descent",
  Ascent = "Ascent",
}

export type RunStats = {
  maxDepthUnits: number;
  fishCaught: number;
  finalScore: number;
};
