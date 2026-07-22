// ============================================================
// L0 全局契约层 — 所有模块共同遵守的数据契约
// ============================================================
// 【神圣不可侵犯】任何 LLM 会话无权修改本文件。
// 如需修改走版本化流程，通知全体模块。

// ---- 品类风险等级 ----
export type RiskTier = 'low' | 'medium' | 'high';

// ---- 响应模式 ----
export type ResponseMode = 'grab_first' | 'interest_list' | 'agency_dispatch';

// ---- 协议状态 ----
export type ProtocolStatus =
  | 'draft'
  | 'pending_confirm'
  | 'pending_held'
  | 'matching'
  | 'matched'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'satisfaction_held'
  | 'settled';

// ---- 订单状态 ----
export type OrderStatus =
  | 'grabbed'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'disputed'
  | 'cancelled';

// ---- 服务阶段 ----
export type ServicePhase =
  | 'NOT_ACCEPTED'
  | 'ACCEPTED'
  | 'DEPARTED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'DONE';

// ---- 资金托管状态 ----
export type EscrowStatus =
  | 'pending'
  | 'held'
  | 'released'
  | 'refunded'
  | 'disputed';

// ---- 资金模式 ----
export type FundingMode =
  | 'full_prepay'
  | 'deposit_only'
  | 'commitment'
  | 'milestone_staged'
  | 'streaming'
  | 'subscription'
  | 'subscription_pool'
  | 'split_revenue'
  | 'crowdfunding'
  | 'pay_later'
  | 'hold_intent'
  | 'yield_escrow'
  | 'vesting_cliff'
  | 'factoring_advance'
  | 'collateral_loan'
  | 'revolving_credit'
  | 'money_pool'
  | 'reimbursement'
  | 'none';

// ---- 信用维度 ----
export type CreditDimension =
  | 'integrity'
  | 'capability'
  | 'reliability'
  | 'communication'
  | 'safety'
  | 'contribution'
  | 'category_reputation';

// ---- 证据类型 ----
export type EvidenceType =
  | 'location_ping'
  | 'photo'
  | 'chat_transcript'
  | 'rating'
  | 'report'
  | 'audit'
  | 'sos';

// ---- 协议来源类型 ----
export type OriginType = 'platform_client' | 'contractor_self_funded';

// ---- 品类配置 Schema 结构 ----
export interface CategoryFieldSchema {
  type: 'string' | 'int' | 'int_array' | 'float' | 'enum' | 'geo';
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface CategoryConfig {
  category: string;
  risk_tier: RiskTier;
  schema: {
    core_fields: Record<string, CategoryFieldSchema>;
    category_fields: Record<string, CategoryFieldSchema>;
  };
  entry_requirements: {
    identity_verified: boolean;
    qualification?: string[];
    manual_review: boolean;
  };
  response_mode: ResponseMode;
  safety_requirements: {
    full_gps_trail: boolean;
    enhanced_identity: boolean;
  };
  enabled: boolean;
  version: number;
}

// ---- 协议 JSON 结构 ----
export interface ProtocolJSON {
  protocol_id: string;
  category: string;
  core_fields: Record<string, unknown>;
  category_fields: Record<string, unknown>;
  embedding: number[];
  response_mode: ResponseMode;
  risk_tier: RiskTier;
  status: ProtocolStatus;
  origin_type: OriginType;
  funding_mode: FundingMode;
}

// ---- 匹配路由候选池 ----
export interface CandidateProvider {
  provider_id: string;
  distance_m: number;
  credit_score: number;
  category_score: number;
  skills: string[];
}

// ---- 信用事件 ----
export interface CreditEvent {
  user_id: string;
  dimension: CreditDimension;
  category?: string;
  delta: number;
  reason: string;
  evidence_id: string;
  triggered_by: 'system' | 'arbitration' | 'auto_settle' | 'admin';
  protocol_instance_id?: string;
}

// ---- 组队请求 ----
export interface TeamRequest {
  id: string;
  parent_protocol_id: string;
  leader_id: string;
  role_desc: string;
  required_skills: string[];
  reward: number;
  status: 'open' | 'filled' | 'cancelled';
  member_id?: string;
}
