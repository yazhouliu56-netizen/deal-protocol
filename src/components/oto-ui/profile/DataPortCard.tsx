"use client";
import DuoButton from "@/components/ui/DuoButton";
import { useRef, useState } from "react";
import { Download, Upload, Database, Check } from "lucide-react";
import {
  applySnapshot,
  collectSnapshot,
  packSnapshot,
} from "@/adapters/ui/snapshot";

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
    <div className="rounded-2xl bg-white border-2 border-[#e5e5e5] border-b-4 p-3.5">
      <div className="flex items-center gap-2">
        <Database size={13} className="text-[#1cb0f6]" />
        <span className="text-xs font-extrabold text-[#4b4b4b]">
          本地数据备份
        </span>
      </div>
      <p className="text-xs text-[#777777] mt-1 leading-relaxed">
        全量导出为 JSON 文件（本地模式数据自主权）· 导入会覆盖当前并重载
      </p>
      <div className="mt-2.5 flex gap-2">
          <DuoButton
            onClick={handleExport}
            variant="primary"
            size="sm"
            className="flex-1"
          >
            <Download size={12} /> 导出备份
          </DuoButton>
        <DuoButton
          onClick={() => fileRef.current?.click()}
          variant="outline"
          size="sm"
          sound="click"
          className="flex-1"
        >
          <Upload size={12} /> 导入恢复
        </DuoButton>
        <input
          ref={fileRef}
          name="backup-import"
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="导入数据备份文件"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {msg && (
        <p className="mt-2 px-3 py-1.5 rounded-full bg-[#58cc02]/10 border-2 border-[#58cc02]/40 text-xs font-bold text-[#357a00] flex items-center gap-1">
          <Check size={10} /> {msg}
        </p>
      )}
      {error && (
        <p className="mt-2 px-3 py-1.5 rounded-full bg-[#ff4b4b]/10 border-2 border-[#ff4b4b]/40 text-xs font-bold text-[#ea2b2b]">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}