// ============================================================
// deal-protocol 元框架 — 协议形式化定义
// 本文件定义"一个协议长什么样"，供合约引擎读取执行。
// 合约引擎不识别任何协议内容，只按照协议定义走。
// ============================================================

// ── 基础类型 ──

export type StringMap = Record<string, string>

// ── 角色 ──

export interface RoleDef {
  min: number
  max: number
  description?: string
}

export type RoleMap = Record<string, RoleDef>

// ── 资金模式 ──

/** 资金主模式 — 钱怎么进 */
export type FundingMode =
  | "full_prepay"           // 全款预付托管（家政/电商）
  | "deposit_only"          // 只付部分定金（大工程首付30%）
  | "commitment"            // 承诺押金（约会防鸽子）
  | "milestone_staged"      // 里程碑分期解锁（装修/软件外包）
  | "streaming"             // 按时/按量实时流（网约车/AWS）
  | "subscription"          // 订阅会员（固定周期付费，固定权益）
  | "subscription_pool"     // 订阅资金池（按月付→按使用分配）
  | "split_revenue"         // 动态多方分账（外卖/直播）
  | "crowdfunding"          // 众筹（目标制募资，不到目标全退）
  | "pay_later"             // 后付（信用冻结替代资金托管）
  | "hold_intent"           // 预授权预扣（租车/共享单车）
  | "yield_escrow"          // 衍生收益托管——资金托管期间产生利息/收益，归属可配置
  | "vesting_cliff"         // 锁定释放/含悬崖期——一笔打入，悬崖期后分期释放
  | "factoring_advance"     // 应收账款保理/垫资——基于应收承诺的平台垫付
  | "collateral_loan"       // 质押借贷——质押资产贷出资金完成交易
  | "revolving_credit"      // 循环信用池——预放资金池，每完成一笔扣一笔
  | "money_pool"            // 凑钱/共享池——多人资金汇集到共用池
  | "reimbursement"         // 先付后报销——用户垫付，审核后报销
  | "none"                  // 无资金往来（免费活动/纯约）

/** 资金托管方式 */
export type HoldType =
  | "platform_escrow"       // 平台托管
  | "no_hold"               // 不托管
  | "credit_freeze"         // 信用冻结（不扣钱，锁额度）
  | "pre_auth"              // 预授权（卡/钱包锁额度）

/** 释放触发方式 */
export type ReleaseTrigger =
  | "on_confirm"                  // 买家确认释放
  | "auto_timeout"                // 超时自动释放
  | "milestone_by_milestone"      // 按里程碑逐个释放
  | "continuous_stream"           // 连续流释放（按时间/用量）
  | "pool_distribution"           // 资金池按比例分配
  | "dispute_resolved"            // 争议解决后释放

/** 资金修饰器 — 在不改主模式的前提下叠加 */
export interface FundingModifiers {
  // 双向押金：不仅买家押，卖家也要押
  dualDeposit?: {
    providerRatio: number         // 卖家押金占交易额比例 0-1
    customerRatio: number         // 买家押金占交易额比例 0-1
  }
  // 质保金/追索权：释放后冻结一段时间
  clawbackInsurance?: {
    ratio: number                 // 冻结比例 0-1
    durationDays: number          // 观察期天数
  }
  // 分期：总价不变，按时间表分批付
  installment?: {
    installments: number          // 分几期
    intervalDays: number          // 每期间隔
  }
  // 退款保证：承诺期限内可无条件退款
  refundGuarantee?: {
    windowDays: number             // 退款窗口期
    source: "platform_hold" | "seller_deduct"
  }
  // 阶梯奖惩对赌：超额完成→奖金，不达标→罚金
  performanceBonusPenalty?: {
    kpis: Array<{
      metric: string              // KPI 名称
      baseline: number            // 基准值
      bonusPercent?: number       // 超额每单位奖金比例
      penaltyPercent?: number     // 不达标每单位罚金比例
    }>
  }
  // 预言机/第三方仲裁：不由任何一方决定释放
  oracleArbitration?: {
    provider: string              // 第三方裁决方标识
    type: "human_jury" | "api_oracle" | "voting"
    timeoutDays: number
  }
  // 动态定价：价格根据环境变量浮动
  dynamicPricing?: {
    range: { min: number; max: number }
    factors: Array<{
      source: "weather" | "supply_demand" | "time_urgency" | "custom"
      weight: number
    }>
  }
  // 熔断/紧急撤资：触发条件时单方锁定剩余资金
  circuitBreaker?: {
    triggers: string[]             // 触发条件列表
    refundMode: "full" | "proportional"
  }
}

/** 里程碑定义（用于 milestone_staged 模式） */
export interface MilestoneDef {
  name: string
  ratio: number                   // 该里程碑占总额比例 0-1
  requiredEvidence: string[]      // 证据类型
  autoApproveDays?: number        // 超时自动通过
}

/** 流计费定义（用于 streaming 模式） */
export interface StreamDef {
  unit: "per_second" | "per_minute" | "per_hour" | "per_kb" | "per_km"
  rate: number                    // 单价（元/单位）
  maxCap?: number                 // 每次交易封顶
  minCharge?: number              // 起步价（如网约车¥15）
}

/** 多方分账规则（用于 split_revenue 模式） */
export interface SplitRule {
  role: string                    // 接收方角色名
  ratio: number                   // 分成比例 0-1
}

/** 资金池规则（用于 subscription_pool 模式） */
export interface SubscriptionPoolDef {
  period: "monthly" | "yearly"
  price: number
  distribution: "equal" | "usage_based" | "weighted"
  // usage_based: 按使用量分配
  // weighted: 按权重（如评分×时长）分配
}

export interface FundingDef {
  mode: FundingMode
  hold: HoldType
  release: ReleaseTrigger[]
  modifiers?: FundingModifiers

  // 费用
  fees: {
    platform_commission: number   // 平台佣金比例 0-1
    satisfaction_hold: number     // 满意度暂存款比例 0-1
  }

  // 释放超时设置（秒）
  autoReleaseTimeout?: number

  // 协议特定配置（按模式选填）
  milestones?: MilestoneDef[]     // milestone_staged
  stream?: StreamDef              // streaming
  splitRules?: SplitRule[]        // split_revenue
  subscriptionPool?: SubscriptionPoolDef  // subscription_pool
  // 订阅模式
  subscription?: {
    period: "monthly" | "yearly"
    price: number
    autoRenew: boolean
    trialDays?: number
  }
  // 众筹模式
  crowdfunding?: {
    target: number
    deadline: Date
    minPerBacker?: number
    maxPerBacker?: number
  }
  // 衍生收益托管
  yieldEscrow?: {
    yieldSource: "treasury" | "defi_pool" | "money_market"
    yieldBeneficiary: "customer" | "provider" | "platform" | "split"
    yieldSplit?: { customer: number; provider: number; platform: number }
  }
  // 锁定释放
  vestingCliff?: {
    cliffDays: number              // 悬崖期（天）
    releaseInterval: "monthly" | "quarterly"
    releasePerInterval: number     // 每期释放比例 0-1
  }
  // 保理垫资
  factoringAdvance?: {
    advanceRatio: number           // 垫资比例 0-1
    funder: "platform" | "third_party"
    interestRate?: number          // 利率
  }
  // 质押借贷
  collateralLoan?: {
    acceptedAssets: string[]       // 接受质押资产类型
    loanToValueRatio: number       // 质押率 0-1
    liquidationThreshold?: number  // 清算阈值
  }
  // 循环信用池
  revolvingCredit?: {
    poolSize: number               // 信用池总额
    minBalance: number             // 最低安全水位线
    topUpTrigger: "auto" | "manual"
  }
  // 凑钱/共享池
  moneyPool?: {
    minContribution: number
    maxContribution?: number
    goal?: number                  // 目标金额（可选）
    refundOnFail: boolean          // 达不到目标是否退
  }
  // 先付后报销
  reimbursement?: {
    maxAmount: number
    requiredEvidence: string[]      // 报销需要的证据
    reviewMode: "auto" | "manual" | "hybrid"
    payoutDays: number
  }
}

// ── 状态机 ──

export interface StateDef {
  name: string
  description?: string
  terminal?: boolean                // 终态
  onEnter?: string[]                // 进入时触发的动作
}

/** guard 返回值: null=通过, string=拒绝原因 */
export type GuardFn = (ctx: TransitionCtx) => string | null

export interface TransitionDef {
  action: string
  from: string
  to: string
  allowedRoles: string[]
  description?: string
  guard?: GuardFn
  // 服务阶段变化（仅服务流程类协议需要）
  serviceStage?: {
    from?: number      // 当前服务阶段（留空表示任意）
    to?: number        // 下一服务阶段（留空表示不变）
  }
}

export interface TransitionCtx {
  contract: {
    id: string
    fundStatus: string
    disputeStatus: string | null
    serviceStage: number
    providerId: string
    customerId: string
    amount: number
    completedAt: Date | null
    autoCompleteAt: Date | null
  }
  actor: {
    id: string
    role: string
  }
  payload?: Record<string, unknown>
}

// ── 完成 / 违约 ──

export interface CompletionDef {
  trigger: "on_confirm" | "mutual_confirm" | "auto_timeout" | "llm_judgment"
  requiredEvidence: string[]        // 完成时必须提交的证据类型
  autoTimeoutSeconds?: number       // 超时自动完成
}

export interface DefaultDef {
  types: string[]                    // 违约类型列表
  requiredEvidence: string[]         // 违约认定需要的证据类型
}

// ── 评价维度 ──

export interface ReviewDimension {
  name: string
  label: string                      // 对外显示的短名
  weight: number                     // 权重 0-1
  type: "yesno" | "1to5" | "free_text"
}

export interface ReviewDef {
  type: "objective" | "subjective"
  dimensions: ReviewDimension[]
  labelExtraction: boolean            // 是否用LLM提取标签
}

// ── 证据类型 ──

export interface EvidenceDef {
  type: string
  label: string
  required: boolean
  maxCount?: number                  // 最多上传几张
  description?: string
}

// ── 争议 ──

export interface DisputeDef {
  channels: {
    green: { maxAmount: number; llmHours: number; resolveHours: number }
    yellow: { minAmount: number; maxAmount: number; llmHours: number; resolveHours: number }
    red: { minAmount: number; llmHours: number; resolveHours: number }
  }
  autoTimeoutDays?: number           // 争议超时N天自动裁决
}

// ── 条件事件（引擎自动任务） ──

export interface ConditionEvent {
  trigger: string                    // 触发条件描述
  action: string                     // 执行动作描述
  guard?: GuardFn
}

// ── 完整协议定义 ──

export interface ProtocolDef {
  // 基本信息
  id: string                         // protocol_xxx
  name: string
  description: string
  category: string
  version: string
  /** 继承的基准协议 ID。继承后：states / transitions 子完全覆盖，其余字段级合并 */
  extends?: string
  /** LLM 分类结果 → 此协议的映射关键词 */
  classificationKeywords?: string[]

  // 核心配置
  roles: RoleMap
  funding: FundingDef
  states: StateDef[]
  transitions: TransitionDef[]
  completion: CompletionDef
  default: DefaultDef

  // 服务阶段（仅服务流程类协议需要）
  // 如: ["NOT_ACCEPTED", "ACCEPTED", "DEPARTED", "ARRIVED", "IN_PROGRESS", "DONE"]
  serviceStages?: string[]

  // 退款规则（按服务阶段分段）
  refundRules?: Array<{
    stage: number                     // 服务阶段
    providerMax?: number              // 师傅最多拿多少（如上门费上限¥30）
    providerRatio?: number            // 或按比例（如服务中五五分）
    customerGets: "rest" | "all"     // 剩余给客户 / 全退
  }>

  // 评价 / 证据 / 争议
  review: ReviewDef
  evidence: EvidenceDef[]
  dispute: DisputeDef

  // 引擎自动任务
  conditions?: ConditionEvent[]
}

// ── 协议注册表条目 ──

export interface ProtocolEntry {
  def: ProtocolDef
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
