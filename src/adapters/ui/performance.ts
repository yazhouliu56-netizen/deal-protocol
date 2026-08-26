/** Low-power device detection + CSS/3D degradation hooks (P5). */

export interface LowPowerNavigator extends Navigator {
  deviceMemory?: number;
}

/** True on devices with <4GB memory or prefers-reduced-motion. Safe on the server. */
export function isLowPower(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as LowPowerNavigator;
  const lowMemory = (nav.deviceMemory ?? 8) < 4;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  return lowMemory || reducedMotion;
}

/** Sets html[data-low-power="1|0"] so CSS can switch off expensive effects. */
export function initLowPower(): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.lowPower = isLowPower() ? "1" : "0";
}

/** WebGL2 (or fallback WebGL1) availability check. Safe on the server. */
export function webglSupported(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") || canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}
