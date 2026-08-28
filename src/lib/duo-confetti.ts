/**
 * DuoConfetti — Phase 1.1 零依赖 5 色全屏彩带。
 * 纯 DOM + CSS @keyframes，零 npm 依赖，零网络请求。
 */

const COLORS = ["#58cc02", "#1cb0f6", "#ff9600", "#ff4b4b", "#ffc800"];

let styleInjected = false;

function ensureStyle(): void {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.setAttribute("data-duo-confetti", "");
  el.textContent = `
@keyframes duo-confetti-fall {
  0% { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--dx, 0px), 100vh, 0) rotate(720deg); opacity: 0; }
}
.duo-confetti-piece {
  position: fixed;
  top: -10px;
  width: 10px;
  height: 14px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 9999;
  will-change: transform, opacity;
  animation: duo-confetti-fall var(--dur, 1200ms) cubic-bezier(.25,.46,.45,.94) forwards;
}
`;
  document.head.appendChild(el);
}

export function fireDuoConfetti(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  try {
    ensureStyle();
    const count = 36;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "duo-confetti-piece";
      piece.setAttribute("data-duo-confetti-piece", "");
      const left = Math.random() * 100;
      const dx = (Math.random() * 2 - 1) * 220;
      const dur = 900 + Math.random() * 700;
      const delay = Math.random() * 120;
      const color = COLORS[i % COLORS.length];
      piece.style.left = `${left}vw`;
      piece.style.background = color;
      piece.style.setProperty("--dx", `${dx}px`);
      piece.style.setProperty("--dur", `${dur}ms`);
      piece.style.animationDelay = `${delay}ms`;
      // 随机尺寸与圆度
      piece.style.width = `${7 + Math.random() * 8}px`;
      piece.style.height = `${8 + Math.random() * 10}px`;
      piece.style.borderRadius = Math.random() > 0.5 ? "999px" : "3px";
      frag.appendChild(piece);
      setTimeout(() => piece.remove(), dur + delay + 400);
    }
    document.body.appendChild(frag);
    // 容器自清（3s 后兜底）
    setTimeout(() => {
      document.querySelectorAll("[data-duo-confetti-piece]").forEach((n) => n.remove());
    }, 3400);
  } catch {}
}

// 供测试：零依赖契约探针
export function __duoConfettiColorsForTest(): string[] {
  return [...COLORS];
}
