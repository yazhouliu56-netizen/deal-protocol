"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert, FileText, Scale, CheckCircle2 } from "lucide-react";

interface DisputeDetail {
  id: string;
  order_id: string;
  reason: string;
  requested_refund_amount: number;
  approved_refund_amount?: number;
  status: string;
  evidence_urls?: string[];
  resolution_notes?: string;
  created_at: string;
}

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);

  useEffect(() => {
    if (params?.id) fetchDetail(params.id as string);
  }, [params?.id]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/disputes/detail?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setDispute(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!dispute) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-400 p-6 font-mono text-xs">调取仲裁档案中...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans touch-manipulation">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => router.back()} className="touch-target inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 active:scale-95 transition-transform">
          <ArrowLeft className="w-4 h-4"/> 返回仲裁列表
        </button>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <div className="text-[10px] font-mono text-zinc-500">CASE ID: {dispute.id}</div>
              <h1 className="text-base font-bold mt-1 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400"/> 仲裁案卷详情
              </h1>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
              STATUS: {dispute.status}
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400"/> 申诉原委
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">{dispute.reason}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="text-[10px] text-zinc-500">申请退款额</div>
                <div className="text-sm font-mono font-bold text-amber-400 mt-1">¥{dispute.requested_refund_amount?.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="text-[10px] text-zinc-500">裁定退款额</div>
                <div className="text-sm font-mono font-bold text-emerald-400 mt-1">
                  ¥{dispute.approved_refund_amount !== undefined ? dispute.approved_refund_amount.toLocaleString() : "待裁决"}
                </div>
              </div>
            </div>

            {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
              <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                <div className="text-xs font-semibold text-zinc-400">举证材料链接</div>
                <div className="space-y-1">
                  {dispute.evidence_urls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="block text-xs font-mono text-indigo-400 hover:underline truncate">
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {dispute.resolution_notes && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Scale className="w-4 h-4"/> 仲裁终局意见
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">{dispute.resolution_notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
