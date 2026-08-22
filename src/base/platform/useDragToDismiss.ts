/**
 * 半屏抽屉下拉关闭手势（Drag-to-Dismiss · PWA Native-Like UI/UX，白皮书 §九）。
 *
 * 判定规则（纯函数 `shouldDismissSheet`，红线 3 零业务依赖，Node 可测）：
 * - 仅向下滑动（deltaY > 0，向上拖动永不触发）；
 * - 垂直位移 / 容器高度 > thresholdRatio（默认 35%，严格大于）；
 * - 容器高度非法（≤0）时防御性拒绝，绝无除零异常。
 *
 * Hook `useDragToDismiss`：
 * - 监听 touchstart / touchmove / touchend（全部 passive，不抢占滚动）；
 * - touchend 结算位移：容器高度取 `dragRef.current.clientHeight`，
 *   未绑定容器（纯 window 场景）回退基准高度 400px；
 * - 达到阈值触发 `onDismiss`，未达阈值自动复位（不抛事件）；
 * - `enabled` 开关：顶层弹层 / 特定页面可禁用。
 */

import { useEffect, useRef } from "react";

export const DRAG_DISMISS_DEFAULT_THRESHOLD = 0.35;
/** 未绑定容器时的基准高度（px），保证 window 级手势仍有量纲可判。 */
export const DRAG_DISMISS_FALLBACK_HEIGHT_PX = 400;

export interface DragToDismissEvaluation {
  /** 向下垂直位移（px，正值为向下）。 */
  deltaY: number;
  /** 容器逻辑高度（px）。 */
  containerHeight: number;
  /** 位移占比阈值（默认 0.35）。 */
  thresholdRatio?: number;
}

/** 判定一次下拉手势是否达到关闭阈值（纯函数）。 */
export function shouldDismissSheet(
  deltaY: number,
  containerHeight: number,
  thresholdRatio: number = DRAG_DISMISS_DEFAULT_THRESHOLD,
): boolean {
  if (deltaY <= 0) return false;
  if (containerHeight <= 0) return false;
  if (thresholdRatio <= 0) return false;
  return deltaY / containerHeight > thresholdRatio;
}

export interface DragToDismissOptions {
  /** 达到阈值时的关闭回调。 */
  onDismiss: () => void;
  /** 位移占比阈值（默认 0.35 = 35%）。 */
  thresholdRatio?: number;
  /** 全局开关：false 时事件全部解绑。 */
  enabled?: boolean;
}

function pointY(e: TouchEvent, useTouches: boolean): number | null {
  const t = useTouches ? e.touches?.[0] : e.changedTouches?.[0];
  if (!t) return null;
  return t.clientY;
}

export function useDragToDismiss({
  onDismiss,
  thresholdRatio = DRAG_DISMISS_DEFAULT_THRESHOLD,
  enabled = true,
}: DragToDismissOptions) {
  const dragRef = useRef<HTMLElement | null>(null);
  const optsRef = useRef({ onDismiss, thresholdRatio, enabled });
  // latest-ref 模式：render 期禁止写 ref，统一在提交后同步（React Compiler purity 契约）。
  useEffect(() => {
    optsRef.current = { onDismiss, thresholdRatio, enabled };
  });

  useEffect(() => {
    if (!enabled) return;
    let startY: number | null = null;
    let lastY: number | null = null;

    const onStart = (e: TouchEvent) => {
      const y = pointY(e, true);
      if (y !== null) {
        startY = y;
        lastY = y;
      }
    };

    const onMove = (e: TouchEvent) => {
      const y = pointY(e, true);
      if (y !== null) lastY = y;
    };

    const onEnd = (e: TouchEvent) => {
      if (startY === null) return;
      const y = pointY(e, false) ?? lastY;
      const deltaY = y === null ? 0 : y - startY;
      startY = null;
      lastY = null;
      const el = dragRef.current;
      const height = el?.clientHeight ?? DRAG_DISMISS_FALLBACK_HEIGHT_PX;
      if (shouldDismissSheet(deltaY, height, optsRef.current.thresholdRatio)) {
        optsRef.current.onDismiss();
      }
    };

    const target =
      dragRef.current ?? (typeof window !== "undefined" ? window : null);
    if (!target) return;

    target.addEventListener("touchstart", onStart as EventListener, { passive: true });
    target.addEventListener("touchmove", onMove as EventListener, { passive: true });
    target.addEventListener("touchend", onEnd as EventListener, { passive: true });
    return () => {
      target.removeEventListener("touchstart", onStart as EventListener);
      target.removeEventListener("touchmove", onMove as EventListener);
      target.removeEventListener("touchend", onEnd as EventListener);
    };
  }, [enabled, thresholdRatio]);

  return { dragRef };
}
