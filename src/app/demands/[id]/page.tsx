"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { ArrowLeft, DollarSign, Calendar, ShieldAlert, Send } from "lucide-react";

interface DemandDetail {
  id: string;
  user_id: string;
  title: string;
  description: string;
  budget: number;
  status: string;
  created_at: string;
}

export default function DemandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [demand, setDemand] = useState<DemandDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (params?.id) fetchDetail(params.id as string);
  }, [params?.id]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/demands/list?status=PENDING`);
      if (res.ok) {
        const data: DemandDetail[] = await res.json();
        const found = data.find((d) => d.id === id);
        if (found) setDemand(found);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBid = () => {
    toast.success("竞标提案申请已投递，等待需求方确认");
  };

  if (isLoading) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-400 p-6 font-mono text-xs">加载需求数据中...</div>;
  }

  if (!demand) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 p-6 space-y-4">
        <p className="text-xs">未找到该需求或已下架</p>
        <button onClick={() => router.back()} className="text-xs text-indigo-400">返回上一页</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans touch-manipulation">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => router.back()}
          className="touch-target inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4"/> 返回市场大厅
        </button>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
            <div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20">
                STATUS: {demand.status}
              </span>
              <h1 className="text-lg font-bold text-zinc-100 mt-2">{demand.title}</h1>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xs text-zinc-400">托管预算</div>
              <div className="text-lg font-mono font-bold text-emerald-400 flex items-center gap-0.5">
                <DollarSign className="w-4 h-4"/> {demand.budget.toLocaleString()}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-zinc-400 mb-2">需求描述</h2>
            <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/60">
              {demand.description}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-800/80 text-xs">
            <div className="flex items-center gap-4 text-zinc-500 font-mono text-[11px]">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> {new Date(demand.created_at).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-indigo-400"/> 担保托管中</span>
            </div>

            <button
              onClick={handleBid}
              className="touch-target px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-95 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/10 transition-transform flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5"/> 发起竞标提案
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
