import type { FishHaulBreakdown } from "./scoring";
import { formatMoney } from "./fishEconomy";

const depthEl    = document.querySelector<HTMLDivElement>("#hud-depth")!;
const multEl     = document.querySelector<HTMLDivElement>("#hud-mult")!;
const phaseEl    = document.querySelector<HTMLDivElement>("#hud-phase")!;
const caughtEl   = document.querySelector<HTMLDivElement>("#hud-caught")!;
const haulEl     = document.querySelector<HTMLDivElement>("#hud-haul")!;
const bonusEl    = document.querySelector<HTMLDivElement>("#hud-bonus")!;
const toastEl    = document.querySelector<HTMLDivElement>("#hud-toast")!;
const overlay        = document.querySelector<HTMLDivElement>("#overlay")!;
const overlayReady   = document.querySelector<HTMLDivElement>("#overlay-ready")!;
const overlayResult  = document.querySelector<HTMLDivElement>("#overlay-result")!;
const overlayTitle   = document.querySelector<HTMLDivElement>("#overlay-title")!;
const overlaySub     = document.querySelector<HTMLDivElement>("#overlay-sub")!;
const overlayHint    = document.querySelector<HTMLDivElement>("#overlay-hint")!;
const resultHeading  = document.querySelector<HTMLHeadingElement>("#result-heading")!;
const resultRows     = document.querySelector<HTMLDivElement>("#result-rows")!;
const resultEmpty    = document.querySelector<HTMLParagraphElement>("#result-empty")!;
const resultMeta     = document.querySelector<HTMLDivElement>("#result-meta")!;
const resultBonusLine = document.querySelector<HTMLDivElement>("#result-bonus-line")!;
const resultTotal    = document.querySelector<HTMLDivElement>("#result-total")!;
const resultRetry    = document.querySelector<HTMLButtonElement>("#result-retry")!;
const floaters       = document.querySelector<HTMLDivElement>("#floaters")!;

let toastTimer = 0;
let resultAnimTimers: number[] = [];
let resultAnimRaf = 0;

function clearResultAnim(): void {
  for (const id of resultAnimTimers) window.clearTimeout(id);
  resultAnimTimers = [];
  if (resultAnimRaf) { cancelAnimationFrame(resultAnimRaf); resultAnimRaf = 0; }
}

export type ResultScreenPayload = {
  haul: FishHaulBreakdown;
  bonusDollars: number;
  totalDollars: number;
  depthM: number;
};

export function setHud(
  depthM: number,
  phaseLabel: string,
  caught: number,
  bonusDollars?: number,
  depthMult?: number,
  haulSummary?: string,
): void {
  depthEl.textContent   = `${depthM.toFixed(0)}m`;
  phaseEl.textContent   = phaseLabel;
  caughtEl.textContent  = `×${caught}`;

  if (haulSummary) {
    haulEl.textContent = haulSummary;
    haulEl.classList.remove("hidden");
  } else {
    haulEl.textContent = "";
    haulEl.classList.add("hidden");
  }

  if (depthMult !== undefined && depthMult > 1) {
    multEl.textContent = `×${depthMult} BONUS`;
    multEl.classList.remove("hidden");
  } else {
    multEl.textContent = "";
    multEl.classList.add("hidden");
  }

  if (bonusDollars !== undefined) {
    bonusEl.textContent = `TOSS +${formatMoney(bonusDollars)}`;
    bonusEl.classList.remove("hidden");
  } else {
    bonusEl.textContent = "";
    bonusEl.classList.add("hidden");
  }
}

export function showHudToast(text: string, ms = 900): void {
  window.clearTimeout(toastTimer);
  toastEl.textContent = text;
  toastEl.classList.remove("hidden");
  toastTimer = window.setTimeout(() => toastEl.classList.add("hidden"), ms);
}

export function pulseDepthReadout(): void {
  depthEl.classList.remove("hud-depth--pulse");
  void depthEl.offsetWidth;
  depthEl.classList.add("hud-depth--pulse");
  window.setTimeout(() => depthEl.classList.remove("hud-depth--pulse"), 380);
}

export function showReadyOverlay(): void {
  clearResultAnim();
  overlay.classList.remove("hidden");
  overlayReady.classList.remove("hidden");
  overlayResult.classList.add("hidden");
  overlayTitle.innerHTML = "RIDICULOUS<br>HOOK";
  overlaySub.textContent = "DROP · DODGE · CATCH";
  overlayHint.textContent = "▶ TAP TO DROP ◀";
}

export function hideOverlay(): void {
  clearResultAnim();
  overlay.classList.add("hidden");
  overlayReady.classList.remove("hidden");
  overlayResult.classList.add("hidden");
  resultTotal.classList.remove("result-total--pop", "result-total--rolling");
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function showResultReward(payload: ResultScreenPayload): void {
  clearResultAnim();
  overlay.classList.remove("hidden");
  overlayReady.classList.add("hidden");
  overlayResult.classList.remove("hidden");

  const { haul, bonusDollars, totalDollars, depthM } = payload;

  resultHeading.style.opacity = "0";
  resultHeading.textContent = "CAUGHT!";
  resultRows.innerHTML = "";
  resultTotal.textContent = formatMoney(0);
  resultTotal.classList.remove("result-total--pop");
  resultTotal.classList.add("result-total--rolling");

  const hasRows = haul.rows.length > 0;
  resultEmpty.classList.toggle("hidden", hasRows);

  for (const row of haul.rows) {
    const el = document.createElement("div");
    el.className = "result-row";
    el.style.setProperty("--accent", row.accentHex);
    el.innerHTML =
      `<span class="result-row__name">${row.name.toUpperCase()}</span>` +
      `<span class="result-row__qty">×${row.count}</span>` +
      `<span class="result-row__amt">+${formatMoney(row.lineTotal)}</span>`;
    resultRows.appendChild(el);
  }

  const mult = haul.depthMult;
  let metaHtml = `DEPTH <strong>${depthM.toFixed(0)} M</strong>`;
  if (mult > 1) {
    metaHtml += ` · ×${mult} MULTIPLIER → <strong>${formatMoney(haul.fishPayout)}</strong>`;
  } else {
    metaHtml += ` · PAYOUT <strong>${formatMoney(haul.fishPayout)}</strong>`;
  }
  resultMeta.innerHTML = metaHtml;

  if (bonusDollars > 0) {
    resultBonusLine.textContent = `TOSS BONUS  +${formatMoney(bonusDollars)}`;
    resultBonusLine.classList.remove("hidden");
  } else {
    resultBonusLine.textContent = "";
    resultBonusLine.classList.add("hidden");
  }

  const rowEls = [...resultRows.querySelectorAll<HTMLDivElement>(".result-row")];
  rowEls.forEach((el) => el.classList.remove("result-row--in"));

  const schedule = (fn: () => void, ms: number): void => {
    resultAnimTimers.push(window.setTimeout(fn, ms));
  };

  /* Snappier arcade timing */
  schedule(() => {
    resultHeading.style.transition = "opacity 0.14s ease-out";
    resultHeading.style.opacity = "1";
  }, 80);

  let tRow = 180;
  for (const el of rowEls) {
    const row = el;
    schedule(() => row.classList.add("result-row--in"), tRow);
    tRow += 55;
  }

  const countStart = tRow + 100;
  const countMs    = 900;

  schedule(() => {
    const t0  = performance.now();
    const to  = totalDollars;
    const tick = (now: number): void => {
      const u     = Math.min(1, (now - t0) / countMs);
      const eased = easeOutCubic(u);
      resultTotal.textContent = formatMoney(Math.round(to * eased));
      if (u < 1) {
        resultAnimRaf = requestAnimationFrame(tick);
      } else {
        resultTotal.textContent = formatMoney(to);
        resultTotal.classList.remove("result-total--rolling");
        void resultTotal.offsetWidth;
        resultTotal.classList.add("result-total--pop");
        window.setTimeout(() => resultTotal.classList.remove("result-total--pop"), 420);
      }
    };
    resultAnimRaf = requestAnimationFrame(tick);
  }, countStart);
}

export function onOverlayTap(cb: () => void): () => void {
  const handler = (e: PointerEvent): void => { e.preventDefault(); cb(); };
  overlayReady.addEventListener("pointerdown", handler);
  return () => overlayReady.removeEventListener("pointerdown", handler);
}

export function onResultRetry(cb: () => void): () => void {
  const handler = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    cb();
  };
  resultRetry.addEventListener("pointerdown", handler);
  return () => resultRetry.removeEventListener("pointerdown", handler);
}

export function spawnFloater(
  clientX: number,
  clientY: number,
  text: string,
  className = "floater",
): void {
  const el = document.createElement("div");
  el.className  = className;
  el.textContent = text;
  el.style.left = `${clientX}px`;
  el.style.top  = `${clientY}px`;
  floaters.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}
