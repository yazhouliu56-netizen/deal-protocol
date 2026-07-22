"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import SmartProtocolCard from "@/components/SmartProtocolCard"
import { Button } from "@/components/ui/button"
import { Sparkles, Shield, CheckCircle2, Crown } from "lucide-react"

export function ToolSkeleton({ name }: { name: string }) {
  return (
    <Card className="border-border/40">
      <CardContent className="py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-6 w-6 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400/20" />
            <div className="relative h-2.5 w-2.5 rounded-full bg-indigo-500" />
          </div>
          <p className="animate-pulse text-xs text-muted-foreground">
            正在{name === "classifyDemand" ? "分析需求" : name === "generateProtocol" ? "生成协议" : "处理"}...
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function FallbackComponent({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
      AI 尝试使用 <code className="font-mono text-xs">{name}</code>，但前端暂未注册此组件。
    </div>
  )
}

export function ClassifyDemandResult({ result }: { result: any }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Sparkles className="size-4 text-indigo-500" />
        <span>AI 已理解您的需求</span>
        <Badge variant="secondary" className="text-[10px]">{result.category ?? ""}</Badge>
      </div>
      <div className="rounded-lg border border-border/40 bg-muted/40 p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{result.title}</p>
        <p className="mt-0.5 text-xs">{result.description}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {result.budgetMin != null && <span>预算 ¥{result.budgetMin}{result.budgetMax ? `-${result.budgetMax}` : ""}</span>}
          <span>紧急度：{result.urgency === "high" ? "紧急" : result.urgency === "medium" ? "适中" : "不着急"}</span>
          {result.address && <span>📍 {result.address}</span>}
        </div>
      </div>
    </div>
  )
}

export function GenerateProtocolResult({ result, onAction }: { result: any; onAction?: (action: string, payload?: any) => void }) {
  const riskTier = result.risk_tier === "high" ? "high" : result.risk_tier === "medium" ? "medium" : "low" as const

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <Shield className="size-4 text-indigo-500" />
        <span>AI 已生成协议</span>
        {riskTier === "high" ? (
          <Badge className="border-0 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">高风险 · 押金担保</Badge>
        ) : (
          <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">低风险 · 信用担保</Badge>
        )}
      </div>
      <SmartProtocolCard
        title={result.title ?? ""}
        description={result.description ?? ""}
        category={result.category ?? ""}
        riskTier={riskTier}
        budgetMin={result.budgetMin}
        budgetMax={result.budgetMax}
        schema={result.schema_json ?? {}}
        protocolFields={result.protocol_json ?? {}}
        onProtocolFieldsChange={() => {}}
        price={result.price ?? 0}
        onPriceChange={() => {}}
        media={[]}
        onMediaChange={() => {}}
        onPublish={() => onAction?.("confirm_protocol")}
        publishing={false}
        mode="view"
        suggestedMin={result.budgetMin}
        suggestedMax={result.budgetMax}
      />
      {onAction && (
        <Button size="sm" className="w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => onAction("confirm_protocol")}>
          <CheckCircle2 className="mr-1.5 size-3.5" />确认发布
        </Button>
      )}
    </div>
  )
}

export function CreateDemandResult({ result }: { result: any }) {
  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/10">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="size-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">需求已发布！</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{result.message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const toolComponentRegistry: Record<string, React.FC<{ result: any; args: any; onAction?: (action: string, payload?: any) => void }>> = {
  classifyDemand: ({ result }) => <ClassifyDemandResult result={result} />,
  generateProtocol: ({ result, onAction }) => <GenerateProtocolResult result={result} onAction={onAction} />,
  createDemand: ({ result }) => <CreateDemandResult result={result} />,
}

export function renderToolInvocation(toolInvocation: {
  toolName: string
  state: string
  result?: any
  args?: any
  toolCallId: string
}, onAction?: (action: string, payload?: any) => void) {
  const { toolName, state, result, args } = toolInvocation

  if (state === "partial-call" || state === "call") {
    return <ToolSkeleton name={toolName} />
  }

  const Component = toolComponentRegistry[toolName]
  if (!Component) {
    return <FallbackComponent name={toolName} />
  }

  return <Component result={result} args={args} onAction={onAction} />
}
