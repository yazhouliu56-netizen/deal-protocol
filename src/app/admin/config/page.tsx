"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "@/components/SessionProvider"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import type { PlatformConfig, CommissionTier, CreditLevel } from "@/lib/platform/config"

const EMPTY_CONFIG: PlatformConfig = {
  fees: { commissionTiers: [], satisfactionHold: 0.1 },
  credit: { levels: [] },
  rules: { cancelThreshold: 3, cancelPenaltyCount: 5, cancelPenaltyCredit: 100, cancelPenaltyDays: 7 },
  insurance: { ratePerOrder: 0.01, poolAllocation: { warranty: 0.4, customer: 0.3, provider: 0.2, sos: 0.1 } },
}

export default function AdminConfigPage() {
  const { user: session, loading: status } = useSession()
  const [config, setConfig] = useState<PlatformConfig>(EMPTY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session?.role !== "ADMIN") return
    ;(async () => {
      try {
        const res = await fetch("/api/admin/config")
        if (!res.ok) { toast.error("加载配置失败"); return }
        const data = await res.json()
        setConfig(data.config)
      } catch { toast.error("网络错误") }
      finally { setLoading(false) }
    })()
  }, [session])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error || "保存失败")
        return
      }
      toast.success("配置已保存")
    } catch { toast.error("网络错误") }
    finally { setSaving(false) }
  }, [config])

  // ── 佣金阶梯操作 ──
  const updateTier = (i: number, field: keyof CommissionTier, value: string) => {
    const tiers = [...config.fees.commissionTiers]
    const current = tiers[i]!
    const parsed = field === "rate" ? parseFloat(value) || 0 : parseInt(value) || 0
    tiers[i] = { ...current, [field]: parsed }
    setConfig({ ...config, fees: { ...config.fees, commissionTiers: tiers } })
  }

  const addTier = () => {
    const tiers = [...config.fees.commissionTiers, { maxAmount: 0, rate: 0 }]
    setConfig({ ...config, fees: { ...config.fees, commissionTiers: tiers } })
  }

  const removeTier = (i: number) => {
    if (config.fees.commissionTiers.length <= 1) return
    const tiers = config.fees.commissionTiers.filter((_, idx) => idx !== i)
    setConfig({ ...config, fees: { ...config.fees, commissionTiers: tiers } })
  }

  // ── 信用等级操作 ──
  const updateLevel = (i: number, field: keyof CreditLevel | "benefitsStr", value: string) => {
    const levels = [...config.credit.levels]
    const current = levels[i]!
    if (field === "benefitsStr") {
      levels[i] = { ...current, benefits: value.split(",").map(s => s.trim()).filter(Boolean) }
    } else if (field === "minScore") {
      levels[i] = { ...current, minScore: parseInt(value) || 0 }
    } else {
      levels[i] = { ...current, label: value }
    }
    setConfig({ ...config, credit: { ...config.credit, levels } })
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">平台规则配置</h1>
          <p className="mt-1 text-muted-foreground">编辑平台级规则，修改后立即生效</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground">加载中...</p>
      ) : (
        <div className="space-y-6">
          {/* ── 佣金设置 ── */}
          <Card>
            <CardHeader>
              <CardTitle>佣金设置</CardTitle>
              <CardDescription>平台佣金阶梯费率，按订单金额匹配第一个满足条件的阶梯</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.fees.commissionTiers.map((tier, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-muted-foreground">金额上限 (≤)</label>
                    <Input
                      type="number"
                      value={tier.maxAmount === Number.MAX_SAFE_INTEGER ? "" : tier.maxAmount}
                      placeholder="不限"
                      onChange={e => updateTier(i, "maxAmount", e.target.value)}
                    />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-xs text-muted-foreground">费率 (%)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={tier.rate * 100}
                      onChange={e => updateTier(i, "rate", String(parseFloat(e.target.value) / 100))}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => removeTier(i)} disabled={config.fees.commissionTiers.length <= 1}>
                    删除
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTier}>+ 添加阶梯</Button>

              <div className="flex items-end gap-3 pt-2">
                <div className="w-32">
                  <label className="mb-1 block text-xs text-muted-foreground">满意暂存款 (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    value={config.fees.satisfactionHold * 100}
                    onChange={e => setConfig({ ...config, fees: { ...config.fees, satisfactionHold: (parseFloat(e.target.value) || 0) / 100 } })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 信用等级 ── */}
          <Card>
            <CardHeader>
              <CardTitle>信用等级</CardTitle>
              <CardDescription>信用评分对应的等级与权益</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {config.credit.levels.map((level, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-end gap-3">
                    <div className="w-24">
                      <label className="mb-1 block text-xs text-muted-foreground">最低分数</label>
                      <Input
                        type="number"
                        value={level.minScore}
                        onChange={e => updateLevel(i, "minScore", e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <label className="mb-1 block text-xs text-muted-foreground">标签</label>
                      <Input
                        value={level.label}
                        onChange={e => updateLevel(i, "label", e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">权益（逗号分隔）</label>
                      <Input
                        value={level.benefits.join("，")}
                        onChange={e => updateLevel(i, "benefitsStr", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── 取消规则 ── */}
          <Card>
            <CardHeader>
              <CardTitle>取消惩罚规则</CardTitle>
              <CardDescription>月取消单数达到阈值时触发惩罚</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">预付阈值（单）</label>
                  <Input
                    type="number"
                    value={config.rules.cancelThreshold}
                    onChange={e => setConfig({ ...config, rules: { ...config.rules, cancelThreshold: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">惩罚阈值（单）</label>
                  <Input
                    type="number"
                    value={config.rules.cancelPenaltyCount}
                    onChange={e => setConfig({ ...config, rules: { ...config.rules, cancelPenaltyCount: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">扣信用分</label>
                  <Input
                    type="number"
                    value={config.rules.cancelPenaltyCredit}
                    onChange={e => setConfig({ ...config, rules: { ...config.rules, cancelPenaltyCredit: parseInt(e.target.value) || 0 } })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">冻结天数</label>
                  <Input
                    type="number"
                    value={config.rules.cancelPenaltyDays}
                    onChange={e => setConfig({ ...config, rules: { ...config.rules, cancelPenaltyDays: parseInt(e.target.value) || 0 } })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── 保险池 ── */}
          <Card>
            <CardHeader>
              <CardTitle>保险池</CardTitle>
              <CardDescription>每单保险费率与资金池分配比例</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 w-32">
                <label className="mb-1 block text-xs text-muted-foreground">每单保费率 (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.insurance.ratePerOrder * 100}
                  onChange={e => setConfig({ ...config, insurance: { ...config.insurance, ratePerOrder: (parseFloat(e.target.value) || 0) / 100 } })}
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {(["warranty", "customer", "provider", "sos"] as const).map(k => (
                  <div key={k}>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      {k === "warranty" ? "质保" : k === "customer" ? "客户" : k === "provider" ? "服务方" : "SOS"} (%)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={config.insurance.poolAllocation[k] * 100}
                      onChange={e => setConfig({
                        ...config,
                        insurance: {
                          ...config.insurance,
                          poolAllocation: { ...config.insurance.poolAllocation, [k]: (parseFloat(e.target.value) || 0) / 100 },
                        },
                      })}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                当前总和: {((config.insurance.poolAllocation.warranty + config.insurance.poolAllocation.customer + config.insurance.poolAllocation.provider + config.insurance.poolAllocation.sos) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
