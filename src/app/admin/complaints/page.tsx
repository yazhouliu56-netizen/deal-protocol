"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/components/SessionProvider"
import { toast } from "@/base/platform/toast";
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface EvidenceRecord {
  id: string
  event_type: string
  payload: Record<string, unknown>
  captured_by: string | null
  created_at: string
  hash: string | null
  prev_hash: string | null
}

interface Complaint {
  id: string
  protocol_id: string | null
  order_id: string | null
  event_type: string
  payload: Record<string, unknown>
  payload_ref: string | null
  captured_by: string | null
  hash: string | null
  prev_hash: string | null
  created_at: string
  protocol: { id: string; category: string; status: string } | null
  order: { id: string; status: string; amount: number } | null
  complainant: { id: string; name: string } | null
  evidence_chain: EvidenceRecord[]
}

const ACTION_CONFIG: Record<string, { label: string; btnClass: string; variant: "default" | "destructive" | "outline" }> = {
  dismiss: { label: "驳回举报", btnClass: "bg-gray-500 hover:bg-gray-600", variant: "outline" },
  warn: { label: "警告用户", btnClass: "bg-amber-500 hover:bg-amber-600 text-white", variant: "default" },
  suspend: { label: "暂停服务", btnClass: "bg-rose-500 hover:bg-rose-600 text-white", variant: "default" },
  ban: { label: "封禁账号", btnClass: "bg-red-600 hover:bg-red-700 text-white", variant: "default" },
}

export default function AdminComplaintsPage() {
  const { user: session } = useSession()
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<string>("dismiss")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchComplaints = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/complaints")
      if (!res.ok) throw new Error("加载失败")
      const data = await res.json()
      setComplaints(data.complaints ?? [])
    } catch {
      toast("加载举报列表失败", "error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.role !== "ADMIN") return
    const init = async () => {
      await fetchComplaints()
    }
    init()
  }, [session, fetchComplaints])

  const handleAction = async () => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId: actionId, action: actionType, reason }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast(d.error || "操作失败", "error")
        return
      }
      toast("处理完成", "success")
      setActionId(null)
      setReason("")
      fetchComplaints()
    } catch {
      toast("网络错误", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const getEventTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      complaint: "用户举报",
      sos: "SOS 求助",
      protocol_created: "协议创建",
      admin_verdict: "管理员裁决",
      review_action: "审核操作",
      location_ping: "位置共享",
    }
    return map[type] ?? type
  }

  const getEventBadge = (type: string) => {
    const map: Record<string, string> = {
      complaint: "bg-rose-50 text-rose-700 border-0",
      sos: "bg-rose-50 text-rose-700 border-0",
      protocol_created: "bg-emerald-50 text-emerald-700 border-0",
      admin_verdict: "bg-purple-50 text-purple-700 border-0",
      review_action: "bg-cyan-50 text-cyan-700 border-0",
      location_ping: "bg-gray-50 text-gray-700 border-0",
    }
    return map[type] ?? "bg-gray-50 text-gray-700 border-0"
  }

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">举报处理</h1>
            <p className="mt-1 text-slate-500">查看举报证据链并作出处理决定</p>
          </div>
        <Button variant="outline" onClick={fetchComplaints} disabled={loading} className="rounded-xl">
          刷新
        </Button>
        </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      ) : complaints.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200/60">
          <CardContent className="py-16 text-center">
            <p className="text-lg text-slate-500">暂无举报</p>
            <p className="mt-1 text-sm text-slate-500">所有举报都已处理完毕</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {complaints.map((complaint) => (
            <Card key={complaint.id} className="rounded-2xl border border-slate-200/60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-rose-50 text-rose-700 border-0">举报</Badge>
                      <span className="text-sm text-slate-500">
                        {new Date(complaint.created_at).toLocaleString("zh-CN")}
                      </span>
                    </div>

                    <div className="text-sm">
                      <span className="text-xs text-slate-500/60">举报人：</span>
                      {complaint.complainant?.name ?? "未知"}
                    </div>

                    {complaint.protocol && (
                      <div className="text-sm">
                        <span className="text-xs text-slate-500/60">关联协议：</span>
                        {complaint.protocol.category}（{complaint.protocol.status}）
                      </div>
                    )}

                    <div className="rounded-md bg-slate-200 p-3 text-xs">
                      {Object.entries(complaint.payload).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="min-w-[100px] font-medium text-slate-700">{k}:</span>
                          <span className="text-slate-500">{typeof v === "string" ? v : JSON.stringify(v)}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="text-sm text-indigo-600 hover:underline"
                      onClick={() => setExpandedId(expandedId === complaint.id ? null : complaint.id)}
                    >
                      {expandedId === complaint.id ? "收起证据链" : `查看证据链（${complaint.evidence_chain.length} 条记录）`}
                    </button>

                    {expandedId === complaint.id && (
                      <div className="space-y-2 pl-2 border-l-2 border-slate-400/20">
                        {complaint.evidence_chain.map((ev) => (
                          <div key={ev.id} className="rounded-md bg-slate-200/50 p-2 text-xs">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={getEventBadge(ev.event_type)}>
                                {getEventTypeLabel(ev.event_type)}
                              </Badge>
                              <span className="text-slate-500">
                                {new Date(ev.created_at).toLocaleString("zh-CN")}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {Object.entries(ev.payload).map(([k, v]) => (
                                <div key={k} className="flex gap-1">
                                  <span className="font-medium text-slate-600">{k}:</span>
                                  <span>{typeof v === "string" ? v : JSON.stringify(v)}</span>
                                </div>
                              ))}
                            </div>
                            {ev.hash && (
                              <div className="mt-1 font-mono text-xs text-slate-500/60">
                                hash: {ev.hash.slice(0, 16)}...
                                {ev.prev_hash !== "GENESIS" && ev.prev_hash && <> | prev: {ev.prev_hash.slice(0, 16)}...</>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 ml-4">
                    {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                      <Button
                        key={key}
                        variant={cfg.variant as "default" | "destructive" | "outline"}
                        size="sm"
                        className={cn("rounded-xl", cfg.btnClass)}
                        onClick={() => {
                          setActionId(complaint.id)
                          setActionType(key)
                          setReason("")
                        }}
                      >
                        {cfg.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </div>

      {actionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <h3 className="font-medium mb-2 text-slate-900">
              {ACTION_CONFIG[actionType]?.label ?? actionType}
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              举报 ID: {actionId.slice(0, 8)}...
            </p>
            <div className="space-y-1 mb-3">
              <label className="text-sm font-medium">处理说明 <span className="text-destructive">*</span></label>
              <Textarea
                placeholder="请填写处理说明..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => { setActionId(null); setReason("") }}>
                取消
              </Button>
              <Button
                variant={actionType === "dismiss" ? "outline" : "destructive"}
                className="rounded-xl"
                onClick={handleAction}
                disabled={submitting || !reason.trim()}
              >
                {submitting ? "处理中..." : "确认处理"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
