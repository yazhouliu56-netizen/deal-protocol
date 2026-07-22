'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import toast from "react-hot-toast"
import { Badge } from '@/components/ui/badge'
import { CreditDashboard } from '@/components/CreditDashboard'
import SmartProtocolCard from '@/components/SmartProtocolCard'
import { renderToolInvocation } from '@/lib/chat-component-registry'
import { cn } from '@/lib/utils'
import {
  Send, AlertTriangle, Loader2, User, Bot,
  ChevronLeft, Shield,
} from 'lucide-react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

interface ChatMessage {
  id: string
  contract_id: string
  sender_id: string
  content: string
  flagged: boolean
  flag_reason: string | null
  created_at: string
  sender_name?: string
}

interface ContractInfo {
  id: string
  terms: string
  amount: number
  fund_status: string
  provider: { id: string; name: string; creditScore?: number }
  customer: { id: string; name: string; creditScore?: number }
}

const FUND_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING_HELD: { label: '待支付', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  HELD: { label: '资金托管中', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400' },
  COMPLETED: { label: '已完成', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  SATISFACTION_HELD: { label: '暂存评估', color: 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:text-purple-400' },
  SETTLED: { label: '已结算', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  CANCELLED: { label: '已取消', color: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400' },
  DISPUTED: { label: '纠纷中', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' },
  REJECTED: { label: '已拒绝', color: 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400' },
}

function ChatSkeleton() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400/20" />
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/30">
            <Bot className="size-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-zinc-500">加载聊天记录中...</p>
        <div className="mt-2 w-64 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800" />
          <div className="ml-8 h-12 w-48 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800" />
          <div className="ml-8 h-10 w-36 animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { user: session, loading: authStatus } = useSession()
  const [contractId, setContractId] = useState<string | null>(null)
  const [contract, setContract] = useState<ContractInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    params.then(({ id }) => setContractId(id))
  }, [params])

  useEffect(() => {
    if (!contractId) return
    let cancelled = false

    const fetchData = async () => {
      try {
        const orderRes = await fetch(`/api/orders/${contractId}`)
        if (orderRes.ok) {
          const data = await orderRes.json()
          if (!cancelled && data.contract) {
            setContract({
              id: data.contract.id,
              terms: data.contract.terms,
              amount: data.contract.amount,
              fund_status: data.contract.fund_status,
              provider: data.contract.provider,
              customer: data.contract.customer,
            })
          }
        }

        const supabase = getBrowserSupabase()
        const { data: chatMessages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: true })

        if (!cancelled && chatMessages) {
          setMessages(chatMessages as ChatMessage[])
        }
      } catch {
        if (!cancelled) toast.error('加载聊天记录失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [contractId])

  useEffect(() => {
    if (!contractId) return

    const supabase = getBrowserSupabase()
    const channel = supabase
      .channel(`chat:${contractId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `contract_id=eq.${contractId}`,
        },
        (payload: RealtimePostgresChangesPayload<ChatMessage>) => {
          const newMsg = payload.new as ChatMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [contractId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!authStatus && !session) {
      router.push('/login')
    }
  }, [session, authStatus, router])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || !contractId || !session) return

    setSending(true)
    try {
      const supabase = getBrowserSupabase()
      const flagged = checkAudit(text)
      const { error } = await supabase.from('chat_messages').insert({
        contract_id: contractId,
        sender_id: session.id,
        content: text,
        flagged,
        flag_reason: flagged ? '检测到敏感内容' : null,
      })

      if (error) {
        toast.error('发送失败')
        return
      }

      setInput('')
    } catch {
      toast.error('网络错误')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherParty = contract
    ? session?.id === contract.customer.id
      ? contract.provider
      : contract.customer
    : null

  const isFlagged = (msg: ChatMessage) => msg.flagged

  const fundStatusInfo = contract
    ? FUND_STATUS_MAP[contract.fund_status] ?? { label: contract.fund_status, color: 'bg-slate-100 text-slate-600' }
    : null

  if (authStatus || loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-zinc-950">
        <aside className="hidden w-1/3 min-w-[300px] max-w-[380px] animate-pulse border-r border-slate-200/60 bg-white/50 p-6 dark:border-zinc-800/60 dark:bg-zinc-950/50 lg:block">
          <div className="space-y-6">
            <div className="h-9 w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-800" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-zinc-800" />
          </div>
        </aside>
        <main className="flex flex-1 flex-col bg-white dark:bg-zinc-900">
          <ChatSkeleton />
        </main>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-zinc-500">订单不存在</p>
          <button
            onClick={() => router.push('/orders')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-700"
          >
            返回订单列表
          </button>
        </div>
      </div>
    )
  }

  const parsedTerms = (() => {
    try { return JSON.parse(contract.terms) } catch { return { title: contract.terms } }
  })()

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-50 dark:bg-zinc-950">
      {/* ── Left: Credit Dashboard (1/3) ── */}
      <aside className="hidden w-1/3 min-w-[300px] max-w-[380px] overflow-y-auto border-r border-slate-200/60 bg-white/50 dark:border-zinc-800/60 dark:bg-zinc-950/50 lg:block">
        <CreditDashboard
          creditScore={session ? 780 : 650}
          level="信用极佳"
          completedOrders={15}
          satisfactionRate="98%"
          orderSummary={[
            { label: "本单金额", value: `¥${contract.amount.toLocaleString()}`, color: "text-emerald-600" },
            { label: "资金状态", value: fundStatusInfo?.label ?? contract.fund_status },
            { label: "协约方", value: otherParty?.name ?? "—" },
          ]}
          identityItems={[
            { icon: Shield, label: "资金担保", done: true },
            { icon: User, label: otherParty ? `对方: ${otherParty.name}` : "协约方", done: true },
            { icon: Shield, label: "平台仲裁保障", done: true },
          ]}
          showHeader={false}
        />
      </aside>

      {/* ── Right: Chat Area (2/3) ── */}
      <main className="flex flex-1 flex-col bg-white dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-200/60 bg-white px-5 py-3 dark:border-zinc-800/60 dark:bg-zinc-950">
          <button
            onClick={() => router.push(`/orders/${contractId}`)}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
            {otherParty?.name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{otherParty?.name ?? '对方'}</p>
              {session?.id === contract.customer.id ? (
                <Badge variant="secondary" className="px-2 py-0 text-[10px]">提供服务方</Badge>
              ) : (
                <Badge variant="secondary" className="px-2 py-0 text-[10px]">客户</Badge>
              )}
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-zinc-500">{parsedTerms.title}</p>
          </div>
          {fundStatusInfo && (
            <Badge className={cn("border-0 px-3 py-1 text-xs", fundStatusInfo.color)}>
              <Shield className="mr-1 inline-block size-3" />
              {fundStatusInfo.label}
            </Badge>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/50" ref={scrollRef}>
          <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
                    <Send className="size-6 text-slate-400" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-500 dark:text-zinc-500">暂无聊天记录</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-zinc-600">发送第一条消息开始沟通</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === session?.id
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                      isMe
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                    }`}>
                      <User className="size-3.5" />
                    </div>
                    <div className={`flex max-w-[75%] flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isFlagged(msg)
                            ? 'border border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-300'
                            : isMe
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'border border-slate-200/60 bg-white text-slate-700 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}
                      >
                        {isFlagged(msg) && (
                          <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="size-3" />
                            {msg.flag_reason || '该消息已被标记'}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <div className={`mt-1.5 flex items-center gap-2 px-1 ${
                        isMe ? 'flex-row-reverse' : ''
                      }`}>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-600">
                          {new Date(msg.created_at).toLocaleString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isFlagged(msg) && (
                          <Badge variant="outline" className="border-orange-200 px-1.5 py-0 text-[10px] text-orange-600 dark:border-orange-900/30 dark:text-orange-400">
                            已标记
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200/60 bg-white px-5 py-4 dark:border-zinc-800/60 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-2xl items-end gap-3">
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息..."
                disabled={sending}
                rows={1}
                className="w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3 pr-12 text-sm placeholder:text-slate-400 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-indigo-500/20"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.97] disabled:opacity-50"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function checkAudit(text: string): boolean {
  const keywords = [
    '加微信', '私下交易', '直接转账', '加QQ', '线下付',
    '不用平台', '逃单', '跳过平台', '威胁', '报复', '弄死',
    '你等着', '上门找你',
  ]
  return keywords.some((kw) => text.includes(kw))
}
