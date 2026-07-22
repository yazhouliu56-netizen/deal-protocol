"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { PlusCircle, ArrowLeft, DollarSign, FileText, Tag } from "lucide-react";

export default function CreateDemandPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !budget || parseFloat(budget) <= 0) {
      toast.error("请完整填写需求参数与有效预算");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("正在托管需求至智能撮合网格...");

    try {
      const res = await fetch("/api/demands/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          budget: parseFloat(budget)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发布失败");

      toast.success("需求发布成功，已挂载至商机网格", { id: toastId });
      router.push("/demands");
    } catch (err: any) {
      toast.error(`发布中断: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-sans touch-manipulation">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => router.back()}
          className="touch-target inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4"/> 返回上一页
        </button>

        <div className="border-b border-zinc-800 pb-4">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-indigo-400"/> 发布新外包需求
          </h1>
          <p className="text-xs text-zinc-400 mt-1">提交需求后将自动计算向量特征并广播至 AI 撮合雷达</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-zinc-900/40 border border-zinc-800 p-6 rounded-2xl">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400"/> 需求标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：全栈 Next.js 14 + Supabase 平台重构"
              className="touch-target w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-zinc-400"/> 托管预算 (CNY)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="5000"
              className="touch-target w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400"/> 需求详细描述与交付标准
            </label>
            <textarea
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细说明业务流程、技术栈要求、交付期限以及验收指标..."
              className="touch-target w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 active:scale-[0.98] disabled:bg-indigo-600/50 text-white text-xs font-semibold rounded-xl transition-transform shadow-lg shadow-indigo-600/10"
          >
            {isSubmitting ? "正在写入网络..." : "确认发布并托管资金"}
          </button>
        </form>
      </div>
    </div>
  );
}
