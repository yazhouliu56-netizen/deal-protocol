'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { useSupabaseRealtime, type ChatMessage } from '@/hooks/useSupabaseRealtime'
import { interceptChatRisk } from '@/lib/risk-interceptor'
import { cn } from '@/lib/utils'
import { Send, User, Bot, ShieldAlert, Loader2, ChevronLeft } from 'lucide-react'

interface RealtimeChatProps {
  orderId: string
  currentUserId: string
  currentUserName?: string
  otherPartyName?: string
  onBack?: () => void
}

export default function RealtimeChat({
  orderId,
  currentUserId,
  currentUserName,
  otherPartyName,
  onBack,
}: RealtimeChatProps) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [riskWarning, setRiskWarning] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { messages, isPeerTyping, sendTypingStatus } = useSupabaseRealtime(orderId, currentUserId)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const handleResize = () => {
      if (!chatRef.current) return
      if (vv.height < window.innerHeight * 0.8) {
        const diff = window.innerHeight - vv.height
        chatRef.current.style.height = `${vv.height}px`
        chatRef.current.style.transform = `translateY(0)`
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }
        }, 100)
      } else {
        chatRef.current.style.height = ''
        chatRef.current.style.transform = ''
      }
    }

    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    const riskResult = interceptChatRisk(text)
    if (riskResult.hasRisk) {
      setRiskWarning(riskResult.warningMessage ?? null)
      return
    }
    setRiskWarning(null)

    setSending(true)
    try {
      const supabase = getBrowserSupabase()
      const { error } = await supabase.from('messages').insert({
        order_id: orderId,
        sender_id: currentUserId,
        content: riskResult.sanitizedText || text,
      })
      if (error) {
        console.error('Send message error:', error)
      }
      setInput('')
    } catch (err) {
      console.error('Send failed:', err)
    } finally {
      setSending(false)
    }
  }, [input, sending, orderId, currentUserId])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value)

      sendTypingStatus(true)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        sendTypingStatus(false)
      }, 2000)
    },
    [sendTypingStatus],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const isMe = (msg: ChatMessage) => msg.senderId === currentUserId

  return (
    <div className="flex h-full flex-col bg-zinc-950" ref={chatRef}>
      <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="返回"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-950/30 text-sm font-bold text-indigo-400">
          {otherPartyName?.charAt(0) ?? '?'}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-100">{otherPartyName ?? '对方'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-950/50" ref={scrollRef}>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
                  <Send className="size-6 text-zinc-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-500">暂无消息</p>
                <p className="mt-1 text-xs text-zinc-600">发送第一条消息开始沟通</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${isMe(msg) ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                    isMe(msg)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <User className="size-3.5" />
                </div>
                <div className={`flex max-w-[75%] flex-col ${isMe(msg) ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isMe(msg)
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-zinc-800 bg-zinc-900 text-zinc-300 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-zinc-600">
                    {new Date(msg.createdAt).toLocaleString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}

          {riskWarning && (
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-red-950/30 text-red-400">
                <ShieldAlert className="size-3.5" />
              </div>
              <div className="flex-1 rounded-xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm leading-relaxed text-red-300">
                <p className="whitespace-pre-wrap">{riskWarning}</p>
              </div>
            </div>
          )}

          {isPeerTyping && (
            <div className="flex items-center gap-2 text-sm text-zinc-500 animate-pulse">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              💬 对方正在输入...
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-end gap-3">
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              disabled={sending}
              rows={1}
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.97] disabled:opacity-50"
            aria-label="发送消息"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
