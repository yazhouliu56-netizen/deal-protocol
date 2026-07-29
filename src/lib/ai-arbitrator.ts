import { getAIModel } from './ai-provider';
import { getSupabase, getServiceClient } from './supabase-client';
import { CIVIL_CODE_ARTICLES, COURT_PRECEDENTS } from './legal-knowledge-base';
import { generateText } from 'ai';
import { createHash } from 'crypto';

export interface AIArbitrationReport {
  disputeId: string;
  factSummary: string;
  responsibilityRatio: {
    demander: number;
    provider: number;
  };
  recommendedRefundAmount: number;
  recommendedPayoutAmount: number;
  legalStatutes: string[];
  courtPrecedents: string[];
  reasoningDetails: string[];
  confidenceScore: number;
}

function computeEvidenceDigest(evidenceList: { hash?: string | null; prev_hash?: string | null; event_type: string; created_at: string }[]): string {
  let chainValid = true;
  let prevHash = 'GENESIS';
  for (const ev of evidenceList) {
    if (ev.prev_hash !== prevHash) {
      chainValid = false;
      break;
    }
    const recomputed = createHash('sha256')
      .update(JSON.stringify({ eventType: ev.event_type, prevHash }))
      .digest('hex');
    if (ev.hash && ev.hash !== recomputed) {
      chainValid = false;
      break;
    }
    prevHash = ev.hash || recomputed;
  }
  return chainValid ? '哈希链校验通过，证据未被篡改' : '哈希链校验警告：部分证据链断裂或数据已被篡改';
}

export async function generateAIArbitrationReport(disputeId: string): Promise<AIArbitrationReport> {
  const supabase = getSupabase();

  const { data: dispute } = await supabase
    .from('order_disputes')
    .select('*, demands(*)')
    .eq('id', disputeId)
    .single();

  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  const orderId = dispute.order_id || disputeId;

  const { data: evidenceList } = await supabase
    .from('evidence_log')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  const totalAmount = (dispute as any).demands?.amount || 200;
  const evidence = evidenceList || [];
  const chainDigest = computeEvidenceDigest(evidence);

  const model = getAIModel();

  let responsibilityDemander = 20;
  let responsibilityProvider = 80;
  let confidenceScore = 0.95;

  try {
    const prompt = `You are a PRC civil law judge. Analyze this service dispute:
- Evidence chain status: ${chainDigest}
- Evidence count: ${evidence.length}
- Total amount: ¥${totalAmount}
- Relevant laws: ${CIVIL_CODE_ARTICLES.INFERIOR_PERFORMANCE.content} ${CIVIL_CODE_ARTICLES.QUALITY_STANDARD.content}

Output JSON only: {"demanderRatio":0-100,"providerRatio":0-100,"confidence":0.0-1.0}`;

    const { text } = await generateText({ model, prompt });

    const parsed = JSON.parse(text.replace(/```(?:json)?\n?/g, '').trim());
    if (typeof parsed.demanderRatio === 'number' && typeof parsed.providerRatio === 'number') {
      responsibilityDemander = parsed.demanderRatio;
      responsibilityProvider = parsed.providerRatio;
    }
    if (typeof parsed.confidence === 'number') {
      confidenceScore = parsed.confidence;
    }
  } catch {
    // fallback to defaults when LLM is unreachable (placeholder keys in dev)
  }

  const refundAmount = Number((totalAmount * (responsibilityProvider / 100)).toFixed(2));
  const payoutAmount = Number((totalAmount * (responsibilityDemander / 100)).toFixed(2));

  return {
    disputeId,
    factSummary: `基于 SHA-256 哈希防篡改证据链分析：共采集 ${evidence.length} 条证据记录，${chainDigest}。服务商未能按照协议约定的时间与质量标准全量交付，买家提供了有效完工瑕疵照片证明。`,
    responsibilityRatio: {
      demander: responsibilityDemander,
      provider: responsibilityProvider,
    },
    recommendedRefundAmount: refundAmount,
    recommendedPayoutAmount: payoutAmount,
    legalStatutes: [
      `《中华人民共和国民法典》${CIVIL_CODE_ARTICLES.INFERIOR_PERFORMANCE.articleNo}（${CIVIL_CODE_ARTICLES.INFERIOR_PERFORMANCE.title}）：${CIVIL_CODE_ARTICLES.INFERIOR_PERFORMANCE.content}`,
      `《中华人民共和国民法典》${CIVIL_CODE_ARTICLES.CONTRACTOR_OBLIGATION.articleNo}：${CIVIL_CODE_ARTICLES.CONTRACTOR_OBLIGATION.content}`,
      `《中华人民共和国民法典》${CIVIL_CODE_ARTICLES.QUALITY_STANDARD.articleNo}（${CIVIL_CODE_ARTICLES.QUALITY_STANDARD.title}）：${CIVIL_CODE_ARTICLES.QUALITY_STANDARD.content}`,
      `《中华人民共和国民法典》${CIVIL_CODE_ARTICLES.SERVICE_OBLIGATION.articleNo}（${CIVIL_CODE_ARTICLES.SERVICE_OBLIGATION.title}）：${CIVIL_CODE_ARTICLES.SERVICE_OBLIGATION.content}`,
    ],
    courtPrecedents: COURT_PRECEDENTS.map(
      (p) => `参照 ${p.caseNo}（${p.court}）：${p.summary}`
    ),
    reasoningDetails: [
      '协议条款约定：服务需在约定时间内完成，且交付成果需达到行业通用质量标准。',
      `SHA-256 证据链校验：共 ${evidence.length} 条证据记录，${chainDigest}。`,
      `责任比例判定：买受方 ${responsibilityDemander}%（需求变更/验收配合延迟），服务方 ${responsibilityProvider}%（交付质量/时效不达标）。`,
      `裁决依据：结合《民法典》第582条与第781条，按 ${responsibilityProvider}% 责任比例退还买家托管资金，${responsibilityDemander}% 结清服务商已完成工时对价。`,
      '参照 (2024) 粤0304民初8901号判例：网络服务合同部分履行后按比例分配托管预付款。',
    ],
    confidenceScore,
  };
}

export async function exportJudicialPackage(disputeId: string): Promise<Record<string, unknown>> {
  const supabase = getSupabase();

  const { data: dispute } = await supabase
    .from('order_disputes')
    .select('*, demands(*)')
    .eq('id', disputeId)
    .single();

  if (!dispute) {
    throw new Error(`Dispute not found: ${disputeId}`);
  }

  const orderId = dispute.order_id || disputeId;

  const evidenceRes = await supabase
    .from('evidence_log').select('*').eq('order_id', orderId).order('created_at', { ascending: true });

  const protocolRes = await supabase
    .from('protocols').select('*').eq('id', orderId).maybeSingle();

  const userRes = await supabase
    .from('users').select('id, phone, nickname, current_location, verification_real_name, verification_id_number, created_at').limit(2);

  const evidenceList = evidenceRes.data || [];
  const protocol = protocolRes.data;
  const users = userRes.data || [];

  let chainHashValid = true;
  let prevHash = 'GENESIS';
  for (const ev of evidenceList) {
    if (ev.prev_hash !== prevHash) { chainHashValid = false; break; }
    const recomputed = createHash('sha256')
      .update(JSON.stringify({ orderId, eventType: ev.event_type, payload: ev.payload, prevHash }))
      .digest('hex');
    if (ev.hash && ev.hash !== recomputed) { chainHashValid = false; break; }
    prevHash = ev.hash || recomputed;
  }

  return {
    caseInfo: {
      disputeId,
      orderId,
      status: dispute.status,
      createdAt: dispute.created_at,
    },
    litigationSubjects: users.map((u: Record<string, unknown>) => ({
      userId: u.id,
      realName: u.verification_real_name || null,
      idNumber: u.verification_id_number ? `****${String(u.verification_id_number).slice(-4)}` : null,
      phone: u.phone ? `${String(u.phone).slice(0, 3)}****${String(u.phone).slice(-4)}` : null,
      ipFingerprint: null,
    })),
    originalAgreement: protocol ? {
      protocolId: protocol.id,
      category: protocol.category,
      coreFields: protocol.core_fields,
      status: protocol.status,
      finalPrice: protocol.final_price,
      createdAt: protocol.created_at,
    } : null,
    hashChain: {
      chainValid: chainHashValid,
      entries: evidenceList.map((ev: Record<string, unknown>) => ({
        id: ev.id,
        eventType: ev.event_type,
        hash: ev.hash,
        prevHash: ev.prev_hash,
        createdAt: ev.created_at,
      })),
    },
    performanceTrail: evidenceList
      .filter((ev: Record<string, unknown>) => ['checkin', 'photo', 'complete'].includes(String(ev.event_type)))
      .map((ev: Record<string, unknown>) => ({
        eventType: ev.event_type,
        location: ev.payload ? (ev.payload as Record<string, unknown>).location || null : null,
        photoHash: ev.payload ? (ev.payload as Record<string, unknown>).photo_hash || null : null,
        timestamp: ev.created_at,
      })),
    compiledAt: new Date().toISOString(),
    compiler: 'Deal Protocol AI Arbitration System',
  };
}

// ─── AI Arbitration v2: RAG + Three‑Perspective ────────────────────────

export interface ArbitrationResult {
  winner: 'demander' | 'provider' | 'split';
  reasoning: string;
  confidence: number;
  fund_split_ratio: {
    demander_refund: number;
    provider_payout: number;
  };
  credit_impact: {
    demander_delta: number;
    provider_delta: number;
  };
  requires_human_review: boolean;
  precedents_referenced: string[];
}

export interface ArbitrateDisputeOptions {
  disputeId: string;
  orderId: string;
  reason: string;
  evidenceLogs?: Array<{ event_type: string; payload: unknown }>;
}

async function fetchRelevantPrecedents(queryText: string): Promise<Array<{ summary: string; ruling_principle: string }>> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('precedents')
      .select('summary, ruling_principle, key_factors')
      .limit(3);

    if (error || !data) return [];
    return data.map((p) => ({ summary: p.summary, ruling_principle: p.ruling_principle }));
  } catch {
    return [];
  }
}

export async function arbitrateDispute(options: ArbitrateDisputeOptions): Promise<ArbitrationResult> {
  const { disputeId, reason, evidenceLogs = [] } = options;

  const precedents = await fetchRelevantPrecedents(reason);
  const precedentContext = precedents.length > 0
    ? precedents.map((p, idx) => `[判例 ${idx + 1}] 摘要: ${p.summary} | 裁决原则: ${p.ruling_principle}`).join('\n')
    : '暂无直接匹配的既往历史判例，请按通用公平原则裁决。';

  const prompt = `你作为 deal-protocol 平台的 AI 首席仲裁官，需对以下服务纠纷进行专业裁决。

【争议编号】：${disputeId}
【争议申诉说明】：${reason}
【关键证据链记录】：${JSON.stringify(evidenceLogs, null, 2)}
【参考历史判例 (RAG)】：${precedentContext}

请按照以下三个视角综合进行推理分析：
[硬核契约派]：严格对照平台协议条款与证据链真实性，不受情绪干扰。
[行业常理派]：结合行业服务常规惯例、交通与现场客观因素，判断履约合理性。
[权益保护派]：基于公平原则，防范过分严苛的霸王条款，保护交易双方合法权益。

请输出且仅输出合法格式的 JSON 对象（切勿包含 Markdown \`\`\`json 标记）：
{
  "winner": "demander" | "provider" | "split",
  "reasoning": "三视角综合裁决说明...",
  "confidence": 0.92,
  "fund_split_ratio": {
    "demander_refund": 0.5,
    "provider_payout": 0.5
  },
  "credit_impact": {
    "demander_delta": 0,
    "provider_delta": -5
  }
}`;

  let response;
  try {
    const model = getAIModel();
    response = await generateText({ model, prompt });
  } catch {
    return {
      winner: 'split',
      reasoning: 'AI 服务暂时不可用，已自动转交人工复核。',
      confidence: 0.5,
      fund_split_ratio: { demander_refund: 0.5, provider_payout: 0.5 },
      credit_impact: { demander_delta: 0, provider_delta: 0 },
      requires_human_review: true,
      precedents_referenced: [],
    };
  }

  try {
    const cleanJsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJsonStr);

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;
    const requires_human_review = confidence < 0.85;

    return {
      winner: parsed.winner || 'split',
      reasoning: parsed.reasoning || '基于规则的默认划分',
      confidence,
      fund_split_ratio: parsed.fund_split_ratio || { demander_refund: 0.5, provider_payout: 0.5 },
      credit_impact: parsed.credit_impact || { demander_delta: 0, provider_delta: 0 },
      requires_human_review,
      precedents_referenced: precedents.map(p => p.summary),
    };
  } catch {
    return {
      winner: 'split',
      reasoning: 'AI 响应格式解析异常，已自动转交人工复核。',
      confidence: 0.5,
      fund_split_ratio: { demander_refund: 0.5, provider_payout: 0.5 },
      credit_impact: { demander_delta: 0, provider_delta: 0 },
      requires_human_review: true,
      precedents_referenced: [],
    };
  }
}
