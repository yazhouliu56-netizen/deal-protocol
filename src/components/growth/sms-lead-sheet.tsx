"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* =====================================================================
 * 投流留资接力（Mode B · 纯前端）。
 *
 * 后端红线：严禁放行 POST /api/demands 匿名请求 —— withAuth 保持，
 * demander_id 物理合规。本模块只在前端做「惰性留资 + 静默建号发单」：
 * 下单点击 → 草稿暂存 sessionStorage → 未登录弹留资窗 → 短信建号
 * （服务端写 Session Cookie）→ 自动重放发单 → 本页成功态。
 * ===================================================================== */

/** 与服务端 PHONE_REGEX 同源（send/verify 双路由）：11 位 1[3-9] 开头。 */
export function isValidGrowthPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/** 获取验证码防连击倒计时（秒）。 */
export const LEAD_SMS_COUNTDOWN_SECONDS = 60;

/** 短信验证码长度（服务端 verify 要求 6 位）。 */
export const LEAD_SMS_CODE_LENGTH = 6;

export interface LeadDraft {
  presetId: string;
  tuning: string;
}

const DRAFT_KEY_PREFIX = "growth:lead-draft:";

export function buildDraftKey(pageKey: string): string {
  return `${DRAFT_KEY_PREFIX}${pageKey}`;
}

export function serializeLeadDraft(draft: LeadDraft): string {
  return JSON.stringify({ presetId: draft.presetId, tuning: draft.tuning });
}

export function parseLeadDraft(raw: string | null): LeadDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LeadDraft>;
    if (typeof parsed.presetId !== "string" || typeof parsed.tuning !== "string") {
      return null;
    }
    return { presetId: parsed.presetId, tuning: parsed.tuning };
  } catch {
    return null;
  }
}

function readLeadDraft(key: string): LeadDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return parseLeadDraft(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeLeadDraft(key: string, draft: LeadDraft): void {
  try {
    window.sessionStorage.setItem(key, serializeLeadDraft(draft));
  } catch {
    /* 隐私模式配额满：草稿仅本次内存有效，不阻断主流程 */
  }
}

function clearLeadDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * 结构化直发（零 LLM 依赖）：增长页类目已知，绕开服务端的
 * classifyDemand/GEMINI 链路，发单更快且不受模型配额影响。
 * 后端 text 分支保持不动（通用口语入口仍走 AI 分类）。
 */
export async function postDemandPayload(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/demands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    throw new Error("登录已失效，请重新验证手机号");
  }
  if (!res.ok) throw new Error("发单失败，请重试");
}

/* ================= 短信留资弹窗 ================= */

interface SmsLeadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => Promise<void>;
}

export function SmsLeadSheet({ open, onOpenChange, onVerified }: SmsLeadSheetProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 弹窗关闭时重置验证态（渲染期派生，受控对照模式）。
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setError(null);
      setVerifying(false);
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(LEAD_SMS_COUNTDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleSend = async () => {
    if (!isValidGrowthPhone(phone) || sending || countdown > 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "验证码发送失败，请稍后重试");
      }
      setSmsSent(true);
      startCountdown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    if (!isValidGrowthPhone(phone) || code.length !== LEAD_SMS_CODE_LENGTH || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "验证失败，请检查验证码");
      }
      await onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证失败");
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="sms-lead-sheet">
        <DialogHeader>
          <DialogTitle>验证手机号以接收接单通知</DialogTitle>
          <DialogDescription>
            师傅接单后将第一时间短信通知你，全程资金官方托管。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="11 位手机号"
              aria-label="手机号"
              data-testid="lead-phone-input"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!isValidGrowthPhone(phone) || sending || countdown > 0}
              onClick={handleSend}
              data-testid="lead-send-code"
            >
              {countdown > 0 ? `${countdown}s 后重发` : sending ? "发送中…" : smsSent ? "重新发送" : "获取验证码"}
            </Button>
          </div>
          {smsSent && (
            <Input
              inputMode="numeric"
              maxLength={LEAD_SMS_CODE_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6 位短信验证码"
              aria-label="验证码"
              data-testid="lead-code-input"
            />
          )}
          <Button
            type="button"
            className="w-full"
            disabled={!smsSent || code.length !== LEAD_SMS_CODE_LENGTH || verifying}
            onClick={handleVerify}
            data-testid="lead-verify-submit"
          >
            {verifying ? "验证并下单中…" : "验证并下单"}
          </Button>
          {error && (
            <p className="text-sm text-rose-600" data-testid="lead-error">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= 下单接力 Hook ================= */

interface LeadSubmitOpts {
  /** 页面键（m20 / f20），用于草稿隔离。 */
  pageKey: string;
  collect: () => LeadDraft;
  /** 草稿 → 结构化发单载荷（含 title/description/category，不走 text 分类）。 */
  buildPayload: (draft: LeadDraft) => Record<string, unknown>;
  applyDraft: (draft: LeadDraft) => void;
  setSubmitting: (b: boolean) => void;
  setDone: (b: boolean) => void;
  setError: (msg: string | null) => void;
}

export function useLeadDemandSubmit(opts: LeadSubmitOpts) {
  const { pageKey, collect, buildPayload, applyDraft, setSubmitting, setDone, setError } = opts;
  const draftKey = buildDraftKey(pageKey);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pendingRef = useRef<LeadDraft | null>(null);

  const applyRef = useRef(applyDraft);
  useEffect(() => {
    applyRef.current = applyDraft;
  });

  useEffect(() => {
    const saved = readLeadDraft(draftKey);
    if (saved) applyRef.current(saved);
  }, [draftKey]);

  const submit = useCallback(async () => {
    const draft = collect();
    pendingRef.current = draft;
    writeLeadDraft(draftKey, draft);
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await getBrowserSupabase().auth.getSession();
      if (data.session) {
        await postDemandPayload(buildPayload(draft));
        clearLeadDraft(draftKey);
        pendingRef.current = null;
        setDone(true);
      } else {
        setSheetOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发单失败");
    } finally {
      setSubmitting(false);
    }
  }, [draftKey, collect, buildPayload, setSubmitting, setDone, setError]);

  /** 短信建号成功后：Cookie 已就位，重放暂存草稿发单。 */
  const handleVerified = useCallback(async () => {
    const draft = pendingRef.current ?? readLeadDraft(draftKey) ?? collect();
    setSubmitting(true);
    setError(null);
    try {
      await postDemandPayload(buildPayload(draft));
      clearLeadDraft(draftKey);
      pendingRef.current = null;
      setSheetOpen(false);
      setDone(true);
    } catch (err) {
      setSheetOpen(false);
      setError(err instanceof Error ? err.message : "发单失败");
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [draftKey, collect, buildPayload, setSubmitting, setDone, setError]);

  return { submit, sheetOpen, setSheetOpen, handleVerified };
}
