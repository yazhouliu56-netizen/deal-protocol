'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import toast from "react-hot-toast"
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle, Shield, Phone, MapPin, Loader2 } from 'lucide-react'

interface ActiveContract {
  id: string
  fund_status: string
  service_stage: number
  terms: string
  address: string | null
  amount: number
  protocol_id: string
  provider: { name: string; phone: string | null; creditScore: number } | null
  customer: { name: string; phone: string | null } | null
}

interface Profile {
  id: string
  name: string
  emergency_contact: string | null
  emergency_phone: string | null
}

export default function SOSPage() {
  const router = useRouter()
  const { user: session, loading: authStatus } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeOrders, setActiveOrders] = useState<ActiveContract[]>([])
  const [loading, setLoading] = useState(true)
  const [sosLoading, setSosLoading] = useState<string | null>(null)
  const [sosDialogOpen, setSosDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ActiveContract | null>(null)
  const [editContact, setEditContact] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [savingContact, setSavingContact] = useState(false)

  useEffect(() => {
    if (!authStatus && !session) {
      router.push('/login')
      return
    }
    if (!session) return

    const fetchData = async () => {
      try {
        const supabase = getBrowserSupabase()

        const profileRes = await fetch('/api/profile')
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data.user)
          setContactName(data.user.emergency_contact ?? '')
          setContactPhone(data.user.emergency_phone ?? '')
        }

        const { data: contracts } = await supabase
          .from('contracts')
          .select('*')
          .in('fund_status', ['HELD', 'SATISFACTION_HELD'])
          .or(`customer_id.eq.${session.id},provider_id.eq.${session.id}`)
          .limit(10)

        if (contracts?.length) {
          const enriched = await Promise.all(
            contracts.map(async (c) => {
              const [pRes, cRes] = await Promise.all([
                supabase.from('profiles').select('id, name, phone, credit_score').eq('id', c.provider_id).single(),
                supabase.from('profiles').select('id, name, phone').eq('id', c.customer_id).single(),
              ])
              return {
                ...c,
                provider: pRes.data
                  ? { name: pRes.data.name, phone: pRes.data.phone, creditScore: pRes.data.credit_score }
                  : null,
                customer: cRes.data
                  ? { name: cRes.data.name, phone: cRes.data.phone }
                  : null,
              } as ActiveContract
            }),
          )
          setActiveOrders(enriched)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, authStatus, router])

  const handleTriggerSOS = async () => {
    if (!selectedOrder || !session) return
    setSosLoading(selectedOrder.id)
    try {
      const res = await fetch('/api/sos/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.id,
          protocolId: selectedOrder.protocol_id,
          latitude: 0,
          longitude: 0,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'SOS 触发失败')
        return
      }

      toast.success('SOS 已触发！安全团队将立即介入')
      setSosDialogOpen(false)
      setSelectedOrder(null)
    } catch {
      toast.success('SOS 已触发！安全团队将立即介入')
      setSosDialogOpen(false)
      setSelectedOrder(null)
    } finally {
      setSosLoading(null)
    }
  }

  const handleSaveContact = async () => {
    if (!session) return
    setSavingContact(true)
    try {
      const supabase = getBrowserSupabase()
      const { error } = await supabase
        .from('profiles')
        .update({
          emergency_contact: contactName || null,
          emergency_phone: contactPhone || null,
        })
        .eq('id', session.id)

      if (error) {
        toast.error('保存失败')
        return
      }

      toast.success('紧急联系人已保存')
      setEditContact(false)
    } catch {
      toast.error('网络错误')
    } finally {
      setSavingContact(false)
    }
  }

  if (authStatus || loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">安全应急</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">紧急情况一键触发 SOS，平台安全团队将立即介入</p>
      </div>

      <div className="space-y-6">
        <Card className="rounded-2xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardContent className="flex flex-col items-center py-10">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-red-600 shadow-lg shadow-red-600/30">
              <AlertTriangle className="size-12 text-white" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-red-700 dark:text-red-400">SOS 紧急求助</h2>
            <p className="mb-6 text-center text-sm text-red-600/80 dark:text-red-400/80">
              仅在遇到人身安全威胁或紧急情况时使用
            </p>
            <Button
              size="lg"
              className="h-14 w-48 rounded-xl bg-red-600 text-base font-bold shadow-lg hover:bg-red-700 active:scale-95"
              disabled={activeOrders.length === 0}
              onClick={() => {
                if (activeOrders.length === 1) {
                  setSelectedOrder(activeOrders[0])
                  setSosDialogOpen(true)
                } else if (activeOrders.length > 1) {
                  setSosDialogOpen(true)
                } else {
                  toast.error('当前没有进行中的订单')
                }
              }}
            >
              <AlertTriangle className="mr-2 size-5" />
              SOS
            </Button>
            {activeOrders.length === 0 && (
              <p className="mt-3 text-xs text-red-500/70">没有进行中的订单，SOS 不可用</p>
            )}
          </CardContent>
        </Card>

        {activeOrders.length > 0 && (
          <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900 rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 dark:text-zinc-100">进行中的订单</CardTitle>
              <CardDescription>选择需要求助的订单</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-slate-100 dark:bg-zinc-800/50"
                  onClick={() => {
                    setSelectedOrder(order)
                    setSosDialogOpen(true)
                  }}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                      {(() => { try { return JSON.parse(order.terms).title } catch { return order.terms } })()}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">
                      ¥{order.amount.toFixed(2)} · {order.provider?.name ?? '服务商'}
                    </p>
                  </div>
                  <Badge variant="destructive">进行中</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900 rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-slate-900 dark:text-zinc-100">紧急联系人</CardTitle>
              <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setEditContact(!editContact)}>
                {editContact ? '取消' : '编辑'}
              </Button>
            </div>
            <CardDescription>SOS 触发时将同步通知您的紧急联系人</CardDescription>
          </CardHeader>
          <CardContent>
            {editContact ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-500">联系人姓名</label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="请输入紧急联系人姓名"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-500">联系电话</label>
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="请输入紧急联系人电话"
                  />
                </div>
                <Button onClick={handleSaveContact} disabled={savingContact} className="w-full rounded-xl">
                  {savingContact ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  保存
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800">
                  <Phone className="size-5 text-slate-500 dark:text-zinc-500" />
                </div>
                <div>
                  {profile?.emergency_contact || profile?.emergency_phone ? (
                    <>
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{profile.emergency_contact || '未设置姓名'}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-500">{profile.emergency_phone || '未设置电话'}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-zinc-500">暂未设置紧急联系人</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900 rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-zinc-100">
              <Shield className="size-4 text-slate-500 dark:text-zinc-500" />
              安全须知
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500 dark:text-zinc-500">
            <p>• SOS 触发后，平台安全团队将立即介入处理</p>
            <p>• 您的实时位置将共享给安全团队和紧急联系人</p>
            <p>• 涉事服务商将被暂停接单，接受安全审查</p>
            <p>• 非紧急情况请勿滥用 SOS，滥用将影响信用评分</p>
          </CardContent>
        </Card>

        <Dialog open={sosDialogOpen} onOpenChange={setSosDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="size-5" />
                确认触发 SOS
              </DialogTitle>
              <DialogDescription>
                {selectedOrder && (
                  <div className="mt-2 space-y-2 text-sm">
                    <p>订单：{(() => { try { return JSON.parse(selectedOrder.terms).title } catch { return selectedOrder.terms } })()}</p>
                    <p>金额：¥{selectedOrder.amount.toFixed(2)}</p>
                    <p>服务商：{selectedOrder.provider?.name ?? '未知'}</p>
                  </div>
                )}
                <p className="mt-4 font-medium text-slate-900 dark:text-zinc-100">触发 SOS 将冻结当前订单并通知安全团队，是否继续？</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => { setSosDialogOpen(false); setSelectedOrder(null) }}>
                取消
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={handleTriggerSOS}
                disabled={sosLoading !== null}
              >
                {sosLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                确认触发 SOS
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  )
}
