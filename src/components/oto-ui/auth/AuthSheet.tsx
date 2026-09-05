"use client";
import { useEffect, useRef, useState } from "react";
import { useDragToDismiss } from "@/adapters/ui/useDragToDismiss";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";
import { toast } from "@/base/platform/toast";
import { getBrowserSupabase } from "@/lib/supabase-browser";

/**
 * OTO 前庭登录抽屉（Step 2 真并轨后）。
 * - 单通道：手机号真实短信（POST /api/auth/sms/send+verify），成功即写
 *   服务端 Session Cookie，全站 Supabase 真实身份源。
 * - 游客浏览态：未登录不阻断前台，仅功能入口引导登录。
 * - 身份桥（read/refresh/clearAuthAccount + oto:auth-changed）：Supabase
 *   Session 的同步投影，供 ProfilePage 等消费方即时刷新。
 * - 演示沙盒账号与 Web3 假钱包已下线（Phase 2.2）。
 */

/**
 * 历史种子键（不再写入，仅保留导出供旧测试/旧种子识别）。
 * @deprecated Phase 2.2 起身份唯一真相源为 Supabase Session。
 */
export const AUTH_ACCOUNT_KEY = "oto-auth-account";

export type AuthRole = "employer" | "provider" | "host";
export type AuthMethod = "phone" | "session";

export interface AuthAccount {
  nickname: string;
  emoji: string;
  role: AuthRole;
  method: AuthMethod;
  at: number;
  uid?: string;
  phone?: string;
}

export const AUTH_OPEN_EVENT = "oto:auth-open";
export const AUTH_CHANGED_EVENT = "oto:auth-changed";

const ROLE_LABEL: Record<AuthRole, string> = {
  employer: "需求方 · 雇主",
  provider: "响应者 · 服务者",
  host: "组局主理人",
};

const ROLE_EMOJI: Record<AuthRole, string> = {
  employer: "🧑‍💼",
  provider: "🧹",
  host: "🎯",
};

/**
 * 服务端 role → OTO 展示 role（核准映射）。
 * admin 归雇主侧展示（管理后台另有入口）；未知值一律雇主兜底。
 */
export function mapServerRoleToOto(role: string | null | undefined): AuthRole {
  if (role === "provider" || role === "both") return "provider";
  return "employer";
}

/**
 * OTO role → 服务端 role（核准映射，users 表 CHECK 合法）。
 * 严禁写出 user/client/roles。
 */
export function mapOtoRoleToServer(role: AuthRole): "demander" | "provider" {
  return role === "employer" ? "demander" : "provider";
}

export function maskPhoneDisplay(phone: string): string {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

let cachedAccount: AuthAccount | null = null;

function setCachedAccount(account: AuthAccount | null) {
  cachedAccount = account;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** 同步投影：返回最近一次 refresh 的结果（未刷新过为 null）。 */
export function readAuthAccount(): AuthAccount | null {
  return cachedAccount;
}

/**
 * 真实 Session 拉取：Supabase getSession → /api/profile 角色校准 →
 * 写入同步投影并广播。无会话则清投影。网络异常时保持旧投影不变。
 */
export async function refreshAuthAccount(): Promise<AuthAccount | null> {
  try {
    const supabase = getBrowserSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setCachedAccount(null);
      return null;
    }
    const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
    let role = typeof meta.role === "string" ? meta.role : null;
    let phone = typeof meta.phone === "string" ? meta.phone : null;
    let name = typeof meta.name === "string" ? meta.name : null;
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = (await res.json()) as {
          user?: { role?: string; phone?: string; name?: string } | null;
        };
        if (data.user) {
          role = data.user.role ?? role;
          phone = data.user.phone ?? phone;
          name = data.user.name ?? name;
        }
      }
    } catch {
      /* profile  enrichment 失败：退回 metadata */
    }
    const otoRole = mapServerRoleToOto(role);
    const account: AuthAccount = {
      nickname: name || (phone ? maskPhoneDisplay(phone) : (session.user.email?.split("@")[0] ?? "用户")),
      emoji: ROLE_EMOJI[otoRole],
      role: otoRole,
      method: "session",
      at: Date.now(),
      uid: session.user.id,
      phone: phone ?? undefined,
    };
    setCachedAccount(account);
    return account;
  } catch {
    return cachedAccount;
  }
}

export async function clearAuthAccount() {
  try {
    await getBrowserSupabase().auth.signOut();
  } catch {
    /* 登出失败也清本地投影 */
  }
  setCachedAccount(null);
}

/** 前台任意位置呼出登录抽屉（无整页跳转）。 */
export function openAuthSheet() {
  window.dispatchEvent(new Event(AUTH_OPEN_EVENT));
}

const AUTH_SHEET_CSS = `
.auth-mask{position:fixed;inset:0;background:rgba(5,6,15,.6);backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);z-index:90}
.auth-sheet{position:fixed;inset-inline:0;bottom:0;z-index:91;max-width:520px;margin:0 auto;
  background:linear-gradient(180deg,rgba(30,33,58,.92),rgba(13,16,32,.97));
  backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);
  border-radius:26px 26px 0 0;border:1px solid rgba(255,255,255,.16);border-bottom:none;
  border-top-color:rgba(255,255,255,.42);
  box-shadow:0 -18px 60px -12px rgba(123,97,255,.45),inset 0 1px 0 rgba(255,255,255,.35);
  max-height:76vh;overflow-y:auto;padding:10px 18px 22px;color:#e2e8f0;font-size:13px;
  transition:transform .22s cubic-bezier(.16,1,.3,1),opacity .22s cubic-bezier(.16,1,.3,1)}
.auth-sheet-dismissing{transform:translateY(105%);opacity:0}
.auth-grip{width:44px;height:4px;border-radius:999px;background:rgba(255,255,255,.3);
  margin:4px auto 12px;cursor:grab;touch-action:none}
.auth-title{display:flex;justify-content:space-between;align-items:center}
.auth-title h3{margin:0;font-size:16px;font-weight:800;
  background:linear-gradient(90deg,#fff,#c4b5fd,#7b61ff);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.auth-close{border:none;background:rgba(255,255,255,.08);color:#cbd5e1;border-radius:12px;
  min-width:48px;min-height:48px;font-size:12px;cursor:pointer;transition:background .2s}
.auth-close:hover{background:rgba(255,255,255,.16)}
.auth-tabs{display:flex;gap:6px;margin-top:14px;background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:4px}
.auth-tab{flex:1;min-width:0;min-height:48px;border:none;border-radius:12px;cursor:pointer;
  font-size:11.5px;font-weight:700;color:rgba(255,255,255,.55);background:transparent;
  transition:all .2s}
.auth-tab-active{background:linear-gradient(135deg,rgba(123,97,255,.85),rgba(75,155,255,.7));
  color:#fff;box-shadow:0 6px 20px -6px rgba(123,97,255,.6)}
.auth-body{margin-top:14px}
.auth-phone-row{display:flex;gap:8px}
.auth-input{flex:1;min-width:0;min-height:48px;border-radius:14px;
  background:color-mix(in srgb,var(--color-surface-subtle,#f4f6f9) 8%,transparent);
  border:1px solid rgba(255,255,255,.14);padding:0 14px;font-size:13px;color:#f8fafc;
  outline:none;transition:border-color .2s}
.auth-input:focus{border-color:rgba(123,97,255,.6)}
.auth-input::placeholder{color:rgba(255,255,255,.3)}
.auth-primary{min-height:48px;border:none;border-radius:14px;cursor:pointer;font-weight:800;
  font-size:13px;color:#fff;padding:0 16px;
  background:linear-gradient(45deg,#7b61ff,#4b9bff);
  box-shadow:0 10px 30px -10px rgba(123,97,255,.55);transition:filter .2s,transform .15s}
.auth-primary:disabled{opacity:.4;cursor:not-allowed}
.auth-primary:not(:disabled):active{transform:scale(.985)}
.auth-hint{font-size:10.5px;color:rgba(255,255,255,.4);margin-top:8px;line-height:1.6}
.auth-demo-grid{display:flex;flex-direction:column;gap:8px}
.auth-demo-item{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 12px;
  border-radius:16px;border:1px solid rgba(255,255,255,.12);cursor:pointer;text-align:left;
  background:rgba(255,255,255,.05);transition:border-color .2s,background .2s}
.auth-demo-item:hover{border-color:rgba(123,97,255,.5);background:rgba(123,97,255,.08)}
.auth-demo-item:active{transform:scale(.985)}
.auth-demo-emoji{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;
  justify-content:center;font-size:18px;background:rgba(123,97,255,.18);
  border:1px solid rgba(255,255,255,.1)}
.auth-demo-label{font-size:12.5px;font-weight:700;color:#f8fafc}
.auth-demo-role{font-size:10px;color:rgba(255,255,255,.45);margin-top:1px}
.auth-wallet-box{display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:20px 14px;border-radius:18px;border:1px dashed rgba(123,97,255,.4);
  background:linear-gradient(135deg,rgba(123,97,255,.1),rgba(0,240,255,.04))}
.auth-wallet-id{font-size:11px;color:#a5b4fc;font-family:ui-monospace,monospace;
  word-break:break-all;text-align:center}
.auth-signed-in{display:flex;align-items:center;gap:10px;padding:12px;border-radius:16px;
  background:linear-gradient(135deg,rgba(74,222,128,.1),rgba(16,185,129,.05));
  border:1px solid rgba(74,222,128,.3)}
.auth-signed-in-name{font-size:13px;font-weight:800;color:#4ade80}
.auth-quit{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);
  color:rgba(255,255,255,.6)}
`;

/** 登录抽屉（半屏毛玻璃 · 真实短信单通道 · 下拉手势收起）。 */
export default function AuthSheet() {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [phone, setPhone] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { dragRef: gripDragRef } = useDragToDismiss({
    onDismiss: () => {
      if (dismissing) return;
      beginDismiss();
    },
    enabled: open,
  });

  // 景深微缩：抽屉打开期间锁定边缘手势并驱动底层视口 scale/brightness
  useEffect(() => {
    lockEdgeGesture(open);
    return () => lockEdgeGesture(false);
  }, [open]);

  function beginDismiss() {
    if (dismissing) return;
    setDismissing(true);
    window.setTimeout(() => {
      setDismissing(false);
      setOpen(false);
    }, 220);
  }

  // 全局呼出（oto:auth-open）与登录态变更（oto:auth-changed）。
  // 打开即从真实 Session 刷新投影，保证卡面与服务端一致。
  useEffect(() => {
    const onOpen = () => {
      setAccount(readAuthAccount());
      setOpen(true);
      void refreshAuthAccount().then((fresh) => {
        if (fresh) setAccount(fresh);
      });
    };
    const onChanged = () => setAccount(readAuthAccount());
    window.addEventListener(AUTH_OPEN_EVENT, onOpen);
    window.addEventListener(AUTH_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(AUTH_OPEN_EVENT, onOpen);
      window.removeEventListener(AUTH_CHANGED_EVENT, onChanged);
    };
  }, []);

  // 验证码倒计时：单一定时器，tick 内自停。
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const phoneValid = /^1[3-9]\d{9}$/.test(phone);

  async function handleSendSms() {
    if (!phoneValid || sending || countdown > 0) return;
    setSending(true);
    setFormError(null);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !data?.success) {
        throw new Error(data?.error === "SMS_GATEWAY_NOT_CONFIGURED" || data?.error === "SMS_SEND_FAILED"
          ? (data.message ?? "短信发送失败")
          : (data?.error ?? "发送失败，请稍后重试"));
      }
      setSmsSent(true);
      setCountdown(60);
      toast("📨 验证码已发送", "success");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "发送失败，请稍后重试");
    } finally {
      setSending(false);
    }
  }

  async function handlePhoneLogin() {
    if (!phoneValid || smsCode.length !== 6 || verifying) return;
    setVerifying(true);
    setFormError(null);
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: smsCode }),
      });
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "验证失败，请检查验证码");
      }
      const fresh = await refreshAuthAccount();
      if (fresh) setAccount(fresh);
      toast(`✅ 已登录 · ${fresh?.nickname ?? phone}（真实身份）`, "success");
      beginDismiss();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "验证失败");
    } finally {
      setVerifying(false);
    }
  }

  async function handleLogout() {
    await clearAuthAccount();
    setAccount(null);
    setPhone("");
    setSmsSent(false);
    setSmsCode("");
    setFormError(null);
    toast("已退出登录 · 回到访客浏览", "success");
    beginDismiss();
  }

  function handleOpenChange(next: boolean) {
    if (!next) beginDismiss();
  }

  if (!open) return null;

  return (
    <div data-testid="auth-sheet">
      <style>{AUTH_SHEET_CSS}</style>
      <div
        className="auth-mask"
        onClick={() => handleOpenChange(false)}
        data-action="mask"
      />
      <div
        className={`auth-sheet${dismissing ? " auth-sheet-dismissing" : ""}`}
        role="dialog"
        aria-label="登录"
      >
        <div className="auth-grip" ref={gripDragRef as React.Ref<HTMLDivElement>} data-action="drag-grip" />

        <div className="auth-title">
          <h3 data-testid="auth-title">
            {account ? "切换 / 退出账号" : "登录 OTO 空间"}
          </h3>
          <button type="button" className="auth-close" data-action="close" onClick={() => handleOpenChange(false)}>
            ✕ 收起
          </button>
        </div>

        {account ? (
          <>
            <div className="auth-signed-in" data-testid="signed-in">
              <span style={{ fontSize: 20 }}>{account.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div className="auth-signed-in-name">{account.nickname}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", marginTop: 1 }}>
                  {ROLE_LABEL[account.role]} · 真实身份
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="auth-primary auth-quit" style={{ flex: 1 }} data-action="logout" onClick={handleLogout}>
                退出登录
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-body">
              <div data-testid="tab-phone">
                <div className="auth-phone-row">
                  <input
                    className="auth-input"
                    name="auth-phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="11 位手机号"
                    aria-label="手机号"
                    data-testid="phone-input"
                  />
                  <button
                    type="button"
                    className="auth-primary"
                    disabled={!phoneValid || sending || countdown > 0}
                    data-action="send-sms"
                    onClick={handleSendSms}
                  >
                    {countdown > 0 ? `${countdown}s 后重发` : sending ? "发送中…" : smsSent ? "重新发送" : "发送验证码"}
                  </button>
                </div>
                {smsSent && (
                  <input
                    className="auth-input"
                    name="auth-sms-code"
                    style={{ marginTop: 8 }}
                    inputMode="numeric"
                    maxLength={6}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6 位短信验证码"
                    aria-label="验证码"
                    data-testid="sms-input"
                  />
                )}
                <button
                  type="button"
                  className="auth-primary"
                  style={{ width: "100%", marginTop: 12 }}
                  disabled={!smsSent || smsCode.length !== 6 || verifying}
                  data-action="phone-login"
                  onClick={handlePhoneLogin}
                >
                  {verifying ? "验证中…" : smsSent ? "验证并登录" : "先发送验证码"}
                </button>
                {formError && (
                  <p className="auth-hint" data-testid="auth-error" style={{ color: "#fda4af" }}>
                    {formError}
                  </p>
                )}
                <p className="auth-hint">
                  真实短信验证，登录态全站通用。未登录可继续游客浏览。
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}