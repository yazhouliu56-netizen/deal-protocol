"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, ImagePlus, Square } from "lucide-react";
import SheetShell, { SheetClose } from "@/components/ui/SheetShell";
import DuoButton from "@/components/ui/DuoButton";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { resolveAmmoIdForPublish } from "@/ammo/registry";
import { FREE_PUBLISH_PER_DAY, PUBLISH_FEE } from "@/base/money/pay";
import { ageFromBirthYear, ageGate } from "@/base/safe/ageGate";
import { toast } from "@/base/platform/toast";
import { recognizeSpeech } from "@/adapters/ai/voice/asrClient";
import { trackMetric } from "@/lib/track-metric";
import IntentCard from "./IntentCard";
import { INTENT_READY_TTL_MS } from "@/base/order/intent-card";
import type { IntentCard as IntentCardData } from "@/types/intent-card";
import {
  emptyDraft,
  type TalkDraft,
} from "@/base/order/publish-draft";

/**
 * 会话发单（TalkPublish R3）：文字＋语音＋照片三模态 → interpret 多轮 →
 * 确认卡 → 与 PublishSheet/ChatPage 同一 createPendingWave 发射链。
 *
 * 六圈定位：增长圈 × 体验圈；宪法对照 #10（interpret 不可用 → 会话内降级，
 * 一键跳 PublishSheet 表单）；治理不绕行（配额/年龄/风控映射与双轨同语义）。
 */

interface Msg {
  role: "user" | "ai";
  text: string;
}

interface InterpretResponse {
  draft: TalkDraft;
  missing: string[];
  question: string | null;
  photoFacts: string[];
  source: string;
}

/** 确认卡行（纯函数，可单测）。 */
export function formatDraftLines(d: TalkDraft): string[] {
  return [
    `品类：${d.category || "（待补充）"}`,
    `时间：${d.time || "（待补充）"}`,
    `地点：${d.area || "（待补充）"}`,
    `预算：${d.budgetYuan > 0 ? `¥${d.budgetYuan}` : "（待补充）"}`,
    ...(d.note ? [`备注：${d.note}`] : []),
  ];
}

/** 会话草稿 → 意图卡（P1-T4 载体适配，纯函数可单测）。 */
export function talkDraftToIntentCard(d: TalkDraft, id: string, now = Date.now()): IntentCardData {
  return {
    id,
    scene: { ammoId: "talk", version: 0 },
    title: `${d.time || "尽快"}·${d.category || "服务需求"}`,
    lines: [
      { key: "category", label: "品类", value: d.category, source: "user", editable: true },
      { key: "time", label: "时间", value: d.time, source: "user", editable: true },
      { key: "area", label: "地点", value: d.area, source: "user", editable: true },
      { key: "budget", label: "预算", value: d.budgetYuan > 0 ? String(d.budgetYuan) : "", source: "user", editable: true },
      ...(d.note
        ? [{ key: "note", label: "备注", value: d.note, source: "ai" as const, confidence: 0.7, editable: true as const }]
        : []),
    ],
    price: {
      totalYuan: Math.max(1, d.budgetYuan),
      basis: "quote",
      changeRule: "现场加项需你点确认才加钱",
      refundRule: "师傅未上门全额退",
    },
    assurance: [{ key: "lock", label: "锁价" }],
    irreversible: ["确认发射后即进入派单，师傅接单后取消按规则扣款"],
    aiMarks: d.note ? [{ lineKey: "note", level: "mid" as const, reason: "会话描述整理" }] : [],
    state: "ready",
    expiresAt: now + INTENT_READY_TTL_MS,
    traceId: `intent-talk-${id}`,
  };
}

/** 发射拒绝映射（与 ChatPage handleConvertToWave 同语义）。 */
export function mapPublishRejection(out: {
  minorBlocked?: boolean;
  blocked?: string | null;
  removed?: boolean;
}): string | null {
  if (out.minorBlocked) return "发布被拒：未成年人账号需监护人同意后才能发布";
  if (out.blocked === "debt") return "发布被拒：你有未结清的 no-show 违约，请先结清";
  if (out.blocked === "roam") return "发布被拒：本设备命中高危多开风控，请到「安全中心」处理";
  if (out.blocked) return "发布被拒：反欺诈探针甄检到高危信号，请到「安全中心」查看";
  if (out.removed) return "内容命中违禁词，已转入平台审核";
  return null;
}

async function compressImage(file: File): Promise<string> {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(new Error("read fail"));
      r.readAsDataURL(file);
    });
    return dataUrl;
  }
}

export default function TalkPublishSheet({
  open,
  onClose,
  onFallback,
}: {
  open: boolean;
  onClose: () => void;
  /** 降级跳表单：携带已拼品类打开 PublishSheet。 */
  onFallback: (category: string) => void;
}) {
  const createPendingWave = useWaveStore((s) => s.createPendingWave);
  const payWave = useWaveStore((s) => s.payWave);
  const identity = useIdentityStore((s) => s.identity);
  const consumePublishQuota = useIdentityStore((s) => s.consumePublishQuota);
  const resetPublishQuotaIfDue = useIdentityStore((s) => s.resetPublishQuotaIfDue);

  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "说句话、发段语音或拍张照片，我来帮你拼发单。先说说：需要什么服务？" },
  ]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<TalkDraft>(emptyDraft());
  const [history, setHistory] = useState<string[]>([]);
  const [missingCount, setMissingCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<TalkDraft | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [priceTick, setPriceTick] = useState(0);
  const pubRef = useRef(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const assembledRef = useRef(false);

  // P1-T7：缺项清零（卡可确认）即 assembled（单会话一次）
  useEffect(() => {
    if (missingCount === 0 && !assembledRef.current) {
      assembledRef.current = true;
      try {
        trackMetric("intent.assembled", 1, { carrier: "talk" });
      } catch {}
    }
    if (missingCount > 0) assembledRef.current = false;
  }, [missingCount]);

  async function interpret(text: string, photos: string[]) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/publish/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history, draft, photos }),
      });
      const data = (await res.json().catch(() => null)) as InterpretResponse | null;
      if (!data || !data.draft) throw new Error("bad response");
      setDraft(data.draft);
      setEdit(data.draft);
      setHistory((h) => [...h, text].slice(-6));
      setMissingCount(data.missing.length);
      const aiText =
        data.question ??
        `拼好了：${formatDraftLines(data.draft).join("；")}。确认无误就点「确认发布」。`;
      setMsgs((m) => [...m, { role: "ai", text: aiText }]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "ai", text: "AI 暂时没连上——可以继续说，我先记着；或一键跳去表单发单。" },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function sendText() {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    setFlash(null);
    setMsgs((m) => [...m, { role: "user", text: t }]);
    void interpret(t, []);
  }

  async function sendPhotos(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    const picked = [...files].slice(0, 3);
    setMsgs((m) => [...m, { role: "user", text: `📷 附了 ${picked.length} 张照片` }]);
    try {
      const urls = await Promise.all(picked.map((f) => compressImage(f)));
      await interpret("", urls);
    } catch {
      setError("照片读取失败，请重选");
    }
  }

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        setBusy(true);
        try {
          const text = await recognizeSpeech(blob);
          if (text.trim()) {
            setMsgs((m) => [...m, { role: "user", text: `🎙 ${text.trim()}` }]);
            await interpret(text.trim(), []);
          }
        } catch {
          setError("语音没听清，请再说一次或打字");
        } finally {
          setBusy(false);
        }
      };
      rec.start();
      setRecording(true);
    } catch {
      // 无麦克风：直达浏览器语音识别（asrClient 降级链）
      try {
        const text = await recognizeSpeech(null, { preferWebSpeech: true });
        if (text.trim()) {
          setMsgs((m) => [...m, { role: "user", text: `🎙 ${text.trim()}` }]);
          await interpret(text.trim(), []);
        }
      } catch {
        setError("当前环境不支持语音，请打字或拍照");
      }
    }
  }

  function handleCardEdit(key: string, value: string) {
    try {
      trackMetric("intent.edit", 1, { carrier: "talk", field: key });
    } catch {}
    if (key === "budget") {
      const n = parseInt(value.replace(/[^\d]/g, ""), 10);
      const v = Number.isFinite(n) ? n : 0;
      setEdit((p) => {
        const prev = p ?? draft;
        if (v > 0 && prev.budgetYuan > 0 && v !== prev.budgetYuan) {
          setFlash(`¥${prev.budgetYuan}→¥${v}`);
          setPriceTick((t) => t + 1);
        }
        return { ...prev, budgetYuan: v };
      });
      return;
    }
    if (key === "note") {
      setEdit((p) => ({ ...(p ?? draft), note: value }));
      return;
    }
    setEdit((p) => ({ ...(p ?? draft), [key]: value }));
  }

  function startConfirm() {
    setEdit(draft);
    setFlash(null);
    setConfirming(true);
  }

  async function confirmPublish() {
    if (pubRef.current) return;
    const d = edit ?? draft;
    if (!d.category.trim() || !d.time.trim() || !d.area.trim() || d.budgetYuan <= 0) {
      setError("品类、时间、地点、预算请补齐再发布");
      return;
    }
    setPublishing(true);
    pubRef.current = true;
    setError("");
    try {
      const birthYear = identity.birthYear;
      const age = birthYear == null ? null : ageFromBirthYear(birthYear, new Date().getFullYear());
      if (age != null && ageGate({ age, action: "publish", guardianConsent: identity.guardianConsent }).blocked) {
        setError("发布被拒：未成年人账号需监护人同意");
        return;
      }
      resetPublishQuotaIfDue();
      const free = consumePublishQuota();
      if (!free && age != null && age < 18) {
        setError(`发布被拒：每日免费发布次数已用完（${FREE_PUBLISH_PER_DAY} 次），请明日再来`);
        return;
      }
      const out = createPendingWave({
        authorId: identity.id,
        basics: { category: d.category.trim(), time: d.time.trim(), area: d.area.trim(), radiusKm: 5 },
        budget: d.budgetYuan,
        customs: [],
        negotiable: d.note.trim().length > 0,
        negotiableNote: d.note.trim() || undefined,
        capacity: 1,
        payAmount: d.budgetYuan,
        publishFee: free ? 0 : PUBLISH_FEE,
        expiresAt: Date.now() + 7_200_000,
        hotness: 2,
        ammoId: resolveAmmoIdForPublish(d.category.trim()),
      });
      if (out === null) {
        setError("发布被拒：账号已被平台限制，请稍后或申诉");
        return;
      }
      const rejected = mapPublishRejection(out);
      if (rejected) {
        setError(rejected);
        return;
      }
      const paid = payWave(out.id);
      if (!paid.ok) {
        setError("资金托管失败，请稍后重试");
        return;
      }
      toast(`📡 会话发单成功 · ${d.category.trim()} · ¥${d.budgetYuan}`, "success");
      try {
        trackMetric("intent.confirmed", 1, { carrier: "talk" });
      } catch {}
      onClose();
    } finally {
      setPublishing(false);
      pubRef.current = false;
    }
  }

  if (!open) return null;
  return (
    <SheetShell
      onClose={onClose}
      panelClassName="fixed inset-x-3 bottom-24 z-50 bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] rounded-3xl p-4 max-h-[72vh] overflow-y-auto no-scrollbar"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">🎙 说句话发单</h3>
        <SheetClose onClose={onClose} label="关闭会话发单" />
      </div>

      <div data-testid="talk-messages" className="space-y-1.5 mb-2">
        {msgs.map((m, i) => (
          <p
            key={i}
            className={`text-xs px-2.5 py-1.5 rounded-2xl max-w-[90%] ${
              m.role === "ai"
                ? "bg-[var(--color-duo-polar)] text-[var(--color-duo-eel)]"
                : "bg-[var(--color-duo-green)] text-white ml-auto"
            }`}
          >
            {m.text}
          </p>
        ))}
        {busy && <p className="text-xs text-[var(--color-duo-hare)]">AI 拼单中…</p>}
      </div>

      {!confirming ? (
        <>
          <div className="flex gap-1.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendText();
              }}
              placeholder="说说你的需求…"
              aria-label="会话发单输入"
              className="flex-1 min-w-0 rounded-2xl bg-[var(--color-duo-polar)] border border-[var(--color-duo-swan)] px-3 py-2 text-xs text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-blue)]"
            />
            <button
              onClick={() => void toggleRecord()}
              aria-label={recording ? "停止录音" : "语音输入"}
              className={`px-2.5 rounded-2xl border-2 shrink-0 ${recording ? "bg-red-500 border-red-600 text-white" : "bg-white border-[var(--color-duo-swan)] text-[var(--color-duo-blue-ink)]"}`}
            >
              {recording ? <Square size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="拍照/选照片"
              className="px-2.5 rounded-2xl bg-white border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-blue-ink)] shrink-0"
            >
              <ImagePlus size={14} />
            </button>
            <button
              onClick={sendText}
              aria-label="发送"
              className="px-2.5 rounded-2xl bg-[var(--color-duo-green)] text-white shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              void sendPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          {missingCount === 0 && (
            <DuoButton variant="primary" size="sm" sound="correct" fullWidth className="mt-2" onClick={startConfirm}>
              草稿齐了，去确认 →
            </DuoButton>
          )}
          <button
            onClick={() => onFallback(draft.category)}
            className="w-full mt-1.5 text-xs text-[var(--color-duo-hare)]"
          >
            或跳去表单发单
          </button>
        </>
      ) : (
        <div className="space-y-1.5" data-testid="talk-intent-zone">
          <IntentCard
            card={talkDraftToIntentCard(edit ?? draft, "talk")}
            flashText={flash}
            priceTick={priceTick}
            onEditLine={handleCardEdit}
            onRelaunch={() => setConfirming(false)}
            onLaunch={() => void confirmPublish()}
          />
          <button onClick={() => setConfirming(false)} className="w-full text-xs text-[var(--color-duo-hare)]">
            ← 回会话继续说
          </button>
          {publishing && <p className="text-xs text-[var(--color-duo-hare)]">发布中…</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-bold text-red-500">
          {error}
        </p>
      )}
    </SheetShell>
  );
}
