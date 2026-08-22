"use client";

/**
 * The "内容即开关" negotiation box — shared by both sides.
 * Empty → normal flow (direct claim); filled → 磋商 enters the funnel.
 * Grey placeholder doubles as the guidance prompt. Controlled.
 */
export default function NegotiationBox({
  value,
  onChange,
  placeholder = "想商量价格或补充条件？写下来即进入磋商（留空则直接接单）",
  rows = 2,
  label,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className="w-full">
      {label && (
        <span className="text-xs font-semibold text-white/40 block mb-1">
          {label}
        </span>
      )}
      <textarea
          name="negotiation-note"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-label={label ?? "磋商留言（可留空）"}
        className={`w-full rounded-2xl bg-white/[0.04] border text-xs leading-relaxed placeholder:text-white/25 text-white/90 outline-none transition-colors resize-none ${
          compact ? "px-3 py-2" : "px-3.5 py-2.5"
        } ${
          value.trim()
            ? "border-brandPurple/50 focus:border-brandPurple"
            : "border-white/10 focus:border-white/25"
        }`}
      />
    </div>
  );
}