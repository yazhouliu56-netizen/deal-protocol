"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Plus, DollarSign, Clock, ChevronRight, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

interface Demand {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: string;
  created_at: string;
}

export default function DemandsMarketplacePage() {
  const [demands, setDemands] = useState<Demand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDemands();
  }, []);

  const fetchDemands = async () => {
    try {
      const res = await fetch("/api/demands/list?status=PENDING");
      if (res.ok) {
        const data = await res.json();
        setDemands(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans touch-manipulation">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Store className="w-6 h-6"/>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">商机开放市场</h1>
              <p className="text-xs text-zinc-400 mt-0.5">全公开的开放需求撮合矩阵</p>
            </div>
          </div>
          <Link className="touch-target inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/10 transition-transform self-start sm:self-auto" href="/demands/create">
            <Plus className="w-4 h-4"/> 发布需求
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center gap-3 pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : demands.length === 0 ? (
          <div className="border border-zinc-800 bg-zinc-900/10 rounded-2xl p-16 text-center text-zinc-500 text-sm">
            <Layers className="w-8 h-8 text-zinc-700 mx-auto mb-3"/>
            暂无挂单中的需求，点击"发布需求"开启第一笔撮合。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {demands.map((item) => (
              <Link key={item.id} href={`/demands/${item.id}`} className="block touch-feedback active:scale-[0.98]">
                <div className="p-5 rounded-2xl border bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h2 className="text-sm font-bold text-zinc-100 group-hover:text-indigo-400 transition line-clamp-1">
                        {item.title}
                      </h2>
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                        <DollarSign className="w-3 h-3"/> {item.budget.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3 mb-4">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-zinc-600"/> {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-indigo-400 font-medium flex items-center gap-0.5 touch-target inline-flex">
                      查看详情 <ChevronRight className="w-3 h-3"/>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
