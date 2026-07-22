// 数据库行类型 - 对应 001_schema.sql
// 类型由 L0 契约（contracts.ts）派生，保持严格一致

import type {
  RiskTier,
  ResponseMode,
  ProtocolStatus,
  OrderStatus,
  ServicePhase,
  EscrowStatus,
  OriginType,
} from './contracts'

export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'

export interface DBUser {
  id: string
  phone: string
  nickname: string | null
  avatar_url: string | null
  role: 'demander' | 'provider' | 'both'
  identity_verified: boolean
  current_location: unknown | null
  created_at: string
  verification_status: VerificationStatus
  verification_real_name: string | null
  verification_id_number: string | null
  verification_certificates: string[]
  verification_rejected_reason: string | null
  verification_submitted_at: string | null
  verification_reviewed_at: string | null
  verification_reviewed_by: string | null
}

export interface DBCategoryConfig {
  id: string
  category: string
  risk_tier: RiskTier
  schema_json: Record<string, unknown>
  entry_requirements: Record<string, unknown> | null
  response_mode: ResponseMode
  safety_requirements: Record<string, unknown> | null
  team_formation_enabled: boolean
  enabled: boolean
  version: number
  created_at: string
}

export interface DBProtocol {
  id: string
  demander_id: string
  provider_id: string | null
  category: string
  core_fields: Record<string, unknown>
  category_fields: Record<string, unknown>
  embedding: number[] | null
  location: unknown | null
  response_mode: ResponseMode
  risk_tier: RiskTier
  funding_mode: string
  origin_type: OriginType
  status: ProtocolStatus
  final_price: number | null
  created_at: string
}

export interface DBOrder {
  id: string
  protocol_id: string
  provider_id: string
  status: OrderStatus
  service_phase: ServicePhase
  amount: number | null
  escrow_status: EscrowStatus
  platform_fee: number | null
  provider_income: number | null
  satisfaction_hold: number | null
  created_at: string
}

export interface DBCreditRecord {
  id: string
  user_id: string
  base_score: number
  base_verified_status: string
  base_fulfillment_rate: number | null
  base_violation_count: number
  base_total_deals: number
  category: string | null
  category_score: number | null
  category_order_count: number
  category_repurchase_rate: number | null
  updated_at: string
}

export interface DBEvidenceLog {
  id: string
  protocol_id: string | null
  order_id: string | null
  event_type: string
  payload: Record<string, unknown>
  payload_ref: string | null
  captured_by: string | null
  hash: string | null
  prev_hash: string | null
  created_at: string
}
