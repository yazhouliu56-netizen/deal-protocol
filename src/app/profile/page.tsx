"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/components/SessionProvider"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useCountUp } from "@/lib/use-count-up"
import {
  Crown, Shield, UserCheck, Wallet, ChevronRight, CircleDashed,
} from "lucide-react"

interface UserProfile {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  roles: string
  credit_score: number
  balance: number
  created_at: string
  bio?: string
  skills?: string | string[]
  service_areas?: string
  avatar_url?: string
}

function getCreditLevel(score: number) {
  if (score >= 200) return { label: "优秀", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" }
  if (score >= 150) return { label: "良好", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" }
  if (score >= 100) return { label: "一般", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" }
  return { label: "待提升", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" }
}

const VERIFICATION_ITEMS = [
  { key: "identity", icon: UserCheck, label: "身份核验", done: true },
  { key: "face", icon: Shield, label: "人脸识别", done: true },
  { key: "wallet", icon: Wallet, label: "数字钱包绑定", done: true },
]

const BILLING_HISTORY = [
  { id: "1", label: "空调维修服务", amount: 120, status: "settled", date: "2026-07-08" },
  { id: "2", label: "厨房水池疏通", amount: 200, status: "held", date: "2026-07-07" },
  { id: "3", label: "马桶疏通", amount: 80, status: "settled", date: "2026-07-06" },
  { id: "4", label: "电路检修更换开关", amount: 150, status: "held", date: "2026-07-05" },
  { id: "5", label: "热水器维修保养", amount: 350, status: "settled", date: "2026-07-04" },
]

const STATUS_STYLES: Record<string, { label: string; dot: string }> = {
  held: { label: "托管中", dot: "bg-indigo-500" },
  settled: { label: "已结算", dot: "bg-emerald-500" },
}

function ProfileCreditDisplay({ score }: { score: number }) {
  const count = useCountUp(score)
  return (
    <motion.span
      key={count}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-4xl font-black text-slate-900 tabular-nums dark:text-zinc-100"
    >
      {count}
    </motion.span>
  )
}

export default function ProfilePage() {
  const { user: session, loading: status } = useSession()
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)

  const [bio, setBio] = useState("")
  const [skillsInput, setSkillsInput] = useState("")
  const [serviceAreas, setServiceAreas] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    if (!status && !session) router.replace("/login")
  }, [session, status, router])

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile")
      if (!res.ok) throw new Error("Failed to fetch profile")
      const data = await res.json()
      setProfile(data.user)
      setName(data.user.name)
      setPhone(data.user.phone ?? "")
      setBio(data.user.bio ?? "")
      const existingSkills: string[] = data.user.skills
        ? (typeof data.user.skills === "string" ? JSON.parse(data.user.skills) : data.user.skills)
        : []
      setSkillsInput(existingSkills.join(", "))
      setServiceAreas(data.user.service_areas ?? "")
    } catch {
      toast.error("加载个人信息失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) fetchProfile()
  }, [session, fetchProfile])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "保存失败")
      setProfile(data.user)
      toast.success("个人信息已更新")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致")
      return
    }
    if (newPassword.length < 6) {
      toast.error("新密码长度至少为6位")
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "修改失败")
      toast.success("密码已修改")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "修改失败")
    } finally {
      setChangingPassword(false)
    }
  }

  if (status || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mx-auto mb-8 h-40 w-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-zinc-800" />
        <div className="grid gap-6">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
        </div>
      </div>
    )
  }

  if (!profile) return null

  const userRoles: string[] = profile.roles
    ? JSON.parse(profile.roles)
    : [profile.role || "CUSTOMER"]
  const isProvider = userRoles.includes("PROVIDER")
  const isCustomer = userRoles.includes("CUSTOMER")
  const isDualIdentity = isProvider && isCustomer
  const roleLabels = [
    isProvider && "服务商",
    isCustomer && "客户",
  ].filter(Boolean) as string[]

  const creditLevel = getCreditLevel(profile.credit_score)
  const escrowAmount = 650
  const withdrawnAmount = 2840

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {/* ══════ Top: Credit Score Hero ══════ */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
          <Crown className="size-8 text-white" />
        </div>
        <div className="flex items-baseline justify-center gap-2">
          <ProfileCreditDisplay score={profile.credit_score} />
          <span className="text-lg text-slate-400 dark:text-zinc-500">/ 300</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-3">
          <Badge className={cn("border-0 px-3 py-1 text-sm", creditLevel.color)}>
            👑 {creditLevel.label}
          </Badge>
          <span className="text-sm text-slate-500 dark:text-zinc-500">违约风险：极低</span>
        </div>
        <div className="mx-auto mt-4 h-2 w-64 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-700"
            style={{ width: `${Math.min((profile.credit_score / 300) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid gap-6">
        {/* ══════ Asset Overview ══════ */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">在途托管资金</p>
            <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums dark:text-zinc-100">
              ¥{escrowAmount.toLocaleString()}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <span className="text-xs text-indigo-600 dark:text-indigo-400">等待服务完成</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">已提现金额</p>
            <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums dark:text-zinc-100">
              ¥{withdrawnAmount.toLocaleString()}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400">可继续提现</span>
            </div>
          </div>
        </div>

        {/* ══════ Verification Status ══════ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">认证状态</CardTitle>
            <CardDescription>全部认证已完成，享受最高信用额度</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {VERIFICATION_ITEMS.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/30 px-4 py-3 dark:border-emerald-900/30 dark:bg-emerald-950/10"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
                  <item.icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{item.label}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">已认证</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ══════ Billing History ══════ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">资金流水</CardTitle>
            <CardDescription>最近 5 笔交易记录</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {BILLING_HISTORY.map((bill, i) => {
              const st = STATUS_STYLES[bill.status] ?? { label: bill.status, dot: "bg-slate-400" }
              return (
                <div key={bill.id}>
                  {i > 0 && <div className="my-1 border-t border-slate-100 dark:border-zinc-800" />}
                  <div className="flex items-center justify-between py-1.5">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100">{bill.label}</p>
                      <p className="text-xs text-slate-400 dark:text-zinc-500">{bill.date}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums dark:text-zinc-100">
                        ¥{bill.amount}
                      </span>
                      <div className="flex items-center gap-1">
                        <div className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />
                        <span className="text-xs text-slate-500 dark:text-zinc-400">{st.label}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* ══════ Edit Profile ══════ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">个人信息</CardTitle>
            <CardDescription>修改您的姓名和联系方式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">姓名</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入姓名" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">邮箱</label>
                <Input value={profile.email} disabled className="bg-muted text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">手机号</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="请输入手机号" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ══════ Provider Section ══════ */}
        {isProvider && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">服务商信息</CardTitle>
              <CardDescription>管理您的服务简介、技能标签和服务区域</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">个人简介</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="简单介绍您的服务经验..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">技能标签</label>
                  <Input value={skillsInput} onChange={(e) => setSkillsInput(e.target.value)} placeholder="如: 维修, 安装, 清洁 (用逗号分隔)" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">服务区域</label>
                  <Input value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} placeholder="如: 三里屯, 望京, 国贸" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={async () => {
                  const skills = skillsInput.split(",").map((s) => s.trim()).filter(Boolean)
                  const res = await fetch("/api/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bio, skills, service_areas: serviceAreas }),
                  })
                  if (res.ok) toast.success("服务商信息已更新")
                  else {
                    const err = await res.json()
                    toast.error(err.error || "保存失败")
                  }
                }}>
                  保存服务商信息
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════ Change Password ══════ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">修改密码</CardTitle>
            <CardDescription>密码长度至少为6位</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">当前密码</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="输入当前密码" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">新密码</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="输入新密码" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">确认新密码</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? "修改中..." : "修改密码"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
