/**
 * DuoAudioEngine — Phase 1.1 Feather 原生 Web Audio 合成器。
 * 0 外部 MP3 / 0 网络请求 / 0ms 延迟。SSR 与 Node 环境 0ms 静默降级（宪法 #10）。
 */

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function ensureUnlocked(): void {
  if (unlocked || typeof window === "undefined") return;
  const resume = () => {
    try {
      const c = getCtx();
      if (c && c.state === "suspended") void c.resume();
      unlocked = true;
    } catch {}
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
  };
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
}

// 首触解锁（非阻塞）
if (typeof window !== "undefined") ensureUnlocked();

function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.22): void {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") void c.resume().catch(() => {});
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(c.destination);
    const now = c.currentTime;
    // 极短淡出防爆音
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {}
}

export function playClick(): void {
  try {
    // 400 → 800 快速扫频点击
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") void c.resume().catch(() => {});
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.06);
    g.gain.value = 0.18;
    osc.connect(g);
    g.connect(c.destination);
    const now = c.currentTime;
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {}
}

export function playCorrect(): void {
  try {
    // 经典 Ding 三和弦 523/659/783 + 1046 尾音
    tone(523, 120, "sine", 0.2);
    setTimeout(() => tone(659, 120, "sine", 0.2), 90);
    setTimeout(() => tone(783, 140, "sine", 0.2), 180);
    setTimeout(() => tone(1046, 220, "sine", 0.18), 300);
  } catch {}
}

export function playError(): void {
  try {
    tone(180, 180, "sine", 0.16);
  } catch {}
}

// 供测试：重置内部状态
export function __resetDuoAudioForTest(): void {
  ctx = null;
  unlocked = false;
}
