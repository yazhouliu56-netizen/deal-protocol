"use client"

import { Suspense, useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Smartphone, Key, MessageCircle, Loader2 } from "lucide-react"
import toast from "react-hot-toast"

type TabId = "sms" | "password" | "wechat"

const TABS: { id: TabId; label: string; icon: typeof Smartphone }[] = [
  { id: "sms", label: "手机验证码", icon: Smartphone },
  { id: "password", label: "账号密码", icon: Key },
  { id: "wechat", label: "微信登录", icon: MessageCircle },
]

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabId>("sms")
  const [error, setError] = useState("")

  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("注册成功！请登录")
    }
  }, [searchParams])

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <Card className="w-full max-w-sm rounded-2xl border-zinc-200/60 shadow-sm dark:border-zinc-800/60">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-2 flex items-center justify-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white shadow-sm">dp</span>
            <span className="text-sm font-semibold text-foreground">deal<span className="text-indigo-600">-protocol</span></span>
          </Link>
          <CardTitle className="text-xl">登录</CardTitle>
          <CardDescription>欢迎回来，登录您的账户</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/50" role="tablist">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    tab === t.id
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {tab === "sms" && <SmsLoginForm onError={setError} />}
          {tab === "password" && <PasswordLoginForm onError={setError} />}
          {tab === "wechat" && <WechatLoginForm onError={setError} />}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-muted-foreground">加载中...</div>}>
      <LoginContent />
    </Suspense>
  )
}

/* ─── Tab 1: SMS Code Login ─── */
function SmsLoginForm({ onError }: { onError: (msg: string) => void }) {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isPhoneValid = /^1\d{10}$/.test(phone)

  const sendCode = useCallback(async () => {
    if (!isPhoneValid || sending) return
    setSending(true)
    onError("")
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) { onError(data.error || "发送失败"); return }
      setCodeSent(true)
      setCountdown(60)
      toast.success("验证码已发送")
    } catch {
      onError("网络错误，请重试")
    } finally {
      setSending(false)
    }
  }, [phone, isPhoneValid, sending, onError])

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => c - 1)
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [countdown])

  const verifyCode = useCallback(async () => {
    if (code.length !== 6 || verifying) return
    setVerifying(true)
    onError("")
    try {
      const res = await fetch("/api/auth/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      if (!res.ok) { onError(data.error || "验证失败"); return }
      window.location.href = "/dashboard"
    } catch {
      onError("网络错误，请重试")
    } finally {
      setVerifying(false)
    }
  }, [phone, code, verifying, onError])

  return (
    <form onSubmit={(e) => { e.preventDefault(); verifyCode() }} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="sms-phone" className="text-sm font-medium text-foreground">手机号</label>
        <div className="flex gap-2">
          <Input
            id="sms-phone"
            type="tel"
            inputMode="numeric"
            placeholder="请输入手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            maxLength={11}
            className="flex-1 rounded-xl border-zinc-200/60 transition-all focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:border-zinc-800/60"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!isPhoneValid || sending || countdown > 0}
            onClick={sendCode}
            className="shrink-0 rounded-xl text-xs touch-target"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : countdown > 0 ? `${countdown}s` : "发送验证码"}
          </Button>
        </div>
      </div>
      {codeSent && (
        <div className="space-y-2">
          <label htmlFor="sms-code" className="text-sm font-medium text-foreground">验证码</label>
          <Input
            id="sms-code"
            type="text"
            inputMode="numeric"
            placeholder="请输入6位验证码"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            autoComplete="one-time-code"
            className="rounded-xl border-zinc-200/60 text-center text-lg tracking-[0.5em] transition-all focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:border-zinc-800/60"
          />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={code.length !== 6 || verifying}>
        {verifying ? "验证中..." : "登录"}
      </Button>
    </form>
  )
}

/* ─── Tab 2: Password Login ─── */
function PasswordLoginForm({ onError }: { onError: (msg: string) => void }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError("")

    const { error: authError } = await getBrowserSupabase().auth.signInWithPassword({ email, password })
    if (authError) {
      onError(
        authError.message === "Invalid login credentials"
          ? "邮箱或密码错误"
          : authError.message === "Email not confirmed"
            ? "邮箱未验证，请检查收件箱"
            : authError.message
      )
      setLoading(false)
      return
    }

    window.location.href = "/dashboard"
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">邮箱</label>
        <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl border-zinc-200/60 transition-all focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:border-zinc-800/60" />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-foreground">密码</label>
        <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="rounded-xl border-zinc-200/60 transition-all focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:border-zinc-800/60" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "登录中..." : "登录"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        还没有账户？{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">注册</Link>
      </p>
    </form>
  )
}

/* ─── Tab 3: WeChat Login ─── */
function WechatLoginForm({ onError }: { onError: (msg: string) => void }) {
  const [loading, setLoading] = useState(false)

  const handleWechatLogin = async () => {
    setLoading(true)
    onError("")
    try {
      const res = await fetch("/api/auth/wechat", { method: "POST" })
      const data = await res.json()
      if (!res.ok) { onError(data.error || "微信登录失败"); return }
      if (data.url) {
        window.location.href = data.url
      } else {
        window.location.href = "/dashboard"
      }
    } catch {
      onError("网络错误，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-muted-foreground leading-relaxed">
        使用微信一键登录，无需记忆密码
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={handleWechatLogin}
        disabled={loading}
        className="w-full gap-3 rounded-xl py-6 text-sm font-semibold touch-target"
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <MessageCircle className="size-5 text-emerald-500" />
        )}
        微信一键登录
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        还没有账户？{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">注册</Link>
      </p>
    </div>
  )
}
