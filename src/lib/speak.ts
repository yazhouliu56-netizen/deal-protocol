/**
 * 长辈语音播报最小封装（补丁 A1）。
 * 无能力环境（SSR/无 speechSynthesis）静默 false，不阻塞业务。
 * Pure-ish; no runtime imports.
 */
export function speak(text: string): boolean {
  try {
    const t = text.trim().slice(0, 120);
    if (!t) return false;
    if (typeof window === "undefined") return false;
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "zh-CN";
    u.rate = 0.9;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
