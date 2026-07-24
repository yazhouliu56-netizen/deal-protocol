"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AIArbitrationReport } from "@/lib/ai-arbitrator";

interface AIArbitrationCardProps {
  report: AIArbitrationReport;
  onAccept?: () => void;
  onExportEvidence?: () => void;
  loading?: boolean;
}

function RatioBar({ demander, provider }: { demander: number; provider: number }) {
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>买家 {demander}%</span>
        <span>服务商 {provider}%</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted ring-1 ring-foreground/10">
        <div
          className="flex items-center justify-center bg-amber-500 text-[10px] font-bold text-white transition-all"
          style={{ width: `${demander}%` }}
        />
        <div
          className="flex items-center justify-center bg-blue-600 text-[10px] font-bold text-white transition-all"
          style={{ width: `${provider}%` }}
        />
      </div>
    </div>
  );
}

function StatuteBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-300">
      {label}
    </span>
  );
}

export function AIArbitrationCard({ report, onAccept, onExportEvidence, loading }: AIArbitrationCardProps) {
  const [accepting, setAccepting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await onAccept?.();
    } finally {
      setAccepting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExportEvidence?.();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="border-amber-200/50 shadow-lg dark:border-amber-800/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <CardTitle>AI 智能法律仲裁建议书</CardTitle>
        </div>
        <CardDescription>
          基于《中华人民共和国民法典》与司法裁判案例，结合 SHA-256 哈希防篡改证据链生成
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <section>
          <h4 className="mb-1 text-sm font-semibold text-foreground">事实推演</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">{report.factSummary}</p>
        </section>

        <section>
          <h4 className="mb-1 text-sm font-semibold text-foreground">责任比例</h4>
          <RatioBar demander={report.responsibilityRatio.demander} provider={report.responsibilityRatio.provider} />
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-amber-50 p-2 text-center dark:bg-amber-900/10">
              <div className="text-xs text-muted-foreground">建议退款买家</div>
              <div className="text-lg font-bold text-amber-600">¥{report.recommendedRefundAmount.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-2 text-center dark:bg-blue-900/10">
              <div className="text-xs text-muted-foreground">建议结清服务商</div>
              <div className="text-lg font-bold text-blue-600">¥{report.recommendedPayoutAmount.toFixed(2)}</div>
            </div>
          </div>
        </section>

        <section>
          <h4 className="mb-1 text-sm font-semibold text-foreground">引用法条</h4>
          <ul className="space-y-1">
            {report.legalStatutes.map((statute, idx) => {
              const articleMatch = statute.match(/(第\d+条)/);
              return (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 shrink-0 text-amber-500">•</span>
                  <span>
                    {articleMatch ? <StatuteBadge label={articleMatch[1]} /> : null}{" "}
                    {statute}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h4 className="mb-1 text-sm font-semibold text-foreground">参照判例</h4>
          <ul className="space-y-1">
            {report.courtPrecedents.map((precedent, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-blue-500">📜</span>
                <span>{precedent}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="mb-1 text-sm font-semibold text-foreground">裁决推理依据</h4>
          <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
            {report.reasoningDetails.map((detail, idx) => (
              <li key={idx}>{detail}</li>
            ))}
          </ol>
        </section>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span>置信度</span>
          <span className={cn("font-semibold", report.confidenceScore >= 0.85 ? "text-green-600" : "text-amber-600")}>
            {(report.confidenceScore * 100).toFixed(0)}%
          </span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3">
        <Button
          variant="default"
          size="lg"
          className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800"
          onClick={handleAccept}
          disabled={accepting || loading}
        >
          {accepting ? "执行中..." : "一键采纳 AI 判决并结算"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
          onClick={handleExport}
          disabled={exporting || loading}
        >
          {exporting ? "导出中..." : "导出法院诉讼举证包"}
        </Button>
      </CardFooter>
    </Card>
  );
}
