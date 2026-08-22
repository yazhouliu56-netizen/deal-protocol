"use client";
import { useEffect, useState } from "react";
import { useDragToDismiss } from "@/base/platform/useDragToDismiss";
import { lockEdgeGesture } from "@/components/oto-ui/edgeGestureLock";
import { toast } from "@/base/platform/toast";

/**
 * OTO 前庭登录抽屉（方案 A）：.oto-app 空间毛玻璃半屏 drawer。
 * - 三通道：手机号验证码 / 一键演示角色 / Web3 钱包（演示沙盒）。
 * - useDragToDismiss：顶部把手下拉 >35% 平滑收起（PWA 原生手感）。
 * - 登录态持久化 localStorage（AUTH_ACCOUNT_KEY），并广播 `oto:auth-changed`
 *   供 ProfilePage 等前台消费方即时刷新（对齐 oto:env-info 事件模式）。
 * - 老版 /login 保留为后台与协议管理专区备用通道，前台绝不整页跳出。
 *
 * ## 六圈定位声明
 * - 所属圈：第 1 圈（触达 L1-M1 用户体验与触达）
 * - 所属模块：L1-M1 身份与登录触达
 * - 复用底座：base/platform/useDragToDismiss（下拉手势判定，零业务依赖红线 3）
 * - 弹药表：无（演示沙盒身份，不承载业务字段）
 *
 * ## 宪法条文对照
 * - 命中条文：#9 先问旅程再写界面（登录旅程 = 访客 → 三通道选一 → 即时生效角色）；
 *   降级演示沙盒（无真实短信/链上，宪法 #10 显式本地降级）。
 * - 偏离条文：无
 */

export const AUTH_ACCOUNT_KEY = "oto-auth-account";

export type AuthRole = "employer" | "provider" | "host";
export type AuthMethod = "phone" | "demo" | "wallet";

export interface AuthAccount {
  nickname: string;
  emoji: string;
  role: AuthRole;
  method: AuthMethod;
  at: number;
}

/** 演示沙盒固定验证码（纯本地模拟，无真实短信）。 */
export const DEMO_SMS_CODE = "1234";

export const AUTH_OPEN_EVENT = "oto:auth-open";
export const AUTH_CHANGED_EVENT = "oto:auth-changed";

const DEMO_ACCOUNTS: { label: string; emoji: string; role: AuthRole }[] = [
  { label: "雇主 Alex", emoji: "🧑‍💼", role: "employer" },
  { label: "服务者 · 王姐", emoji: "🧹", role: "provider" },
  { label: "组局主理人 · 阿强", emoji: "🎯", role: "host" },
];

const ROLE_LABEL: Record<AuthRole, string> = {
  employer: "需求方 · 雇主",
  provider: "响应者 · 服务者",
  host: "组局主理人",
};

export function readAuthAccount(): AuthAccount | null {
  try {
    const raw = window.localStorage.getItem(AUTH_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthAccount;
    if (!parsed || typeof parsed.nickname !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAuthAccount(account: AuthAccount) {
  window.localStorage.setItem(AUTH_ACCOUNT_KEY, JSON.stringify(account));
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAuthAccount() {
  window.localStorage.removeItem(AUTH_ACCOUNT_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

/** 前台任意位置呼出登录抽屉（无整页跳转）。 */
export function openAuthSheet() {
  window.dispatchEvent(new Event(AUTH_OPEN_EVENT));
}

type AuthTab = "phone" | "demo" | "wallet";

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

/** 登录抽屉（半屏毛玻璃 · 三通道演示登录 · 下拉手势收起）。 */
export default function AuthSheet() {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [tab, setTab] = useState<AuthTab>("phone");
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [phone, setPhone] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddr, setWalletAddr] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);

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

  // 全局呼出（oto:auth-open）与登录态变更（oto:auth-changed）
  useEffect(() => {
    const onOpen = () => {
      setAccount(readAuthAccount());
      setOpen(true);
    };
    const onChanged = () => setAccount(readAuthAccount());
    window.addEventListener(AUTH_OPEN_EVENT, onOpen);
    window.addEventListener(AUTH_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(AUTH_OPEN_EVENT, onOpen);
      window.removeEventListener(AUTH_CHANGED_EVENT, onChanged);
    };
  }, []);

  function commit(account: AuthAccount) {
    writeAuthAccount(account);
    setAccount(account);
    toast(`✅ 已登录 · ${account.nickname}（${ROLE_LABEL[account.role]}）`, "success");
    beginDismiss();
  }

  function handleSendSms() {
    if (!/^1\d{10}$/.test(phone)) return;
    setSmsSent(true);
    toast(`📨 演示验证码：${DEMO_SMS_CODE}（沙盒环境，无真实短信）`, "success");
  }

  function handlePhoneLogin() {
    if (!/^1\d{10}$/.test(phone) || smsCode !== DEMO_SMS_CODE) return;
    commit({ nickname: phone.slice(0, 3) + "****" + phone.slice(-4), emoji: "📱", role: "employer", method: "phone", at: Date.now() });
  }

  function connectWallet() {
    if (walletBusy) return;
    setWalletBusy(true);
    window.setTimeout(() => {
      const addr = "0x" + Array.from({ length: 40 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      setWalletAddr(addr);
      setWalletConnected(true);
      setWalletBusy(false);
    }, 700);
  }

  function handleWalletLogin() {
    if (!walletConnected) return;
    commit({
      nickname: `${walletAddr.slice(0, 6)}…${walletAddr.slice(-4)}`,
      emoji: "🛡️",
      role: "employer",
      method: "wallet",
      at: Date.now(),
    });
  }

  function handleLogout() {
    clearAuthAccount();
    setAccount(null);
    setWalletConnected(false);
    setWalletAddr("");
    setPhone("");
    setSmsSent(false);
    setSmsCode("");
    toast("已退出登录 · 回到访客本地模式", "success");
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
                  {ROLE_LABEL[account.role]} ·{" "}
                  {account.method === "phone" ? "手机号" : account.method === "wallet" ? "Web3 钱包" : "演示账号"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="auth-primary" style={{ flex: 1 }} data-action="switch-account" onClick={() => { setAccount(null); setTab("demo"); }}>
                切换账号
              </button>
              <button type="button" className="auth-primary auth-quit" data-action="logout" onClick={handleLogout}>
                退出登录
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-tabs" role="tablist">
              {(
                [
                  { id: "phone", label: "📱 手机号" },
                  { id: "demo", label: "✨ 演示账号" },
                  { id: "wallet", label: "🛡️ Web3 钱包" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`auth-tab${tab === t.id ? " auth-tab-active" : ""}`}
                  data-action={`tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="auth-body">
              {tab === "phone" && (
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
                      disabled={!/^1\d{10}$/.test(phone) || smsSent}
                      data-action="send-sms"
                      onClick={handleSendSms}
                    >
                      {smsSent ? "已发送" : "发送验证码"}
                    </button>
                  </div>
                  {smsSent && (
                    <input
                      className="auth-input"
                      name="auth-sms-code"
                      style={{ marginTop: 8 }}
                      inputMode="numeric"
                      maxLength={4}
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                      placeholder={`验证码（演示 ${DEMO_SMS_CODE}）`}
                      aria-label="验证码"
                      data-testid="sms-input"
                    />
                  )}
                  <button
                    type="button"
                    className="auth-primary"
                    style={{ width: "100%", marginTop: 12 }}
                    disabled={!smsSent || smsCode !== DEMO_SMS_CODE}
                    data-action="phone-login"
                    onClick={handlePhoneLogin}
                  >
                    {smsSent ? "登录" : "先发送验证码"}
                  </button>
                  <p className="auth-hint">
                    演示沙盒：验证码固定为 <b>{DEMO_SMS_CODE}</b>，无真实短信发送。手机号仅作昵称脱敏展示，不写入广播身份。
                  </p>
                </div>
              )}

              {tab === "demo" && (
                <div className="auth-demo-grid" data-testid="tab-demo">
                  {DEMO_ACCOUNTS.map((d) => (
                    <button
                      key={d.role}
                      type="button"
                      className="auth-demo-item"
                      data-action={`demo-${d.role}`}
                      onClick={() =>
                        commit({ nickname: d.label, emoji: d.emoji, role: d.role, method: "demo", at: Date.now() })
                      }
                    >
                      <span className="auth-demo-emoji">{d.emoji}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="auth-demo-label">{d.label}</span>
                        <span className="auth-demo-role" style={{ display: "block" }}>
                          {ROLE_LABEL[d.role]} · 一键直达
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {tab === "wallet" && (
                <div data-testid="tab-wallet">
                  <div className="auth-wallet-box">
                    {walletConnected ? (
                      <>
                        <span style={{ fontSize: 26 }}>🛡️</span>
                        <span className="auth-wallet-id" data-testid="wallet-addr">
                          {walletAddr.slice(0, 6)}…{walletAddr.slice(-4)}
                        </span>
                        <span style={{ fontSize: 10.5, color: "#4ade80", fontWeight: 700 }}>
                          ✓ 已连接
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 26 }}>⛓️</span>
                        <span className="auth-wallet-id">MetaMask / WalletConnect 演示连接</span>
                        <button
                          type="button"
                          className="auth-primary"
                          disabled={walletBusy}
                          data-action="connect-wallet"
                          onClick={connectWallet}
                        >
                          {walletBusy ? "连接中…" : "连接钱包"}
                        </button>
                      </>
                    )}
                  </div>
                  {walletConnected && (
                    <button
                      type="button"
                      className="auth-primary"
                      style={{ width: "100%", marginTop: 12 }}
                      data-action="wallet-login"
                      onClick={handleWalletLogin}
                    >
                      使用钱包登录
                    </button>
                  )}
                  <p className="auth-hint">
                    演示环境：连接为本地模拟地址，不触发真实链上交互；钱包身份仅脱敏展示。
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}