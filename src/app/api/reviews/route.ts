import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { callLLM } from "@/lib/llm";
// D-5 Phase E：协议定义资产归位 Base
import { getProtocol } from "@/base/order/protocol-definitions";
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain";
import { updateCredit } from "@/modules/m07-credit/credit-engine";
// R4-2 双轨评价：勾是真相、星是翻译（用户裁决 2026-09-16，翻译表锁定本文件）
import {
  effectiveSubjectivePass,
  subjectivePassedCount,
  type SubjectiveChecks,
} from "@/base/trust/subjective-check";
import {
  REVEAL_JITTER_MAX_DAYS,
  REVEAL_JITTER_MIN_DAYS,
  kGatePassed,
  revealAt,
} from "@/base/trust/review-privacy";
import { decayLabel } from "@/base/trust/review";
import { objectiveGoodRate, subjectiveGoodRate, toPunctualFlags } from "@/base/trust/bayesian-rating";

/** 三勾→星翻译表（默认锁定：3→5 / 2→4 / 1→2 / 0→1，改一行即换）。 */
const CHECKS_TO_STARS = [1, 2, 4, 5] as const;

function isChecks(v: unknown): v is SubjectiveChecks {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.attitude === "boolean" &&
    typeof o.appearance === "boolean" &&
    typeof o.restoration === "boolean"
  );
}

export const POST = withAuth(async (req, user) => {
  const supabase = await getRouteClient();
  const body = await req.json();
  const { contractId, rating, comment, dimensionScores, checks, tags, hasAfterPhoto } = body;

  if (!contractId) {
    return NextResponse.json({ error: "缺少订单" }, { status: 400 });
  }

  // 新轨三勾 / 老轨 1-5 星二选一（老客户端兼容）
  let effective: SubjectiveChecks | null = null;
  let stars: number | null = null;
  if (checks !== undefined) {
    if (!isChecks(checks)) {
      return NextResponse.json({ error: "三勾格式无效" }, { status: 400 });
    }
    effective = effectiveSubjectivePass({
      checks,
      hasAfterPhoto: hasAfterPhoto === true,
      tags,
      comment,
    });
    stars = CHECKS_TO_STARS[subjectivePassedCount(effective)];
  } else {
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "评分无效" }, { status: 400 });
    }
    stars = rating;
  }

  let contract: { protocol_id: string; provider_id: string; customer_id: string; fund_status: string } | null = null;
  try {
    const res = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();
    contract = res.data as { protocol_id: string; provider_id: string; customer_id: string; fund_status: string };
    if (res.error || !contract) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }
    // 双盲：供需双方皆可交，被评方 = 对方
    if (contract.customer_id !== user.id && contract.provider_id !== user.id) {
      return NextResponse.json({ error: "无权评价" }, { status: 403 });
    }
    if (contract.fund_status !== "COMPLETED" && contract.fund_status !== "SATISFACTION_HELD" && contract.fund_status !== "SETTLED") {
      return NextResponse.json({ error: "订单未完成" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "查询订单失败" }, { status: 500 });
  }

  const revieweeId =
    contract.customer_id === user.id ? contract.provider_id : contract.customer_id;

  const reviewDef = getProtocol(contract.protocol_id)?.review;

  let existing = null;
  try {
    const res = await supabase
      .from('evidence_chain')
      .select('id')
      .eq('contract_id', contractId)
      .eq('reviewer_id', user.id)
      .maybeSingle();
    existing = res.data;
  } catch (e) {
    console.warn("evidence_chain table may not exist (check):", e);
  }

  if (existing) {
    return NextResponse.json({ error: "已评价过" }, { status: 400 });
  }

  // 新表幂等（UNIQUE 遇 NULL 失效，代码层先查）
  try {
    const dup = await supabase
      .from('order_reviews')
      .select('id')
      .eq('contract_id', contractId)
      .eq('reviewer_id', user.id)
      .maybeSingle();
    if (dup.data) {
      return NextResponse.json({ error: "已评价过" }, { status: 400 });
    }
  } catch {
    /* 新表未迁移时跳过（老链路继续） */
  }

  // 老链路冻结语义：evidence_chain 继续写（星为翻译值）
  let review: { id: string } | null = null;
  let createError: unknown = null;
  try {
    const res = await supabase
      .from('evidence_chain')
      .insert({
        contract_id: contractId,
        reviewer_id: user.id,
        protocol_id: contract.protocol_id,
        rating: stars,
        dimension_scores:
          dimensionScores && reviewDef
            ? JSON.stringify(dimensionScores)
            : effective
              ? JSON.stringify(effective)
              : null,
        comment: comment || null,
      })
      .select()
      .single();
    review = res.data as { id: string };
    createError = res.error;
  } catch (e) {
    createError = e;
  }

  if (createError) {
    console.warn("Failed to create review:", JSON.stringify(createError));
    return NextResponse.json({ error: "评价提交失败", detail: JSON.stringify(createError) }, { status: 500 });
  }

  if (!review) {
    return NextResponse.json({ error: "评价提交失败" }, { status: 500 });
  }

  // 新轨落库：盲态＋随机抖动（3–7 天），钱只读勾，展示走 k 门
  if (effective) {
    const jitterDays =
      REVEAL_JITTER_MIN_DAYS +
      Math.floor(Math.random() * (REVEAL_JITTER_MAX_DAYS - REVEAL_JITTER_MIN_DAYS + 1));
    try {
      await supabase.from('order_reviews').insert({
        contract_id: contractId,
        reviewer_id: user.id,
        reviewee_id: revieweeId,
        rating: stars,
        comment: comment || null,
        checks: effective,
        tags: tags ?? null,
        has_after_photo: hasAfterPhoto === true,
        passed_count: subjectivePassedCount(effective),
        blind_state: 'blind',
        reveal_at: new Date(revealAt(Date.now(), jitterDays)).toISOString(),
        jitter_days: jitterDays,
      });
    } catch (e) {
      console.warn("order_reviews insert skipped:", e);
    }
  }

  if (reviewDef?.labelExtraction) {
    try {
      const commentText = comment || "(无文字评价)";
      const frontendCategory = "服务订单";
      const dimensionLabels = reviewDef.dimensions.map((d) => d.label).join(", ");

      const labelsPrompt = `从以下评价中提取结构化标签。只返回JSON数组格式。
评价: "${commentText}"
服务类型: "${frontendCategory}"
评价维度: ${dimensionLabels}

可能的标签方向: 正面/负面标签，如 "修好了/没修好", "准时/迟到"

返回格式: ["标签1", "标签2"]`;

      const raw = await callLLM(
        "你是一个评价分析专家，从用户评价中提取结构化标签。",
        labelsPrompt,
        { temperature: 0.2 }
      );

      try {
        await supabase
          .from('evidence_chain')
          .update({ labels: raw })
          .eq('id', review.id);
      } catch (e) {
        console.warn("Label update failed:", e);
      }
    } catch (e) {
      console.warn("Label extraction failed:", e);
    }
  }

  // 老信用链冻结语义：仅需求方评价驱动（供给方互评不进老分，新分走贝叶斯离线）
  if (contract.customer_id === user.id) {
    try {
      const ev = await appendEvidence({
        protocolId: contract.protocol_id,
        eventType: 'review_submitted',
        payload: {
          contract_id: contractId,
          reviewer_id: user.id,
          rating: stars,
        },
      });
      if (!ev) throw new Error('Failed to append evidence for review');
      await updateCredit({ userId: contract.provider_id, eventType: 'completion', evidenceId: ev.id, description: 'Review submitted' });
    } catch (e) {
      console.warn("Credit score update failed:", e);
    }
  }

  return NextResponse.json({ review, blind: true }, { status: 201 });
});

/**
 * GET /api/reviews?revieweeId=xxx
 * 服务者端只见双率（客观占位＋主观好评率），明细 k=5 门＋抖动到期才露，
 * 一律匿名（“某用户”＋模糊时间），永远不见 reviewer 身份。
 */
export const GET = withAuth(async (req, user) => {
  void user;
  const supabase = await getRouteClient();
  const { searchParams } = new URL(req.url);
  const revieweeId = searchParams.get("revieweeId");
  if (!revieweeId) {
    return NextResponse.json({ error: "缺少对象" }, { status: 400 });
  }
  const now = Date.now();
  const contractId = searchParams.get("contractId");
  // 双盲互见（双方都交即互见；超时揭晓由 cron 翻 blind_state，见 R4-3）
  let mutual = false;
  if (contractId) {
    try {
      const pair = await supabase
        .from('order_reviews')
        .select('reviewer_id')
        .eq('contract_id', contractId);
      const reviewers = new Set(((pair.data ?? []) as { reviewer_id: string }[]).map((r) => r.reviewer_id));
      mutual = reviewers.size >= 2;
    } catch {
      /* 互见未知，按不可见处理 */
    }
  }
  let rows: {
    passed_count: number | null;
    comment: string | null;
    tags: unknown;
    created_at: string;
    reveal_at: string | null;
  }[] = [];
  try {
    const res = await supabase
      .from('order_reviews')
      .select('passed_count, comment, tags, created_at, reveal_at')
      .eq('reviewee_id', revieweeId)
      .eq('blind_state', 'revealed');
    rows = (res.data ?? []) as typeof rows;
  } catch (e) {
    console.warn("order_reviews read skipped:", e);
  }
  const good = subjectiveGoodRate(
    rows.map((r) => r.passed_count ?? 0),
  );
  // R6 客观率（用户裁决 2026-09-18）：完工单派生准时 flag，有 sla_breach 记迟到；
  // 只给聚合（rate＋n），无明细；链路缺席回 null，不拦主观。
  let objective: { rate: number | null; n: number } = { rate: null, n: 0 };
  try {
    const done = await supabase
      .from('contracts')
      .select('id')
      .eq('provider_id', revieweeId)
      .in('fund_status', ['COMPLETED', 'SATISFACTION_HELD', 'SETTLED']);
    const ids = ((done.data ?? []) as { id: string }[]).map((c) => c.id);
    if (ids.length > 0) {
      const breached = await supabase
        .from('contract_events')
        .select('contract_id')
        .in('contract_id', ids)
        .eq('action', 'sla_breach');
      const breachedIds = new Set(
        ((breached.data ?? []) as { contract_id: string }[]).map((e) => e.contract_id),
      );
      objective = objectiveGoodRate(
        toPunctualFlags(ids.map((id) => ({ completed: true, breached: breachedIds.has(id) }))),
      );
    }
  } catch (e) {
    console.warn("objective rate skipped:", e);
  }
  const nowMs = now;
  const details = kGatePassed(rows.length)
    ? rows
        .filter((r) => r.reveal_at != null && nowMs >= Date.parse(r.reveal_at))
        .map((r) => ({
          alias: "某用户",
          when: decayLabel(Date.parse(r.created_at), nowMs),
          passedCount: r.passed_count,
          comment: r.comment,
          tags: r.tags,
        }))
    : [];
  // 双盲互见判定：双方都交即互见；超时揭晓由 cron 翻 blind_state（R4-3）
  return NextResponse.json({
    subjectiveGoodRate: good.rate,
    n: good.n,
    objectiveGoodRate: objective.rate,
    objectiveN: objective.n,
    kGate: kGatePassed(rows.length),
    details,
    mutual,
  });
});
