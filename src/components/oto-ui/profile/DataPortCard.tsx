"use client";
import { useRef, useState } from "react";
import { Download, Upload, Database, Check } from "lucide-react";
import {
  applySnapshot,
  collectSnapshot,
  packSnapshot,
} from "@/base/platform/snapshot";

/** 本地数据备份（数据自主权）：导出全库 JSON / 导入回灌后整页重载。 */
export default function DataPortCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    try {
      const snap = collectSnapshot(window.localStorage);
      if (snap.keys.length === 0) {
        setError("本地还没有数据可导出");
        setMsg(null);
        return;
      }
      const blob = new Blob([packSnapshot(snap)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oto-spatial-snapshot-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`已导出 ${snap.keys.length} 项本地数据`);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
      setMsg(null);
    }
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    void f.text().then((text) => {
      const out = applySnapshot(window.localStorage, text);
      if (out.error) {
        setError(out.error);
        setMsg(null);
        return;
      }
      setMsg(`已回灌 ${out.applied.length} 项，正在重启应用…`);
      setError(null);
      setTimeout(() => window.location.reload(), 350);
    });
  };

  return (
    <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3.5">
      <div className="flex items-center gap-2">
        <Database size={13} className="text-brandPurple" />
        <span className="text-xs font-extrabold text-white/85">
          本地数据备份
        </span>
      </div>
      <p className="text-xs text-white/45 mt-1 leading-relaxed">
        全量导出为 JSON 文件（本地模式数据自主权）· 导入会覆盖当前并重载
      </p>
      <div className="mt-2.5 flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 py-2 rounded-xl btn-primary text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
        >
          <Download size={12} /> 导出备份
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 text-white/70 hover:bg-white/10 transition-colors"
        >
          <Upload size={12} /> 导入恢复
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="导入数据备份文件"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {msg && (
        <p className="mt-2 px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-xs font-bold text-emerald-300 flex items-center gap-1">
          <Check size={10} /> {msg}
        </p>
      )}
      {error && (
        <p className="mt-2 px-3 py-1.5 rounded-full bg-red-400/10 border border-red-400/30 text-xs font-bold text-red-300">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}