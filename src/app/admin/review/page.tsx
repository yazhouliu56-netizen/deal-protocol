"use client"

import { useState, useEffect } from "react"
import { useSession } from "@/components/SessionProvider"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface ReviewItem {
  id: string
  type: "protocol" | "provider_qualification"
  status: string
  category: string
  risk_tier?: string
  final_price?: number
  qualification_type?: string
  created_at: string
  user: { name: string; phone: string } | null
}

export default function AdminReviewPage() {
  const { user: session, loading: sessionLoading } = useSession()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject">("approve")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/review")
      if (!res.ok) throw new Error("加载失败")
      const data = await res.json()
      setItems(data.items ?? [])
    } catch {
      toast.error("加载审核列表失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.role !== "ADMIN") return
    fetchItems()
  }, [session])

  const handleAction = async () => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: actionId, itemType: items.find(i => i.id === actionId)?.type, action: actionType, reason }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error || "操作失败")
        return
      }
      toast.success(actionType === "approve" ? "已通过" : "已拒绝")
      setActionId(null)
      setReason("")
      fetchItems()
    } catch {
      toast.error("网络错误")
    } finally {
      setSubmitting(false)
    }
  }

  const getTypeLabel = (type: string) => {
    return type === "protocol" ? "协议" : "资质认证"
  }

  const getTypeBadge = (type: string) => {
    return type === "protocol"
      ? <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">协议</Badge>
      : <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">资质</Badge>
  }

  const getRiskBadge = (tier?: string) => {
    if (!tier) return null
    const map: Record<string, { label: string; color: string }> = {
      low: { label: "低风险", color: "bg-emerald-50 text-emerald-700 border-0 dark:bg-emerald-950/30 dark:text-emerald-400" },
      medium: { label: "中风险", color: "bg-amber-50 text-amber-700 border-0 dark:bg-amber-950/30 dark:text-amber-400" },
      high: { label: "高风险", color: "bg-rose-50 text-rose-700 border-0 dark:bg-rose-950/30 dark:text-rose-400" },
    }
    const c = map[tier] ?? { label: tier, color: "bg-gray-100" }
    return <Badge className={c.color}>{c.label}</Badge>
  }

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">审核队列</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">审核待确认的协议和服务者资质</p>
          </div>
          <Button variant="outline" onClick={fetchItems} disabled={loading} className="rounded-xl">
            刷新
          </Button>
        </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardContent className="py-16 text-center">
            <p className="text-lg text-slate-500 dark:text-zinc-400">暂无待审核项</p>
            <p className="mt-1 text-sm text-slate-400 dark:text-zinc-500">所有协议和资质都已处理完毕</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="rounded-2xl border-slate-200/60 transition-all hover:shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      {getTypeBadge(item.type)}
                      {item.type === "protocol" && getRiskBadge(item.risk_tier)}
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">分类</span>
                        <p className="mt-0.5 font-medium text-slate-900 dark:text-zinc-100">{item.category}</p>
                      </div>
                      {item.type === "provider_qualification" && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">资质类型</span>
                          <p className="mt-0.5 font-medium text-slate-900">{item.qualification_type}</p>
                        </div>
                      )}
                      {item.final_price != null && (
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">金额</span>
                          <p className="mt-0.5 font-medium text-slate-900 dark:text-zinc-100 tabular-nums">¥{item.final_price.toFixed(2)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">提交时间</span>
                        <p className="mt-0.5 font-medium text-slate-900 dark:text-zinc-100">{new Date(item.created_at).toLocaleString("zh-CN")}</p>
                      </div>
                    </div>

                    {item.user && (
                      <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {item.user.name} ({item.user.phone})
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Dialog
                      open={actionId === item.id && actionType === "approve"}
                      onOpenChange={(open) => {
                        if (open) { setActionId(item.id); setActionType("approve"); setReason("") }
                        else setActionId(null)
                      }}
                    >
                      <DialogTrigger render={<Button variant="default" size="sm" className="rounded-lg" />}>
                        通过
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认通过</DialogTitle>
                          <DialogDescription>
                            {getTypeLabel(item.type)} - {item.category}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">备注（可选）</label>
                            <Textarea
                              placeholder="填写通过备注..."
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              rows={2}
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setActionId(null)} className="rounded-xl">取消</Button>
                          <Button onClick={handleAction} disabled={submitting} className="rounded-xl">
                            {submitting ? "处理中..." : "确认通过"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={actionId === item.id && actionType === "reject"}
                      onOpenChange={(open) => {
                        if (open) { setActionId(item.id); setActionType("reject"); setReason("") }
                        else setActionId(null)
                      }}
                    >
                      <DialogTrigger render={<Button variant="destructive" size="sm" className="rounded-lg" />}>
                        拒绝
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>确认拒绝</DialogTitle>
                          <DialogDescription>
                            {getTypeLabel(item.type)} - {item.category}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">拒绝原因 <span className="text-destructive">*</span></label>
                            <Textarea
                              placeholder="请填写拒绝原因..."
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              rows={3}
                              className="rounded-xl"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setActionId(null)} className="rounded-xl">取消</Button>
                          <Button variant="destructive" onClick={handleAction} disabled={submitting || !reason.trim()} className="rounded-xl">
                            {submitting ? "处理中..." : "确认拒绝"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </>
  )
}
