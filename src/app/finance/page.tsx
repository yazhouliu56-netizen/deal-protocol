"use client";

import React, { useEffect, useState } from "react";
import { Wallet, ArrowUpRight, ArrowDownLeft, ShieldCheck, Clock, RefreshCw, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/SessionProvider";
import { useFinanceRealtime } from "@/hooks/use-finance-realtime";
import WithdrawModal from "@/components/WithdrawModal";

interface FinanceOverview {
  totalEarned: number;
  totalInEscrow: number;
  availableBalance: number;
  pendingWithdrawal: number;
  completedOrderCount: number;
  activeEscrowOrderCount: number;
}

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  title: string;
  status: string;
  created_at: string;
}

export default function FinanceDashboardPage() {
  const { user } = useSession();
  const [overview, setOverview] = useState<FinanceOverview>({
    totalEarned: 0,
    totalInEscrow: 0,
    availableBalance: 0,
    pendingWithdrawal: 0,
    completedOrderCount: 0,
    activeEscrowOrderCount: 0
  });
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState<boolean>(false);

  const realtime = useFinanceRealtime(
    user?.id,
    { balance: overview.availableBalance, pendingWithdrawal: overview.pendingWithdrawal },
  );

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (realtime.balance !== undefined) {
      setOverview((prev) => ({ ...prev, availableBalance: realtime.balance }))
    }
  }, [realtime.balance])

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ovRes, txRes] = await Promise.all([
        fetch("/api/finance/overview"),
        fetch("/api/finance/transactions")
      ]);

      if (ovRes.ok) {
        const ovData = await ovRes.json();
        if (ovData.data) {
          setOverview(ovData.data);
          realtime.setBalance(ovData.data.availableBalance);
          realtime.setPendingWithdrawal(ovData.data.pendingWithdrawal);
        }
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        if (txData.data) setTransactions(txData.data);
      }
    } catch (e) {
      console.error("加载资金仪表盘失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Wallet className="w-6 h-6"/>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">资金结算与开发者仪表盘</h1>
              <p className="text-xs text-zinc-400 mt-1">资金托管监控、合约结算收益与无缝提现</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="touch-target flex items-center justify-center p-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-xl transition active:scale-95"
              title="刷新数据"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}/>
            </button>
            <button
              onClick={() => setIsWithdrawOpen(true)}
              className="touch-target px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition-transform shadow-lg shadow-emerald-600/10 flex items-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4"/> 收益提现
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={cn(
            "bg-zinc-900/50 border rounded-2xl p-4 space-y-2 transition-all duration-500 touch-feedback active:scale-[0.98]",
            realtime.isBalanceAnimating
              ? "border-emerald-400/60 shadow-[0_0_20px_rgba(52,211,153,0.15)]"
              : "border-zinc-800",
          )}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>可提现余额</span>
              <DollarSign className="w-4 h-4 text-emerald-400"/>
            </div>
            <div className={cn(
              "text-2xl font-mono font-bold transition-colors duration-500",
              realtime.isBalanceAnimating ? "text-emerald-300" : "text-emerald-400",
            )}>
              ¥{overview.availableBalance.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500">已自动扣除平台服务与系统结算费</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2 touch-feedback active:scale-[0.98]">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>托管中资金</span>
              <ShieldCheck className="w-4 h-4 text-amber-400"/>
            </div>
            <div className="text-2xl font-mono font-bold text-amber-400">
              ¥{overview.totalInEscrow.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500">涉及 {overview.activeEscrowOrderCount} 个履约中订单</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2 touch-feedback active:scale-[0.98]">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>历史总收益</span>
              <ArrowDownLeft className="w-4 h-4 text-indigo-400"/>
            </div>
            <div className="text-2xl font-mono font-bold text-indigo-400">
              ¥{overview.totalEarned.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500">累计完成 {overview.completedOrderCount} 笔交付订单</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-2 touch-feedback active:scale-[0.98]">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>提现审核中</span>
              <Clock className="w-4 h-4 text-zinc-400"/>
            </div>
            <div className="text-2xl font-mono font-bold text-zinc-200">
              ¥{overview.pendingWithdrawal.toLocaleString()}
            </div>
            <div className="text-[10px] text-zinc-500">预计 24 小时内划转完毕</div>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h2 className="text-sm font-bold text-zinc-200">资金流动明细记录</h2>
            <span className="text-[11px] font-mono text-zinc-500">近 50 条账单记录</span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-800 p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-xs text-zinc-500 font-mono">尚无任何交易流水记录</p>
              <p className="text-[11px] text-zinc-600">当产生托管订单、验收结案或提现时，变动明细将在此罗列。</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <div className="min-w-[360px] divide-y divide-zinc-800/60">
                {transactions.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-medium text-zinc-200 truncate">{item.title || "订单结算 / 交易记录"}</div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        {new Date(item.created_at).toLocaleString("zh-CN")} · ID: {item.id.slice(0, 8)}
                      </div>
                    </div>

                    <div className="text-right space-y-1 shrink-0">
                      <div className={`font-mono font-bold ${
                        item.type === "INCOME" || item.status === "COMPLETED"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}>
                        {item.type === "INCOME" || item.status === "COMPLETED" ? "+" : ""}¥{Number(item.amount).toLocaleString()}
                      </div>
                      <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        availableBalance={overview.availableBalance}
        onSuccess={loadData}
      />
    </div>
  );
}
