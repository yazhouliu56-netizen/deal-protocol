'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import toast from "react-hot-toast"
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { CheckCircle2, XCircle, Link2, FileText, Hash, Shield } from 'lucide-react'

interface EvidenceEntry {
  id: string
  protocol_id: string | null
  order_id: string | null
  event_type: string
  payload: Record<string, unknown>
  payload_ref: string | null
  captured_by: string | null
  hash: string
  prev_hash: string
  created_at: string
}

const eventLabels: Record<string, string> = {
  sos: 'SOS 紧急求助',
  location_ping: '位置上报',
  photo: '照片证据',
  chat_transcript: '聊天记录',
  audit: '内容审核',
  chat_flag: '聊天标记',
  report: '用户举报',
  rating: '服务评价',
  protocol_created: '协议创建',
  provider_assigned: '服务商分配',
  payment_confirmed: '支付确认',
  service_started: '服务开始',
  service_completed: '服务完成',
  dispute_opened: '纠纷开启',
  dispute_resolved: '纠纷解决',
  completion_confirmed: '完成确认',
  cancellation: '订单取消',
}

const eventTypeColors: Record<string, string> = {
  sos: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  location_ping: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  photo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  chat_transcript: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  audit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  chat_flag: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  report: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function getEventLabel(type: string): string {
  return eventLabels[type] ?? type
}

function getEventColor(type: string): string {
  return eventTypeColors[type] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`
}

function computeExpectedHash(record: EvidenceEntry, prevHash: string): string {
  const content = JSON.stringify({
    orderId: record.order_id ?? record.protocol_id,
    eventType: record.event_type,
    payload: record.payload,
    prevHash,
  })
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export default function EvidencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { user: session, loading: authStatus } = useSession()
  const [evidenceId, setEvidenceId] = useState<string | null>(null)
  const [entries, setEntries] = useState<EvidenceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [chainValid, setChainValid] = useState<boolean | null>(null)

  useEffect(() => {
    params.then(({ id }) => setEvidenceId(id))
  }, [params])

  useEffect(() => {
    if (!evidenceId) return
    let cancelled = false

    const fetchEvidence = async () => {
      try {
        const supabase = getBrowserSupabase()

        const [byProtocol, byOrder] = await Promise.all([
          supabase
            .from('evidence_log')
            .select('*')
            .eq('protocol_id', evidenceId)
            .order('created_at', { ascending: true }),
          supabase
            .from('evidence_log')
            .select('*')
            .eq('order_id', evidenceId)
            .order('created_at', { ascending: true }),
        ])

        const seen = new Map<string, EvidenceEntry>()
        for (const item of byProtocol.data ?? []) {
          seen.set(item.id, item as EvidenceEntry)
        }
        for (const item of byOrder.data ?? []) {
          if (!seen.has(item.id)) {
            seen.set(item.id, item as EvidenceEntry)
          }
        }

        const merged = Array.from(seen.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )

        if (!cancelled) {
          setEntries(merged)

          let valid = true
          for (let i = 0; i < merged.length; i++) {
            const prevHash = i === 0 ? 'GENESIS' : merged[i - 1].hash
            const expected = computeExpectedHash(merged[i], prevHash)
            if (merged[i].hash !== expected) {
              valid = false
              break
            }
            if (merged[i].prev_hash !== prevHash) {
              valid = false
              break
            }
          }
          setChainValid(valid)
        }
      } catch {
        if (!cancelled) toast.error('加载证据链失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchEvidence()
    return () => { cancelled = true }
  }, [evidenceId])

  useEffect(() => {
    if (!authStatus && !session) {
      router.push('/login')
    }
  }, [session, authStatus, router])

  if (authStatus || loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
      <nav className="mb-6 text-sm text-slate-500 dark:text-zinc-500">
        <Link href="/orders" className="hover:text-slate-900 dark:hover:text-zinc-100">我的订单</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900 dark:text-zinc-100">证据链</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">证据链</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
          订单编号：{evidenceId?.slice(0, 12)}...
        </p>
      </div>

      <div className="space-y-6">
        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-zinc-100">
                  <Shield className="size-4" />
                  链完整性验证
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-zinc-500">
                  基于哈希链的证据完整性校验
                </CardDescription>
              </div>
              {chainValid !== null && (
                <Badge
                  className={chainValid
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }
                >
                  {chainValid ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-3" />
                      链完整
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <XCircle className="size-3" />
                      链断裂
                    </span>
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-zinc-500">
              <span>共 {entries.length} 条记录</span>
              {chainValid === true && (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="size-3" />
                  所有哈希校验通过
                </span>
              )}
              {chainValid === false && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="size-3" />
                  哈希链完整性已被破坏
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {entries.length === 0 ? (
          <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
            <CardContent className="py-10 text-center text-slate-500 dark:text-zinc-500">
              暂无证据记录
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map((entry, idx) => {
              const prevHash = idx === 0 ? 'GENESIS' : entries[idx - 1].hash
              const expectedHash = computeExpectedHash(entry, prevHash)
              const hashOk = entry.hash === expectedHash && entry.prev_hash === prevHash
              const isFirst = idx === 0

              return (
                <Card key={entry.id} className={`rounded-2xl border ${hashOk ? 'border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900' : 'border-red-300 dark:border-red-800'}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-slate-500 dark:text-zinc-500">
                          {idx + 1}
                        </span>
                        <Badge className={getEventColor(entry.event_type)}>
                          {getEventLabel(entry.event_type)}
                        </Badge>
                      </div>
                      <time className="text-xs text-slate-500 dark:text-zinc-500">
                        {new Date(entry.created_at).toLocaleString('zh-CN')}
                      </time>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-4 text-xs">
                      <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-500">
                        <Hash className="size-3" />
                        <span className="font-mono">{truncateHash(entry.hash)}</span>
                      </div>
                      {!isFirst && (
                      <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-500">
                          <Link2 className="size-3" />
                          <span className="font-mono">← {truncateHash(entry.prev_hash)}</span>
                        </div>
                      )}
                      {!hashOk && (
                        <Badge variant="destructive" className="text-xs">
                          哈希不匹配
                        </Badge>
                      )}
                    </div>
                    {entry.payload_ref && (
                      <div className="text-xs text-slate-500 dark:text-zinc-500">
                        <FileText className="mr-1 inline size-3" />
                        引用：{entry.payload_ref}
                      </div>
                    )}
                    {entry.payload && Object.keys(entry.payload).length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-slate-500 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100">
                          查看详情
                        </summary>
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-xs text-slate-500 dark:text-zinc-500">
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {chainValid === false && (
          <Card className="rounded-2xl border border-red-300 dark:border-red-800">
            <CardContent className="flex items-center gap-3 py-4">
              <XCircle className="size-6 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">证据链完整性警告</p>
                <p className="text-xs text-red-600/70 dark:text-red-400/70">
                  证据链已被篡改或损坏，请立即联系平台客服
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => router.push('/orders')}>
            返回订单列表
          </Button>
        </div>
      </div>
      </div>
    </div>
  )
}
