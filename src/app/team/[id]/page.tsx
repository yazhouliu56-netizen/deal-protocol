"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "@/components/SessionProvider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import toast from "react-hot-toast"
import { Loader2, Users, DollarSign, Wrench } from "lucide-react"

interface TeamMember {
  requestId: string
  providerId: string
  roleDesc: string
  reward: number
  skills: string[]
}

interface TeamPageInfo {
  protocolId: string
  leader: { id: string; nickname: string | null }
  members: TeamMember[]
  openRequests: {
    id: string
    roleDesc: string
    requiredSkills: string[]
    reward: number
  }[]
}

export default function TeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user: session } = useSession()
  const [info, setInfo] = useState<TeamPageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const protocolId = params.id as string

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const res = await fetch(`/api/team/${protocolId}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setInfo(data)
      } catch {
        router.push("/")
      }
    }
    fetchTeam().finally(() => setLoading(false))
  }, [protocolId, router])

  async function handleJoin(requestId: string) {
    if (!session) return
    setJoining(requestId)
    try {
      const res = await fetch("/api/team/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, providerId: session.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "加入失败")
      toast.success("已成功加入团队")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加入团队失败")
    } finally {
      setJoining(null)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  }

  if (!info) return null

  const isLeader = session?.id === info.leader.id

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
      <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900 mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Users className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl text-slate-900 dark:text-zinc-100">团队详情</CardTitle>
              <p className="text-sm text-slate-500 dark:text-zinc-500">发起人：{info.leader.nickname ?? "未知"}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isLeader && info.openRequests.length > 0 && (
        <Card className="rounded-2xl border border-dashed border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900 mb-6">
          <CardHeader>
            <CardTitle className="text-base text-slate-900 dark:text-zinc-100">待招募</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {info.openRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div>
                  <p className="font-medium">{req.roleDesc}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-zinc-500">
                    <span className="flex items-center gap-1">
                      <DollarSign className="size-3" /> ¥{req.reward}
                    </span>
                    {req.requiredSkills.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Wrench className="size-3" /> {req.requiredSkills.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary">招募中</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {info.members.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">团队成员</h2>
          {info.members.map((m) => (
            <Card key={m.requestId} className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{m.roleDesc}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-zinc-500">
                    <span className="flex items-center gap-1">
                      <DollarSign className="size-3" /> ¥{m.reward}
                    </span>
                    {m.skills.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Wrench className="size-3" /> {m.skills.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <Badge>已加入</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="size-12 text-slate-500/40 dark:text-zinc-500/40 mb-3" />
          <p className="text-lg font-medium text-slate-900 dark:text-zinc-100">暂无团队成员</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">等待服务者加入</p>
        </div>
      )}

      {!isLeader && info.openRequests.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">加入团队</h2>
          {info.openRequests.map((req) => (
            <Card key={req.id} className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{req.roleDesc}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-zinc-500">
                    <span>¥{req.reward}</span>
                    {req.requiredSkills.length > 0 && (
                      <span>{req.requiredSkills.join(", ")}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => handleJoin(req.id)}
                  disabled={joining === req.id}
                >
                  {joining === req.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "加入团队"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
