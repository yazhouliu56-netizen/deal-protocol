"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/components/SessionProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, Trash2, Users } from "lucide-react"

interface TeamSlotInput {
  roleDesc: string
  requiredSkills: string
  reward: string
}

export default function CreateTeamPage() {
  const { user: session, loading } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<'describe' | 'confirm'>('describe')
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [structuring, setStructuring] = useState(false)
  const [teamSlots, setTeamSlots] = useState<TeamSlotInput[]>([
    { roleDesc: "", requiredSkills: "", reward: "" },
  ])
  const [totalBudget, setTotalBudget] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !session) router.push("/login")
  }, [session, loading, router])

  function addSlot() {
    setTeamSlots([...teamSlots, { roleDesc: "", requiredSkills: "", reward: "" }])
  }

  function removeSlot(idx: number) {
    if (teamSlots.length <= 1) return
    setTeamSlots(teamSlots.filter((_, i) => i !== idx))
  }

  function updateSlot(idx: number, field: keyof TeamSlotInput, value: string) {
    const updated = [...teamSlots]
    updated[idx] = { ...updated[idx], [field]: value }
    setTeamSlots(updated)
  }

  async function handleStructure() {
    if (!description.trim()) return
    setStructuring(true)
    try {
      const res = await fetch("/api/llm/structure-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })
      if (!res.ok) throw new Error("LLM structuring failed")
      const data = await res.json()
      setCategory(data.category ?? "")
      setTotalBudget(data.totalBudget?.toString() ?? "")
      if (data.roles && Array.isArray(data.roles)) {
        setTeamSlots(data.roles.map((r: { roleDesc: string; requiredSkills: string[]; reward: number }) => ({
          roleDesc: r.roleDesc ?? "",
          requiredSkills: (r.requiredSkills ?? []).join(", "),
          reward: r.reward?.toString() ?? "",
        })))
      }
      setStep('confirm')
    } catch {
      setStructuring(false)
    }
    setStructuring(false)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/team/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          totalBudget: Number(totalBudget),
          teamRequests: teamSlots.map((s) => ({
            roleDesc: s.roleDesc,
            requiredSkills: s.requiredSkills.split(",").map((sk) => sk.trim()).filter(Boolean),
            reward: Number(s.reward),
          })),
        }),
      })
      if (!res.ok) throw new Error("Failed to create team protocol")
      const data = await res.json()
      if (data.protocolId) {
        router.push(`/team/${data.protocolId}`)
      }
    } catch {
      setSubmitting(false)
    }
    setSubmitting(false)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
      </div>
    </div>
  )
}

  if (step === 'describe') {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">组队接单</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-500">描述项目需求，招募队友一起完成</p>
          </div>
        </div>

        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-base text-slate-900 dark:text-zinc-100">描述项目</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">项目描述</label>
              <Textarea
                placeholder="例如：我需要3个人帮我做一个社区团购小程序，包含前端开发、后端开发和UI设计..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>
            <div>
              <label className="text-sm font-medium">品类</label>
              <Input
                placeholder="例如：软件开发"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-500">系统会根据您的描述自动提取角色、技能和报酬信息</p>
            <Button className="rounded-xl" onClick={handleStructure} disabled={structuring || !description.trim()}>
              {structuring && <Loader2 className="size-4 mr-2 animate-spin" />}
              智能解析
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">确认组队方案</h1>
            <p className="text-sm text-slate-500 dark:text-zinc-500">检查并完善团队角色信息</p>
          </div>
        </div>

        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900 mb-4">
        <CardHeader>
          <CardTitle className="text-base text-slate-900 dark:text-zinc-100">项目概览</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-zinc-500">{description}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary">{category}</Badge>
            <span className="text-sm text-slate-500 dark:text-zinc-500">总预算 ¥{totalBudget}</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {teamSlots.map((slot, idx) => (
          <Card className="rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900" key={idx}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">角色 #{idx + 1}</span>
                {teamSlots.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeSlot(idx)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <Input
                placeholder="角色描述，例如：前端开发"
                value={slot.roleDesc}
                onChange={(e) => updateSlot(idx, 'roleDesc', e.target.value)}
              />
              <Input
                placeholder="所需技能，逗号分隔，例如：React, TypeScript, Tailwind"
                value={slot.requiredSkills}
                onChange={(e) => updateSlot(idx, 'requiredSkills', e.target.value)}
              />
              <Input
                type="number"
                placeholder="每人报酬 (¥)"
                value={slot.reward}
                onChange={(e) => updateSlot(idx, 'reward', e.target.value)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button variant="outline" className="rounded-xl" onClick={addSlot}>
          <Plus className="size-4 mr-1" /> 添加角色
        </Button>
        <Button variant="ghost" className="rounded-xl" onClick={() => setStep('describe')}>
          返回修改
        </Button>
      </div>

      <div className="mt-6 flex justify-end">
        <Button className="rounded-xl" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
          发布组队
        </Button>
      </div>
      </div>
    </div>
  )
}
