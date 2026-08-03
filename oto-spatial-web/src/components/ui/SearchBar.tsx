"use client";
import { useRef } from "react";
import { QrCode, Search, SlidersHorizontal, X } from "lucide-react";
import GlassIconButton from "./GlassIconButton";

/** Glass search bar with QR scan + filter actions. */
export default function SearchBar({
  placeholder,
  value,
  onChange,
  onSearch,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSearch?: () => void;
}) {
  const composingRef = useRef(false);
  return (
    <div className="flex items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (composingRef.current) return;
          onSearch?.();
        }}
        className="glass-panel rounded-2xl p-3 flex items-center gap-3 flex-1"
      >
        <Search size={15} className="text-white/40 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => (composingRef.current = true)}
          onCompositionEnd={() => (composingRef.current = false)}
          placeholder={placeholder}
          aria-label="搜索 OTO 体验"
          className="bg-transparent text-xs outline-none w-full placeholder:text-white/30"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="清空搜索"
            className="text-white/40 hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </form>
      <GlassIconButton aria-label="扫码识别" tone="cyan">
        <QrCode size={15} />
      </GlassIconButton>
      <GlassIconButton aria-label="筛选体验">
        <SlidersHorizontal size={15} />
      </GlassIconButton>
    </div>
  );
}
