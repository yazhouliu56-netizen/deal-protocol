"use client";

/**
 * 仲裁抽屉录音证据段（R-0928-09 立案解密＋展开审计）：
 * 按 disputeId 拉锚元数据（无 URL），点击播放才调回放口签发 60s URL
 * （服务端记 RECORDING_ACCESSED 审计）。未立案/无录音静默收起。
 */
import { useEffect, useState } from "react";

export interface RecordingAnchorItem {
  createdAt: string;
  tier: string | null;
  bytes: number | null;
  mime: string | null;
  hash: string;
  ref: string;
}

const TIER_LABEL: Record<string, string> = {
  A: "A 档·入户保护",
  B: "B 档·自保",
};

export function formatRecordingLine(r: RecordingAnchorItem): string {
  const tier = (r.tier && TIER_LABEL[r.tier]) || "守护录音";
  const when = r.createdAt ? new Date(r.createdAt).toLocaleString("zh-CN", { hour12: false }) : "未知时间";
  const size = typeof r.bytes === "number" ? `${(r.bytes / 1024).toFixed(1)}KB` : "未知大小";
  return `${tier} · ${when} · ${size}`;
}

export default function RecordingEvidenceSection({ disputeId }: { disputeId: string }) {
  const [items, setItems] = useState<RecordingAnchorItem[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    // 门禁同式：effect 体内零同步 setState（诉求见 useGuardWatch 注释）；
    // disputeId 切换时旧列表短暂留存（stale-while-revalidate），抽屉按争议重挂，实际不可见。
    let alive = true;
    void fetch(`/api/guard/recording?disputeId=${encodeURIComponent(disputeId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!alive) return;
        const list = (json as { items?: RecordingAnchorItem[] } | null)?.items;
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [disputeId]);

  if (items == null || items.length === 0) return null;

  const play = (ref: string) => {
    setNote("");
    void fetch(`/api/guard/recording?path=${encodeURIComponent(ref)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setNote(body.error ?? "回放失败");
          return;
        }
        const json = (await res.json()) as { url?: string };
        if (json.url) {
          setSrc(json.url);
          setPlaying(ref);
        }
      })
      .catch(() => setNote("回放失败"));
  };

  return (
    <section
      className="mt-3 p-3 rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)]"
      data-testid="evidence-recordings"
    >
      <h4 className="m-0 mb-2 text-xs font-extrabold text-[var(--color-duo-hare)]">
        🎙️ 守护录音 · 立案可听
      </h4>
      <p className="text-xs text-[var(--color-duo-wolf)]">每次播放记审计；未立案不可听。</p>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((r) => (
          <div key={r.ref} className="rounded-xl border border-zinc-200 bg-white p-2">
            <div className="text-xs font-bold text-[var(--color-duo-eel)]">{formatRecordingLine(r)}</div>
            <div className="mt-1 font-mono text-[10px] text-zinc-400" style={{ wordBreak: "break-all" }}>
              sha256:{r.hash.slice(0, 24)}…
            </div>
            <button
              type="button"
              data-testid="recording-play"
              onClick={() => play(r.ref)}
              className="touch-target mt-1.5 w-full rounded-xl bg-zinc-900 px-3 py-2 text-xs font-extrabold text-white"
            >
              {playing === r.ref ? "▶ 播放中" : "▶ 申请回放"}
            </button>
          </div>
        ))}
      </div>
      {src && (
        <audio data-testid="recording-audio" className="mt-2 w-full" controls src={src}>
          浏览器不支持音频播放
        </audio>
      )}
      {note !== "" && <p className="mt-1 text-xs font-bold text-red-700">{note}</p>}
    </section>
  );
}
