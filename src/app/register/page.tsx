"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["CUSTOMER"]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone, roles: selectedRoles }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "注册失败，请稍后重试");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("注册失败，请检查网络连接");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-sm rounded-2xl border-slate-200/60 shadow-sm dark:border-zinc-800/60">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
          >
            信
          </Link>
          <CardTitle className="text-xl text-slate-900 dark:text-zinc-100">注册</CardTitle>
          <CardDescription className="text-slate-500 dark:text-zinc-500">
            创建您的信用平台账户
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-slate-500 dark:text-zinc-500"
              >
                姓名
              </label>
              <Input
                id="name"
                type="text"
                placeholder="请输入您的姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-500 dark:text-zinc-500"
              >
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-slate-500 dark:text-zinc-500"
              >
                密码
              </label>
              <Input
                id="password"
                type="password"
                placeholder="请设置密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium text-slate-500 dark:text-zinc-500"
              >
                手机号（选填）
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 dark:text-zinc-500">
                注册身份（可多选）
              </label>
              <div className="flex gap-3">
                <label
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2 text-sm transition-colors ${
                    selectedRoles.includes("CUSTOMER")
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    value="CUSTOMER"
                    checked={selectedRoles.includes("CUSTOMER")}
                    onChange={() => {
                      setSelectedRoles((prev) =>
                        prev.includes("CUSTOMER")
                          ? prev.filter((r) => r !== "CUSTOMER")
                          : [...prev, "CUSTOMER"]
                      );
                    }}
                    className="sr-only"
                  />
                  客户
                </label>
                <label
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2 text-sm transition-colors ${
                    selectedRoles.includes("PROVIDER")
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    value="PROVIDER"
                    checked={selectedRoles.includes("PROVIDER")}
                    onChange={() => {
                      setSelectedRoles((prev) =>
                        prev.includes("PROVIDER")
                          ? prev.filter((r) => r !== "PROVIDER")
                          : [...prev, "PROVIDER"]
                      );
                    }}
                    className="sr-only"
                  />
                  服务商
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full rounded-xl"
              disabled={loading}
            >
              {loading ? "注册中..." : "注册"}
            </Button>
            <p className="text-center text-sm text-slate-500 dark:text-zinc-500">
              已有账户？{" "}
              <Link
                href="/login"
                className="font-medium text-indigo-600 hover:underline"
              >
                立即登录
              </Link>
            </p>
          </CardFooter>
        </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
