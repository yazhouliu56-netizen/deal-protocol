"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getBrowserSupabase } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"


export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error: authError } = await getBrowserSupabase().auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message === "Invalid login credentials"
        ? "邮箱或密码错误"
        : authError.message === "Email not confirmed"
          ? "邮箱未验证，请检查收件箱"
          : authError.message
      )
      setLoading(false)
      return
    }

    router.refresh()
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-slate-50 px-4 py-12 dark:bg-zinc-950">
      <Card className="w-full max-w-sm rounded-2xl border-slate-200/60 shadow-sm dark:border-zinc-800/60">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-2 flex items-center justify-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white shadow-sm">dp</span>
            <span className="text-sm font-semibold text-foreground">deal<span className="text-indigo-600">-protocol</span></span>
          </Link>
          <CardTitle className="text-xl">登录</CardTitle>
          <CardDescription>欢迎回来，登录您的账户</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">邮箱</label>
              <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="rounded-xl border-slate-200/60 transition-all focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:border-zinc-800/60" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">密码</label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="rounded-xl border-slate-200/60 transition-all focus-visible:ring-indigo-500 focus-visible:border-indigo-500 dark:border-zinc-800/60" />
            </div>
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            还没有账户？{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">注册</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
