"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PublicProfile {
  id: string;
  creditScore: number;
  totalOrders: number;
  completionRate: number;
  avgRating: number;
  reviewCount: number;
  disputeLosses: number;
  memberSince: string;
}

const MAX_CREDIT = 300;

function getCreditLevel(score: number) {
  if (score >= 200) return { label: "优秀", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
  if (score >= 150) return { label: "良好", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
  if (score >= 100) return { label: "一般", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: "待提升", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
}

export default function PublicUserPage() {
  const params = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = params.id as string;
    if (!userId) return;

    fetch(`/api/user/${userId}`)
      .then((res) => {
        if (!res.ok) throw new Error("用户不存在");
        return res.json();
      })
      .then((data) => {
        setProfile(data.user);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 space-y-4">
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">用户不存在</h1>
        <p className="mt-2 text-muted-foreground">该用户不存在或已注销</p>
      </div>
    );
  }

  const creditLevel = getCreditLevel(profile.creditScore);
  const creditPercent = Math.min((profile.creditScore / MAX_CREDIT) * 100, 100);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Identity badge */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">
          U
        </div>
        <p className="text-lg font-semibold text-foreground">匿名用户</p>
        <Badge variant="secondary" className="text-xs">公开资料</Badge>
      </div>

      <div className="mt-8 space-y-4">
        {/* Credit score card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white shadow-lg">
                  {profile.creditScore}
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">信用评分</p>
                <Badge className={`mt-1 ${creditLevel.color}`}>{creditLevel.label}</Badge>
              </div>
              <div className="w-full max-w-xs sm:flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">信用等级</span>
                  <span className="font-medium text-foreground">{profile.creditScore} / {MAX_CREDIT}</span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${creditPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">交易统计</CardTitle>
            <CardDescription>公开的交易数据摘要</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">总订单</p>
                <p className="text-lg font-semibold text-foreground">{profile.totalOrders}</p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">完成率</p>
                <p className="text-lg font-semibold text-foreground">{profile.completionRate}%</p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">评分</p>
                <p className="text-lg font-semibold text-foreground">
                  {profile.avgRating > 0 ? `${profile.avgRating}/5` : "暂无"}
                </p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">评价数</p>
                <p className="text-lg font-semibold text-foreground">{profile.reviewCount}</p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">争议失利</p>
                <p className="text-lg font-semibold text-foreground">{profile.disputeLosses}</p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">加入时间</p>
                <p className="text-lg font-semibold text-foreground">
                  {new Date(profile.memberSince).toLocaleDateString("zh-CN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
