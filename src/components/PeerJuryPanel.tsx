'use client'

import { useState, useEffect, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { castJuryVote, getJuryResults } from '@/lib/peer-jury'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Scale, ThumbsUp, ShieldCheck, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface PeerJuryPanelProps {
  disputeId: string
  userId: string
  onVoteCast?: () => void
}

export function PeerJuryPanel({ disputeId, userId, onVoteCast }: PeerJuryPanelProps) {
  const [juryVotes, setJuryVotes] = useState<{ demander: number; provider: number; total: number }>({
    demander: 0,
    provider: 0,
    total: 0,
  })
  const [hasVoted, setHasVoted] = useState(false)
  const [voting, setVoting] = useState(false)
  const [reason, setReason] = useState('')

  const loadResults = useCallback(async () => {
    try {
      const results = await getJuryResults(disputeId)
      setJuryVotes({
        demander: results.demanderVotes,
        provider: results.providerVotes,
        total: results.totalVotes,
      })

      const supabase = getBrowserSupabase()
      const { data: myVote } = await supabase
        .from('jury_votes')
        .select('id')
        .eq('dispute_id', disputeId)
        .eq('juror_id', userId)
        .maybeSingle()

      setHasVoted(!!myVote)
    } catch {
      // ignore
    }
  }, [disputeId, userId])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  const handleVote = async (vote: 'demander' | 'provider') => {
    if (hasVoted || voting) return
    setVoting(true)
    try {
      await castJuryVote(disputeId, userId, vote, reason || undefined)
      toast.success('投票成功！感谢您参与社区治理')
      setHasVoted(true)
      await loadResults()
      onVoteCast?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '投票失败'
      toast.error(msg)
    } finally {
      setVoting(false)
    }
  }

  const demanderPct = juryVotes.total > 0 ? (juryVotes.demander / juryVotes.total) * 100 : 0
  const providerPct = juryVotes.total > 0 ? (juryVotes.provider / juryVotes.total) * 100 : 0

  return (
    <Card className="overflow-hidden border-zinc-200/60 shadow-sm dark:border-zinc-800/60">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Scale className="size-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <CardTitle className="text-base">社区小法庭</CardTitle>
            <CardDescription>高信用用户陪审团 · 盲审投票</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {hasVoted && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ShieldCheck className="size-4 shrink-0" />
            您已完成投票，感谢参与社区治理
          </div>
        )}

        {/* Evidence thumbnails */}
        <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/50">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            争端证据 · SHA-256 存证
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800"
              >
                <AlertTriangle className="size-5 text-zinc-400" />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            证据哈希已脱敏 · 具体材料仅限陪审员查阅
          </p>
        </div>

        {/* Voting progress bar */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-indigo-600 dark:text-indigo-400">
              支持买家 ({juryVotes.demander})
            </span>
            <span className="font-medium text-rose-600 dark:text-rose-400">
              支持服务商 ({juryVotes.provider})
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-l-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${demanderPct}%` }}
            />
            <div
              className="h-full rounded-r-full bg-rose-500 transition-all duration-500"
              style={{ width: `${providerPct}%` }}
            />
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            共 {juryVotes.total} 位陪审员已投票
          </p>
        </div>

        {/* Vote buttons */}
        {!hasVoted && (
          <div className="space-y-3">
            <textarea
              placeholder="输入您的判断理由（可选）"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-zinc-200/60 bg-white px-4 py-2.5 text-sm transition-all focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <div className="flex gap-3">
              <Button
                onClick={() => handleVote('demander')}
                disabled={voting}
                variant="outline"
                className={cn(
                  'flex-1 gap-2 rounded-xl border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30',
                )}
              >
                <ThumbsUp className="size-4" />
                支持买家
              </Button>
              <Button
                onClick={() => handleVote('provider')}
                disabled={voting}
                variant="outline"
                className={cn(
                  'flex-1 gap-2 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30',
                )}
              >
                <ThumbsUp className="size-4" />
                支持服务商
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
