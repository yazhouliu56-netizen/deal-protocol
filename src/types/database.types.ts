export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          phone: string
          nickname: string | null
          avatar_url: string | null
          role: 'user' | 'demander' | 'provider' | 'admin'
          identity_verified: boolean
          current_location: unknown | null
          bio: string | null
          skills: Json
          service_areas: string | null
          verification_status: 'unverified' | 'pending' | 'approved' | 'rejected'
          verification_real_name: string | null
          verification_id_number: string | null
          verification_certificates: Json
          verification_rejected_reason: string | null
          verification_submitted_at: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          reputation_score: number
          compliance_status: string
          onboarding_completed: boolean
          trust_tier: number
          provider_stake_status: 'none' | 'staked' | 'unstaking'
          referrer_id: string | null
          is_agent: boolean
          agent_webhook_url: string | null
          deleted_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      users: {
        Row: {
          id: string
          phone: string
          nickname: string | null
          avatar_url: string | null
          role: 'demander' | 'provider' | 'both' | 'admin'
          identity_verified: boolean
          current_location: unknown | null
          deleted_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      category_configs: {
        Row: {
          id: string
          category: string
          risk_tier: 'low' | 'medium' | 'high'
          schema_json: Json
          entry_requirements: Json | null
          response_mode: 'grab_first' | 'interest_list' | 'agency_dispatch'
          safety_requirements: Json | null
          team_formation_enabled: boolean
          enabled: boolean
          version: number
          protocol_meta: Json
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['category_configs']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['category_configs']['Insert']>
      }
      pricing_configs: {
        Row: {
          id: string
          category: string
          default_work_hours: number
          min_price: number
          warranty_months: number | null
          warranty_text: string | null
          material_markup: number
          fixed_quote_max_minutes: number
          enabled: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['pricing_configs']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['pricing_configs']['Insert']>
      }
      protocols: {
        Row: {
          id: string
          demander_id: string
          provider_id: string | null
          category: string
          core_fields: Json
          category_fields: Json
          embedding: number[] | null
          location: unknown | null
          response_mode: string
          risk_tier: string
          funding_mode: string
          origin_type: 'platform_client' | 'contractor_self_funded'
          status: 'draft' | 'pending_confirm' | 'pending_held' | 'matching' | 'matched' | 'completed' | 'disputed' | 'cancelled' | 'satisfaction_held' | 'settled' | 'rejected'
          final_price: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['protocols']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['protocols']['Insert']>
      }
      demands: {
        Row: {
          id: string
          demander_id: string
          title: string
          description: string | null
          budget: number | null
          status: string
          embedding: number[] | null
          vision_quality_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['demands']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['demands']['Insert']>
      }
      contracts: {
        Row: {
          id: string
          demand_id: string | null
          customer_id: string
          provider_id: string
          fund_status: string
          amount: number
          tip_amount: number
          contract_doc_markdown: string | null
          contract_doc_hash: string | null
          vision_quality_score: number | null
          is_predicted_intent: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contracts']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['contracts']['Insert']>
      }
      orders: {
        Row: {
          id: string
          protocol_id: string
          provider_id: string
          status: 'grabbed' | 'confirmed' | 'in_progress' | 'completed' | 'disputed' | 'cancelled'
          service_phase: 'NOT_ACCEPTED' | 'ACCEPTED' | 'DEPARTED' | 'ARRIVED' | 'IN_PROGRESS' | 'DONE'
          amount: number | null
          escrow_status: 'pending' | 'held' | 'released' | 'refunded' | 'disputed'
          platform_fee: number | null
          provider_income: number | null
          satisfaction_hold: number | null
          fund_status: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      provider_wallets: {
        Row: {
          id: string
          provider_id: string
          balance: number
          deposit_amount: number
          is_staked: boolean
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['provider_wallets']['Row'], 'updated_at'> & {
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['provider_wallets']['Insert']>
      }
      wallet_logs: {
        Row: {
          id: string
          provider_id: string
          amount: number
          type: 'payout' | 'platform_fee' | 'withdrawal' | 'withdrawal_freeze'
          order_id: string | null
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['wallet_logs']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['wallet_logs']['Insert']>
      }
      withdrawal_requests: {
        Row: {
          id: string
          provider_id: string
          amount: number
          channel: string
          account_info: string
          status: 'pending' | 'approved' | 'rejected' | 'instant'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['withdrawal_requests']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['withdrawal_requests']['Insert']>
      }
      milestone_schedules: {
        Row: {
          id: string
          contract_id: string
          title: string
          amount: number
          step_number: number
          status: 'PENDING' | 'HELD' | 'SETTLED' | 'DISPUTED'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['milestone_schedules']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['milestone_schedules']['Insert']>
      }
      order_disputes: {
        Row: {
          id: string
          order_id: string
          initiator_id: string
          reason: string
          evidence_urls: string[]
          status: 'pending' | 'refunded' | 'force_settled'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['order_disputes']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['order_disputes']['Insert']>
      }
      precedents: {
        Row: {
          id: string
          summary: string
          key_factors: Json
          ruling_principle: string
          embedding: number[] | null
          binding: boolean
          arbitration_case_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['precedents']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['precedents']['Insert']>
      }
      jury_votes: {
        Row: {
          id: string
          dispute_id: string
          juror_id: string
          vote: 'demander' | 'provider'
          reason: string | null
          reward_points: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['jury_votes']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['jury_votes']['Insert']>
      }
      evidence_log: {
        Row: {
          id: string
          protocol_id: string | null
          order_id: string | null
          event_type: string
          payload: Json
          payload_ref: string | null
          captured_by: string | null
          hash: string | null
          prev_hash: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['evidence_log']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['evidence_log']['Insert']>
      }
      credit_records: {
        Row: {
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
          integrity_score: number
          capability_score: number
          reliability_score: number
          communication_score: number
          safety_score: number
          contribution_score: number
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['credit_records']['Row'], 'updated_at'> & {
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['credit_records']['Insert']>
      }
      credit_events: {
        Row: {
          id: string
          user_id: string
          dimension: 'integrity' | 'capability' | 'reliability' | 'communication' | 'safety' | 'contribution' | 'category_reputation'
          category: string | null
          previous_score: number | null
          new_score: number | null
          delta: number
          reason: string
          evidence_id: string | null
          triggered_by: 'system' | 'arbitration' | 'auto_settle' | 'admin'
          protocol_id: string | null
          sentiment: string | null
          fulfillment_snapshot: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['credit_events']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['credit_events']['Insert']>
      }
      provider_qualifications: {
        Row: {
          id: string
          user_id: string
          category: string
          qualification_type: string
          qualification_ref: string | null
          verified: boolean
          expires_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['provider_qualifications']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['provider_qualifications']['Insert']>
      }
      provider_categories: {
        Row: {
          id: string
          user_id: string
          category: string
          skills: string[]
          is_online: boolean
          current_location: unknown | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['provider_categories']['Row'], 'updated_at'> & {
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['provider_categories']['Insert']>
      }
      guarantee_links: {
        Row: {
          id: string
          guarantor_id: string
          guaranteed_id: string
          guarantee_type: 'identity' | 'skill' | 'financial'
          stake_amount: number
          max_liability: number | null
          status: 'pending' | 'active' | 'triggered' | 'expired' | 'revoked'
          expires_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['guarantee_links']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['guarantee_links']['Insert']>
      }
      team_requests: {
        Row: {
          id: string
          parent_protocol_id: string
          leader_id: string
          role_desc: string
          required_skills: string[]
          reward: number
          status: 'open' | 'filled' | 'cancelled'
          member_id: string | null
          sub_task_status: string
          settled_amount: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['team_requests']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['team_requests']['Insert']>
      }
      bandit_stats: {
        Row: {
          id: string
          provider_id: string
          category: string | null
          impressions: number
          clicks: number
          conversions: number
          reward_sum: number
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bandit_stats']['Row'], 'updated_at'> & {
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['bandit_stats']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          type: 'system' | 'order' | 'finance' | 'arbitration'
          is_read: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      order_reviews: {
        Row: {
          id: string
          order_id: string
          reviewer_id: string
          reviewee_id: string
          rating: number
          comment: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['order_reviews']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['order_reviews']['Insert']>
      }
      developer_profiles: {
        Row: {
          id: string
          skills: string[]
          preference_embedding: number[] | null
          last_active_at: string
        }
        Insert: Omit<Database['public']['Tables']['developer_profiles']['Row'], 'last_active_at'> & {
          last_active_at?: string
        }
        Update: Partial<Database['public']['Tables']['developer_profiles']['Insert']>
      }
      admin_tasks: {
        Row: {
          id: string
          protocol_id: string | null
          type: string
          status: string
          payload: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['admin_tasks']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['admin_tasks']['Insert']>
      }
      insurance_pool: {
        Row: {
          id: string
          contract_id: string | null
          protocol_id: string | null
          amount: number
          type: string
          sub_type: string | null
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['insurance_pool']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['insurance_pool']['Insert']>
      }
      llm_logs: {
        Row: {
          id: string
          provider: string
          model: string
          prompt: string | null
          response: string | null
          tokens_used: number
          latency_ms: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['llm_logs']['Row'], 'created_at'> & {
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['llm_logs']['Insert']>
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
