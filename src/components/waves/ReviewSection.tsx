"use client";
import { useEffect, useState } from "react";
import { Star, Send, ShieldCheck } from "lucide-react";
import DuoButton from "@/components/ui/DuoButton";
import DuoCardShell from "@/components/ui/DuoCardShell";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
import { RISE_8 } from "@/components/ui/motion";
import FriendKit from "./FriendKit";
import { useWaveStore } from "@/store/useWaveStore";
import type { Claim, Wave } from "@/base/order/wave";
import {
  createReview,
  decayLabel,
  REVIEW_WINDOW_MS,
} from "@/base/trust/review";
import {
  SUBJECTIVE_RUBRICS,
  SUBJECTIVE_SUGGESTED_TAGS,
  subjectivePassedCount,
  type SubjectiveChecks,
  type SubjectiveItem,
} from "@/base/trust/subjective-check";
import { REVIEW_K_ANONYMITY } from "@/base/trust/review-privacy";
import { useMountedNow } from "@/lib/use-mounted-now";

/**
 * 双轨评价入口（R4-4 · 用户裁决 2026-09-16）：
 * 主观三勾（默认全勾，取消才弹 Tag，可选）＋客观轨走系统（SLA/证据，不在这里打分）；
 * 复原项以完工 after 图为准（本入口无传图位，置灰提示，由举证门判定）。
 * 双盲 72h：对方未互评前不见对方评价；明细 k=5 门＋匿名＋模糊时间。
 * 提交双写：内存 store（即时 UX，老路）＋ POST /api/reviews（落库，失败仅 warn）。
 */

const CHECK_LABEL: Record<SubjectiveItem, string> = {
  attitude: "态度",
  appearance: "仪容",
  restoration: "复原",
};

/** 三勾→星翻译（与路由 CHECKS_TO_STARS 同表，改一边必须改另一边）。 */
const CHECKS_TO_STARS = [1, 2, 4, 5] as const;

/** 老内存 Review 只有三维 1–5：legacy 兼容映射（真相在 checks，不在这里）。 */
function checksToLegacyDims(c: SubjectiveChecks): { punctual: number; attitude: number; professional: number } {
  return {
    punctual: 5,
    attitude: c.attitude ? 5 : 2,
    professional: c.restoration && c.appearance ? 5 : 2,
  };
}

interface AggregateState {
  mutual: boolean | null;
  kGate: boolean;
  goodRate: number | null;
  n: number;
  details: { alias: string; when: string; passedCount: number; comment: string | null; tags: unknown }[];
}

export default function ReviewSection({
  claim,
  myId,
  peerId,
}: {
  claim: Claim;
  wave: Wave;
  myId: string;
  peerId: string;
}) {
  const reviews = useWaveStore((s) => s.reviews);
  const addReview = useWaveStore((s) => s.addReview);
  const editReview = useWaveStore((s) => s.editReview);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  // 撤销窗：正在修改的评价 id（null = 新建）
  const [editingId, setEditingId] = useState<string | null>(null);
  // 评价二次确认（提交后不可修改，72h 窗内单次）
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  // SSR/首帧同构探针（page.tsx 同款 idiom）：首帧 now=0 两端一致防 Hydration Mismatch，
  const now = useMountedNow();
  const [checks, setChecks] = useState<SubjectiveChecks>({
    attitude: true,
    appearance: true,
    restoration: true,
  });
  const [tags, setTags] = useState<Record<SubjectiveItem, string[]>>({
    attitude: [],
    appearance: [],
    restoration: [],
  });
  // 聚合＋双盲态（失败回落 null＝老渲染，韧性优先）
  const [agg, setAgg] = useState<AggregateState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/reviews?revieweeId=${encodeURIComponent(peerId)}&contractId=${encodeURIComponent(claim.id)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setAgg({
            mutual: typeof data.mutual === "boolean" ? data.mutual : null,
            kGate: data.kGate === true,
            goodRate: typeof data.subjectiveGoodRate === "number" ? data.subjectiveGoodRate : null,
            n: typeof data.n === "number" ? data.n : 0,
            details: Array.isArray(data.details) ? data.details : [],
          });
        }
      } catch {
        /* 落库链路缺席＝老渲染，不拦评价 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claim.id, peerId]);

  const mine = reviews.find(
    (r) => r.claimId === claim.id && r.fromId === myId
  );
  const theirs = reviews.find(
    (r) => r.claimId === claim.id && r.fromId === peerId
  );
  if (!claim.fulfilledAt) return null;

  const passed = subjectivePassedCount(checks);
  const stars = CHECKS_TO_STARS[passed] ?? 5;
  // 双盲：明确未互见时隐藏对方评价；未知（链路缺席）回落老渲染
  const theirsHidden = agg?.mutual === false;

  function toggleCheck(item: SubjectiveItem) {
    setChecks((c) => ({ ...c, [item]: !c[item] }));
  }

  function toggleTag(item: SubjectiveItem, tag: string) {
    setTags((t) => {
      const has = t[item].includes(tag);
      return { ...t, [item]: has ? t[item].filter((x) => x !== tag) : [...t[item], tag] };
    });
  }

  function submit() {
    // 新轨 Tag/原因恒不强制（tagRequired()=false），直接进二次确认
    setConfirmSubmit(true);
  }

  function doSubmit() {
    const payload = {
      contractId: claim.id,
      checks,
      tags,
      // 本入口无传图位：复原项由举证门按 after 图判定（未传图自动不通过，已在行内提示）
      hasAfterPhoto: false,
      comment: comment.trim() || undefined,
    };
    // 落库链路（失败仅 warn，内存老路照走）
    try {
      void fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => {
        if (!res.ok) console.warn("[ReviewSection] review persist skipped:", res.status);
      }).catch((e) => console.warn("[ReviewSection] review persist skipped:", e));
    } catch (e) {
      console.warn("[ReviewSection] review persist skipped:", e);
    }
    if (editingId) {
      const out = editReview(
        editingId,
        { dimensions: checksToLegacyDims(checks), comment: comment.trim() || undefined },
        myId
      );
      if (!out.ok) return;
      setEditingId(null);
    } else {
      addReview(
        createReview({
          id: `review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          claimId: claim.id,
          fromId: myId,
          toId: peerId,
          dimensions: checksToLegacyDims(checks),
          comment: comment.trim() || undefined,
          at: Date.now(),
        })
      );
    }
    setOpen(false);
    setConfirmSubmit(false);
  }

  /** 撤销窗可改：未改过且提交 72h 内（首帧 now=0 时隐藏，防 Hydration 抖动）。 */
  const editable =
    mine != null && (mine.editCount ?? 0) < 1 && now > 0 && now - mine.at <= REVIEW_WINDOW_MS;

  function startEdit() {
    if (!mine) return;
    // 老内存维回填（legacy 兼容映射的逆：仪容位无处恢复，默认勾上，由用户复核）
    setChecks({
      attitude: mine.dimensions.attitude >= 4,
      appearance: true,
      restoration: mine.dimensions.professional >= 4,
    });
    setComment(mine.comment ?? "");
    setEditingId(mine.id);
    setOpen(true);
  }

  const checkRow = (item: SubjectiveItem, disabled = false) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-duo-wolf)]" title={SUBJECTIVE_RUBRICS[item]}>
          {CHECK_LABEL[item]}
          {disabled && <span className="ml-1 text-[var(--color-duo-hare)]">（以完工图为准）</span>}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => toggleCheck(item)}
          aria-label={`${CHECK_LABEL[item]}${checks[item] ? "通过" : "不通过"}`}
          className={`w-11 h-6 rounded-full text-xs font-bold border-2 transition-colors ${
            checks[item]
              ? "bg-[var(--color-duo-green)]/15 text-[var(--color-duo-green-ink)] border-[var(--color-duo-green)]/60"
              : "bg-white text-[var(--color-duo-hare)] border-[var(--color-duo-swan)]"
          } ${disabled ? "opacity-50" : ""}`}
        >
          {checks[item] ? "✓" : "✕"}
        </button>
      </div>
      {!checks[item] && !disabled && (
        <div className="flex flex-wrap gap-1">
          {SUBJECTIVE_SUGGESTED_TAGS[item].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(item, tag)}
              className={`text-xs px-2 py-0.5 rounded-full border-2 ${
                tags[item].includes(tag)
                  ? "bg-[var(--color-duo-blue)]/15 text-[var(--color-duo-blue-ink)] border-[var(--color-duo-blue)]/60"
                  : "bg-white text-[var(--color-duo-hare)] border-[var(--color-duo-swan)]"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-1.5">
      {/* 对方给我的评价（双盲未揭晓前隐藏；揭晓后脱敏＋时间衰减） */}
      {theirsHidden ? (
        <p className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-hare)]">
          🔒 对方评价双盲中，双方都评或 72 小时后揭晓
        </p>
      ) : (
        theirs && (
          <p className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[var(--color-duo-green)]/10 border-2 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)] flex items-start gap-1.5">
            <ShieldCheck size={10} className="mt-0.5 shrink-0" />
            <span>
              对方评价 ★{theirs.score} · {decayLabel(theirs.at, now)}
              {theirs.comment && ` · ${theirs.comment.slice(0, 24)}`}
              <span className="text-[var(--color-duo-hare)] ml-1">（脱敏）</span>
            </span>
          </p>
        )
      )}

      {/* 对方聚合双率（k 门未过只显示积累中，不露明细） */}
      {agg && agg.n > 0 && (
        <p className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)]">
          {agg.goodRate != null
            ? `对方主观好评率 ${Math.round(agg.goodRate * 100)}% · ${agg.n} 单`
            : `对方评价积累中（${REVIEW_K_ANONYMITY} 条后展示明细）`}
        </p>
      )}

      {/* 匿名明细（k 门＋抖动到期，路由层已过滤） */}
      {agg?.kGate && agg.details.length > 0 && (
        <div className="space-y-1">
          {agg.details.slice(0, 3).map((d, i) => (
            <p key={i} className="text-xs px-2.5 py-1.5 rounded-xl bg-white border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)]">
              {d.alias} · {d.when}
              {d.comment && ` · ${d.comment.slice(0, 24)}`}
            </p>
          ))}
        </div>
      )}

      {/* 我的评价 / 评价入口 */}
      {mine ? (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-[var(--color-duo-wolf)]">
            ✅ 已评价 ★{mine.score} · {decayLabel(mine.at, now)}
            {mine.editCount ? "（已修改）" : ""}
          </p>
          {editable && !open && (
            <button
              type="button"
              onClick={startEdit}
              data-testid="edit-review"
              className="shrink-0 text-xs font-bold text-[var(--color-duo-blue-ink)] underline underline-offset-2"
            >
              修改（仅1次）
            </button>
          )}
        </div>
      ) : (
        <DuoButton variant="outline" size="sm" sound="click" fullWidth onClick={() => setOpen(true)}>
          ⭐ 评价对方（72 小时内）
        </DuoButton>
      )}

      {open && (
        <DuoCardShell
          motion={{ initial: RISE_8.initial, animate: RISE_8.animate }}
          className="rounded-2xl border-b-4 p-3 space-y-2"
        >
          <p className="text-xs font-extrabold text-[var(--color-duo-eel)]">
            {editingId ? "修改评价（仅 1 次机会）" : "给对方打分"}
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <span key={v} aria-label={`总分${v}星`}>
                <Star
                  size={18}
                  className={v <= stars ? "text-[var(--color-duo-yellow)] fill-[var(--color-duo-yellow)]" : "text-[var(--color-duo-swan)]"}
                />
              </span>
            ))}
            <span className="text-xs font-bold text-[var(--color-duo-wolf)] ml-1">三勾折 {stars} 星</span>
          </div>
          <div className="space-y-1.5">
            {checkRow("attitude")}
            {checkRow("appearance")}
            {checkRow("restoration", true)}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="说两句（可选，脱敏展示）"
            aria-label="评价留言"
            rows={2}
            className="w-full rounded-xl bg-white border-2 px-2.5 py-2 text-xs placeholder:text-[var(--color-duo-hare)] text-[var(--color-duo-eel)] outline-none focus:border-[var(--color-duo-blue)] resize-none border-[var(--color-duo-swan)]"
          />
          <DuoButton
            onClick={submit}
            variant="primary"
            size="sm"
            fullWidth
          >
            <Send size={11} /> {editingId ? "确认修改" : "提交评价"}
          </DuoButton>
        </DuoCardShell>
      )}
      {/* 评价二次确认（Batch②：新建落子 / 撤销窗修改各走一次确认） */}
      {confirmSubmit && (
        <ConfirmSheet
          title={editingId ? `确认修改为 ${stars} 星？` : `确认给对方 ${stars} 星？`}
          body={
            editingId
              ? "这是唯一一次修改机会，确认后不可再改。"
              : "提交后不可修改，72 小时内单次有效，对方将看到脱敏评价。"
          }
          confirmLabel={editingId ? "确认修改" : "提交评价"}
          onConfirm={doSubmit}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}

      {/* S3 关系沉淀：一次成功后，双方可自愿转友（72h 未确认自动撤回） */}
      <FriendKit claim={claim} myId={myId} peerId={peerId} />
    </div>
  );
}
