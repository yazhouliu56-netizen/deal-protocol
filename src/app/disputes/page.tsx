"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface DisputeItem {
  id: string;
  order_id: string;
  reason: string;
  requested_refund_amount: number;
  status: "PENDING_REVIEW" | "RESOLVED" | "REJECTED";
  created_at: string;
}

export default function DisputesListPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/disputes/list");
      if (res.ok) {
        const data = await res.json();
        setDisputes(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("加载维权列表失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusBadge = (status: DisputeItem["status"]) => {
    switch (status) {
      case "PENDING_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3"/> 仲裁审理中
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3"/> 裁决成立
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            <AlertCircle className="w-3 h-3"/> 申诉驳回
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans touch-manipulation">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-5 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <ShieldAlert className="w-6 h-6"/>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">维权与争议仲裁中心</h1>
              <p className="text-xs text-zinc-400 mt-1">资金归属保全控制台与 AI 自动举证判决流</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-xs font-mono text-zinc-500 py-12 text-center">正在同步交易仲裁记录...</div>
        ) : disputes.length === 0 ? (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-12 text-center space-y-3">
            <div className="text-zinc-500 text-xs font-mono">暂无任何交易维权案件</div>
            <p className="text-xs text-zinc-600">平台履约情况良好，资金托管合约正常运行中。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {disputes.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-5 transition flex flex-col md:flex-row md:items-center justify-between gap-4 touch-feedback active:scale-[0.99]"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-zinc-500">DISPUTE: #{item.id.slice(0, 8)}</span>
                    {renderStatusBadge(item.status)}
                  </div>
                  <p className="text-xs text-zinc-200 line-clamp-2">{item.reason}</p>
                  <div className="text-[11px] font-mono text-zinc-400">
                    申诉退款金额: <span className="text-amber-400 font-bold">¥{item.requested_refund_amount?.toLocaleString()}</span>
                  </div>
                </div>

                <Link href={`/disputes/${item.id}`} className="touch-target inline-flex items-center justify-center gap-1.5 text-xs font-medium px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 rounded-xl transition-transform self-start md:self-center shrink-0">
                  查看裁决详情 <ArrowRight className="w-3.5 h-3.5"/>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
