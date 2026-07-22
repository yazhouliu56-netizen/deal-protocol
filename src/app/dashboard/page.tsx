'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table'

function getStatusColor(status: string) {
  switch (status) {
    case 'COMPLETED': case 'SETTLED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'HELD': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'PENDING_HELD': case 'PENDING': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'CANCELLED': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    case 'DISPUTED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'REJECTED': return 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/30 dark:text-red-400'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_HELD: '待支付', PENDING: '待支付', HELD: '服务中',
    COMPLETED: '已完成', SATISFACTION_HELD: '暂存评估', SETTLED: '已结算',
    CANCELLED: '已取消', DISPUTED: '纠纷中', REJECTED: '已拒绝',
  }
  return labels[status] || status
}

interface Profile {
  id: string; name: string; email: string; credit_score: number; balance: number
}

interface Contract {
  id: string; amount: number; fund_status: string; created_at: string
  demand_id: string | null; provider_id: string | null; customer_id: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [providings, setProvidings] = useState<Contract[]>([])
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    if (!sessionLoading && !user) { router.push('/login'); return }
    if (!user) return

    ;(async () => {
      const supabase = getBrowserSupabase()

      const profileRes = await fetch('/api/profile')
      if (profileRes.ok) {
        const data = await profileRes.json()
        setProfile(data.user)
      } else {
        router.push('/login')
        return
      }

      const [contractsRes, providingsRes] = await Promise.all([
        supabase.from('contracts').select('id, amount, fund_status, created_at, demand_id, provider_id, customer_id').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('contracts').select('id, amount, fund_status, created_at, demand_id, customer_id, provider_id').eq('provider_id', user.id).order('created_at', { ascending: false }).limit(5),
      ])
      setContracts(contractsRes.data ?? [])
      setProvidings(providingsRes.data ?? [])
      setProfileLoading(false)
    })()
  }, [user, sessionLoading, router])

  if (sessionLoading || profileLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl bg-muted" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) return null

  const isProvider = contracts.length > 0 && providings.length > 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">控制面板</h1>
          <p className="mt-1 text-muted-foreground">欢迎回来，{profile.name}</p>
        </div>
        <Link href="/demands/new">
          <Button>
            <span className="mr-1.5">+</span> 发布需求
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">信用评分</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{profile.credit_score}</span>
              <span className="text-sm text-muted-foreground">/ 1000</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">账户余额</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-foreground">¥{profile.balance.toFixed(2)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">进行中订单</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-foreground">
              {contracts.filter(c => c.fund_status === 'HELD' || c.fund_status === 'PENDING_HELD').length}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">历史订单</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold text-foreground">{contracts.length + providings.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/demands/new"><Button variant="outline">发布需求</Button></Link>
        <Link href="/orders"><Button variant="outline">全部订单</Button></Link>
        <Link href="/console"><Button variant="outline">资金控制台</Button></Link>
        <Link href="/provider"><Button variant="outline">承接商抢单中心</Button></Link>
        <Link href="/profile"><Button variant="outline">个人资料</Button></Link>
      </div>

      {/* Recent orders */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">最近订单</h2>
        <Card className="mt-3">
          {(contracts.length === 0 && providings.length === 0) ? (
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-3 opacity-30">📋</div>
              <p className="text-muted-foreground">暂无订单记录</p>
              <Link href="/demands/new">
                <Button variant="outline" className="mt-4">发布第一个需求</Button>
              </Link>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...contracts.map(c => ({ ...c, _type: '需求' as const })), ...providings.map(c => ({ ...c, _type: '服务' as const }))]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 8)
                  .map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <Badge variant="secondary" className="mr-2">{c._type}</Badge>
                        {c.demand_id ?? '服务订单'}
                      </TableCell>
                      <TableCell>¥{c.amount.toFixed(2)}</TableCell>
                      <TableCell><Badge className={getStatusColor(c.fund_status)}>{getStatusLabel(c.fund_status)}</Badge></TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {new Date(c.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
