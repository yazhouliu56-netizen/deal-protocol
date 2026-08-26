/**
 * 屏幕左边缘手势滑动返回（Edge Swipe-Back · PWA Native-Like UI/UX，白皮书 §八）。
 *
 * 判定规则（纯函数 `evaluateEdgeSwipe`，红线 3 零 UI 依赖，Node 可测）：
 * - 起始触控点位于屏幕左边缘 `0 <= startX <= edgeZone`（默认 24px）；
 * - 水平滑动 `deltaX > threshold`（默认 60px）；
 * - 水平位移明显大于垂直位移 `|dx| > |dy| * verticalRatio`（默认 1.5），
 *   垂直滚动/边缘下拉类手势不误触。
 *
 * Hook `useEdgeSwipeBack`：
 * - 绑定 touchstart / touchmove / touchend（touchmove 非 passive，
 *   右滑水平主导时 `preventDefault` 抢占原生手势）；
 * - 满足判定触发 `onSwipeBack`（或 `window.history.back()`）；
 * - `enabled` 开关：全屏弹窗 / 特定页面可禁用；
 * - 返回 `edgeRef`：绑定到目标元素；不绑定时全局监听 window。
 */

import { useEffect, useRef } from "react";

export const EDGE_SWIPE_EDGE_ZONE_PX = 24;
export const EDGE_SWIPE_THRESHOLD_PX = 60;
export const EDGE_SWIPE_VERTICAL_RATIO = 1.5;
/** touchmove 阶段开始抢占默认行为的水平位移下限（px）。 */
export const EDGE_SWIPE_PREVENT_START_PX = 12;

export interface EdgeSwipePoint {
  x: number;
  y: number;
}

export interface EdgeSwipeEvaluation {
  /** 起始触控点（touchstart）。 */
  start: EdgeSwipePoint;
  /** 结束触控点（touchend，或最后的 touchmove 点）。 */
  end: EdgeSwipePoint;
  /** 水平滑动距离阈值（px，默认 60）。 */
  threshold?: number;
  /** 左边缘判定带（px，默认 24）。 */
  edgeZone?: number;
  /** 水平 / 垂直位移比（默认 1.5）。 */
  verticalRatio?: number;
}

/** 判定一次边缘右滑手势是否成立（纯函数）。 */
export function evaluateEdgeSwipe(e: EdgeSwipeEvaluation): boolean {
  const threshold = e.threshold ?? EDGE_SWIPE_THRESHOLD_PX;
  const edgeZone = e.edgeZone ?? EDGE_SWIPE_EDGE_ZONE_PX;
  const verticalRatio = e.verticalRatio ?? EDGE_SWIPE_VERTICAL_RATIO;
  const { start, end } = e;
  if (start.x < 0 || start.x > edgeZone) return false;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx <= threshold) return false;
  if (Math.abs(dx) <= Math.abs(dy) * verticalRatio) return false;
  return true;
}

export interface EdgeSwipeOptions {
  /** 手势成立时的回调（优先于 history.back）。 */
  onSwipeBack?: () => void;
  /** 无回调时是否调用 history.back()（默认 true）。 */
  useHistoryBack?: boolean;
  /** 水平滑动距离阈值（px，默认 60）。 */
  threshold?: number;
  /** 左边缘判定带（px，默认 24）。 */
  edgeZone?: number;
  /** 水平 / 垂直位移比（默认 1.5）。 */
  verticalRatio?: number;
  /** 全局开关：false 时事件全部解绑（全屏弹窗 / 特定页面禁用）。 */
  enabled?: boolean;
}

interface Point {
  x: number;
  y: number;
}

function pointFromEvent(e: TouchEvent): Point | null {
  const t = e.touches?.[0] ?? e.changedTouches?.[0];
  if (!t) return null;
  return { x: t.clientX, y: t.clientY };
}

export function useEdgeSwipeBack(options: EdgeSwipeOptions = {}) {
  const {
    onSwipeBack,
    useHistoryBack = true,
    threshold = EDGE_SWIPE_THRESHOLD_PX,
    edgeZone = EDGE_SWIPE_EDGE_ZONE_PX,
    verticalRatio = EDGE_SWIPE_VERTICAL_RATIO,
    enabled = true,
  } = options;

  const edgeRef = useRef<HTMLElement | null>(null);
  const optsRef = useRef({ onSwipeBack, useHistoryBack, threshold, edgeZone, verticalRatio });
  // latest-ref 模式：render 期禁止写 ref，统一在提交后同步（React Compiler purity 契约）。
  useEffect(() => {
    optsRef.current = { onSwipeBack, useHistoryBack, threshold, edgeZone, verticalRatio };
  });

  useEffect(() => {
    if (!enabled) return;
    let start: Point | null = null;

    const onStart = (e: TouchEvent) => {
      const p = pointFromEvent(e);
      if (!p) return;
      start = p;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const p = pointFromEvent(e);
      if (!p) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (dx > EDGE_SWIPE_PREVENT_START_PX && Math.abs(dx) > Math.abs(dy) * verticalRatio) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const p = pointFromEvent(e) ?? start;
      const hit = evaluateEdgeSwipe({ start, end: p, threshold, edgeZone, verticalRatio });
      start = null;
      if (!hit) return;
      if (e.cancelable) e.preventDefault();
      const opts = optsRef.current;
      if (opts.onSwipeBack) {
        opts.onSwipeBack();
      } else if (opts.useHistoryBack && typeof window !== "undefined") {
        window.history.back();
      }
    };

    const target =
      edgeRef.current ?? (typeof window !== "undefined" ? window : null);
    if (!target) return;

    target.addEventListener("touchstart", onStart as EventListener, { passive: true });
    target.addEventListener("touchmove", onMove as EventListener, { passive: false });
    target.addEventListener("touchend", onEnd as EventListener, { passive: false });
    return () => {
      target.removeEventListener("touchstart", onStart as EventListener);
      target.removeEventListener("touchmove", onMove as EventListener);
      target.removeEventListener("touchend", onEnd as EventListener);
    };
  }, [enabled, edgeZone, threshold, verticalRatio]);

  return { edgeRef };
}
