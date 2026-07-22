"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/SessionProvider";
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface ProtocolVersion {
  id: string;
  version: string;
  created_at: string;
  config: string;
}

interface Protocol {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  created_at: string;
  versions: ProtocolVersion[];
}

export default function AdminProtocolsPage() {
  const { user: session, loading } = useSession();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadProtocols = async () => {
    const res = await fetch("/api/admin/protocols");
    if (!res.ok) return;
    const data = await res.json();
    setProtocols(data.protocols ?? []);
    setPageLoading(false);
  };

  useEffect(() => {
    if (session?.role === "ADMIN") loadProtocols();
  }, [session]);

  const toggleProtocol = async (id: string, enabled: boolean) => {
    setToggling(id);
    try {
      const res = await fetch(`/api/admin/protocols/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "操作失败");
        return;
      }
      toast.success(`协议已${enabled ? "禁用" : "启用"}`);
      await loadProtocols();
    } catch {
      toast.error("网络错误");
    } finally {
      setToggling(null);
    }
  };

  const reloadProtocols = async () => {
    await fetch("/api/admin/protocols", { method: "POST" });
    toast.success("协议已从代码重新加载");
    await loadProtocols();
  };

  if (loading || pageLoading) {
    return (
      <>
        <p className="text-center text-muted-foreground">加载中...</p>
      </>
    );
  }

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">协议管理</h1>
          <p className="mt-1 text-muted-foreground">
            管理平台交易协议，启用的协议可在发布服务时选择
          </p>
        </div>
        <Button variant="outline" onClick={reloadProtocols}>
          从代码重新加载
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>协议名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>版本</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {protocols.map((p) => {
                const latestVersion = p.versions[0]?.version ?? "—";
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.id}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>{latestVersion}</TableCell>
                    <TableCell>
                      <Badge className={p.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}>
                        {p.enabled ? "已启用" : "已禁用"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={p.enabled ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleProtocol(p.id, p.enabled)}
                        disabled={toggling === p.id}
                      >
                        {p.enabled ? "禁用" : "启用"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
