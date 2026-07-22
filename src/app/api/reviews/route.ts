import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";
import { callLLM } from "@/lib/llm";
import { getEngine } from "@/lib/protocol/engine";
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain";
import { updateCredit } from "@/modules/m07-credit/credit-engine";

export const POST = withAuth(async (req, user) => {
  const supabase = await getRouteClient();
  const body = await req.json();
  const { contractId, rating, comment, dimensionScores } = body;

  if (!contractId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "评分无效" }, { status: 400 });
  }

  let contract: any = null;
  try {
    const res = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single();
    contract = res.data;
    if (res.error || !contract) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }
    if (contract.customer_id !== user.id) {
      return NextResponse.json({ error: "无权评价" }, { status: 403 });
    }
    if (contract.fund_status !== "COMPLETED" && contract.fund_status !== "SATISFACTION_HELD" && contract.fund_status !== "SETTLED") {
      return NextResponse.json({ error: "订单未完成" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "查询订单失败" }, { status: 500 });
  }

  const engine = getEngine(contract.protocol_id);
  const reviewDef = engine?.getDefinition().review;

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

  let review: any = null;
  let createError: any = null;
  try {
    const res = await supabase
      .from('evidence_chain')
      .insert({
        contract_id: contractId,
        reviewer_id: user.id,
        protocol_id: contract.protocol_id,
        rating,
        dimension_scores: dimensionScores && reviewDef ? JSON.stringify(dimensionScores) : null,
        comment: comment || null,
      })
      .select()
      .single();
    review = res.data;
    createError = res.error;
  } catch (e) {
    createError = e;
  }

  if (createError) {
    console.warn("Failed to create review:", JSON.stringify(createError));
    return NextResponse.json({ error: "评价提交失败", detail: JSON.stringify(createError) }, { status: 500 });
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

  try {
    const ev = await appendEvidence({
      protocolId: contract.protocol_id,
      eventType: 'review_submitted',
      payload: {
        contract_id: contractId,
        reviewer_id: user.id,
        rating,
      },
    });
    if (!ev) throw new Error('Failed to append evidence for review');
    await updateCredit({ userId: contract.provider_id, eventType: 'completion', evidenceId: ev.id, description: 'Review submitted' });
  } catch (e) {
    console.warn("Credit score update failed:", e);
  }

  return NextResponse.json({ review }, { status: 201 });
});
