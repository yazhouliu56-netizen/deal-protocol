"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface OrderSummary {
  id: string;
  status: string;
  amount: number;
  service: { id: string; title: string; category: string };
  provider: { id: string; name: string };
  reviews: { id: string }[];
}

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user: session, loading: authStatus } = useSession();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    params.then(({ id }) => setOrderId(id));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;

    fetch(`/api/orders/${orderId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load order");
        return res.json();
      })
      .then((data) => setOrder(data.contract))
      .catch(() => toast.error("加载订单信息失败"))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (authStatus) return;
    if (!session) {
      router.push("/login");
    }
  }, [session, authStatus, router]);

  useEffect(() => {
    if (order && order.reviews.length > 0 && orderId) {
      toast("您已评价过该订单", { icon: "ℹ️" });
      router.push(`/orders/${orderId}`);
    }
  }, [order, orderId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("请选择评分");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: orderId,
          rating,
          comment: comment.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "提交评价失败");
        return;
      }

      toast.success("评价成功！");
      router.push(`/orders/${orderId}`);
      router.refresh();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus || loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
        <div className="py-20 text-center">
        <p className="text-slate-500 dark:text-zinc-500">订单不存在</p>
        <Button className="mt-4 rounded-xl" onClick={() => router.push("/orders")}>
          返回订单列表
        </Button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-slate-500 dark:text-zinc-500">
        <Link href="/orders" className="hover:text-slate-900 dark:hover:text-zinc-100">
          我的订单
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/orders/${orderId}`}
          className="hover:text-slate-900 dark:hover:text-zinc-100"
        >
          订单详情
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900 dark:text-zinc-100">评价</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
        评价服务
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Order Summary */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-zinc-100">订单信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-zinc-100">
                  {order.service?.title ?? "服务订单"}
                </p>
                <p className="text-sm text-slate-500 dark:text-zinc-500">
                  服务商: {order.provider.name}
                </p>
              </div>
              <span className="text-lg font-bold text-indigo-600">
                ¥{order.amount.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Star Rating */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-zinc-100">评分</CardTitle>
            <CardDescription className="text-slate-500 dark:text-zinc-500">
              请为本次服务打分
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    className={`text-3xl transition-colors ${
                      filled
                        ? "text-yellow-400"
                        : "text-slate-500 dark:text-zinc-500/30 hover:text-yellow-300"
                    }`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star}星`}
                  >
                    {filled ? "★" : "☆"}
                  </button>
                );
              })}
              <span className="ml-3 text-sm text-slate-500 dark:text-zinc-500">
                {rating > 0
                  ? ["", "非常差", "较差", "一般", "满意", "非常满意"][rating]
                  : "点击星标评分"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Comment */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-zinc-100">评价内容</CardTitle>
            <CardDescription className="text-slate-500 dark:text-zinc-500">
              分享您的服务体验 <span className="text-slate-500 dark:text-zinc-500">(选填)</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="请输入您的评价..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            className="flex-1 rounded-xl"
            size="lg"
            disabled={submitting || rating === 0}
          >
            {submitting ? "提交中..." : "提交评价"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            size="lg"
            onClick={() => router.back()}
            disabled={submitting}
          >
            返回
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
