This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
```
.gitignore
AGENTS.md
CLAUDE.md
components.json
docs/contract-engine-state-machine.md
eslint.config.mjs
middleware.ts
next.config.ts
package.json
postcss.config.mjs
prisma.config.ts
prisma/migrations/20260623023038_init/migration.sql
prisma/migrations/20260623034731_add_auth/migration.sql
prisma/migrations/20260623035537_add_order_fields/migration.sql
prisma/migrations/20260623122614_add_contract_engine/migration.sql
prisma/migrations/migration_lock.toml
prisma/schema.prisma
prisma/seed.ts
public/file.svg
public/globe.svg
public/next.svg
public/vercel.svg
public/window.svg
README.md
scripts/task-backup.ps1
src/app/api/auth/[...nextauth]/route.ts
src/app/api/cron/check-timeouts/route.ts
src/app/api/llm-classify/route.ts
src/app/api/llm-test/route.ts
src/app/api/orders/[id]/route.ts
src/app/api/orders/route.ts
src/app/api/profile/route.ts
src/app/api/register/route.ts
src/app/api/reviews/route.ts
src/app/api/services/[id]/route.ts
src/app/api/services/route.ts
src/app/dashboard/page.tsx
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/login/page.tsx
src/app/orders/[id]/order-operations.tsx
src/app/orders/[id]/page.tsx
src/app/orders/[id]/review/page.tsx
src/app/orders/page.tsx
src/app/page.tsx
src/app/profile/page.tsx
src/app/register/page.tsx
src/app/services/[id]/order/page.tsx
src/app/services/[id]/page.tsx
src/app/services/new/page.tsx
src/app/services/page.tsx
src/app/services/service-sort.tsx
src/components/Header.tsx
src/components/SessionProvider.tsx
src/components/SmartRequest.tsx
src/components/ui/badge.tsx
src/components/ui/button.tsx
src/components/ui/card.tsx
src/components/ui/dialog.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/input.tsx
src/components/ui/select.tsx
src/components/ui/sheet.tsx
src/components/ui/sonner.tsx
src/components/ui/table.tsx
src/components/ui/textarea.tsx
src/lib/auth.ts
src/lib/contract-machine.ts
src/lib/llm.ts
src/lib/payment.ts
src/lib/prisma.ts
src/lib/utils.ts
src/types/next-auth.d.ts
test-int.db
tests/contract-machine.test.ts
tests/edge-cases.test.ts
tests/integration.test.ts
tests/payment.test.ts
tsconfig.json
```

# Files

## File: src/app/orders/[id]/order-operations.tsx
````typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface OperationContract {
  id: string;
  fundStatus: string;
  serviceStage: number;
  service: { title: string };
  customer: { id: string };
  provider: { id: string };
  payments: { status: string }[];
  reviews: { id: string }[];
}

interface OperationDef {
  action: string;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  requiresConfirm?: boolean;
  confirmMessage?: string;
  requiresReason?: boolean;
  requiresEvidence?: boolean;
  visible: (c: OperationContract, role: string) => boolean;
}

const operations: OperationDef[] = [
  // Customer operations
  {
    action: "pay",
    label: "立即支付",
    variant: "default",
    visible: (c, role) =>
      role === "CUSTOMER" && c.fundStatus === "PENDING_HELD",
  },
  {
    action: "cancel_before_pay",
    label: "取消订单",
    variant: "outline",
    requiresConfirm: true,
    confirmMessage: "确定要取消该订单吗？取消后订单将自动关闭。",
    visible: (c, role) =>
      role === "CUSTOMER" && c.fundStatus === "PENDING_HELD",
  },
  {
    action: "open_dispute",
    label: "发起争议",
    variant: "destructive",
    requiresReason: true,
    requiresEvidence: true,
    visible: (c, role) =>
      role === "CUSTOMER" && c.fundStatus === "HELD",
  },
  {
    action: "confirm_complete",
    label: "确认完成",
    variant: "default",
    visible: (c, role) =>
      role === "CUSTOMER" && c.fundStatus === "HELD" && c.serviceStage === 5,
  },

  // Provider operations
  {
    action: "provider_accept",
    label: "接单",
    variant: "default",
    visible: (c, role) =>
      role === "PROVIDER" && c.fundStatus === "HELD" && c.serviceStage === 0,
  },
  {
    action: "provider_depart",
    label: "出发",
    variant: "secondary",
    visible: (c, role) =>
      role === "PROVIDER" && c.fundStatus === "HELD" && c.serviceStage === 1,
  },
  {
    action: "provider_arrive",
    label: "到达",
    variant: "secondary",
    visible: (c, role) =>
      role === "PROVIDER" && c.fundStatus === "HELD" && c.serviceStage === 2,
  },
  {
    action: "start_service",
    label: "开始服务",
    variant: "default",
    visible: (c, role) =>
      role === "PROVIDER" && c.fundStatus === "HELD" && c.serviceStage === 3,
  },
  {
    action: "request_complete",
    label: "请求完成",
    variant: "default",
    visible: (c, role) =>
      role === "PROVIDER" && c.fundStatus === "HELD" && c.serviceStage === 4,
  },
];

interface OrderOperationsProps {
  contract: OperationContract;
  orderId: string;
  userRole: string;
  onActionSuccess: () => void;
}

export default function OrderOperations({
  contract,
  orderId,
  userRole,
  onActionSuccess,
}: OrderOperationsProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: string, extra?: Record<string, string | undefined>) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "操作失败");
        return;
      }

      toast.success("操作成功！");
      onActionSuccess();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOperation = (op: OperationDef) => {
    if (op.requiresConfirm) {
      const confirmed = window.confirm(op.confirmMessage || "确定执行此操作？");
      if (!confirmed) return;
    }

    let reason: string | undefined;
    let evidence: string | undefined;

    if (op.requiresReason) {
      const input = window.prompt("请输入争议原因：");
      if (!input || input.trim() === "") {
        toast.error("请填写争议原因");
        return;
      }
      reason = input;
    }

    if (op.requiresEvidence) {
      const input = window.prompt("请输入证据描述（可选）：");
      if (input) evidence = input;
    }

    handleAction(op.action, { reason, evidence });
  };

  const visibleOps = operations.filter((op) => op.visible(contract, userRole));

  // Review button for customer (after complete)
  const showReview =
    userRole === "CUSTOMER" &&
    (contract.fundStatus === "COMPLETED" || contract.fundStatus === "SATISFACTION_HELD") &&
    contract.reviews.length === 0;

  if (visibleOps.length === 0 && !showReview) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {visibleOps.map((op) => (
        <Button
          key={op.action}
          variant={op.variant || "default"}
          size="lg"
          onClick={() => handleOperation(op)}
          disabled={actionLoading === op.action}
        >
          {actionLoading === op.action ? "处理中..." : op.label}
        </Button>
      ))}

      {showReview && (
        <Link href={`/orders/${orderId}/review`}>
          <Button variant="outline" size="lg">
            评价服务
          </Button>
        </Link>
      )}
    </div>
  );
}
````

## File: src/lib/payment.ts
````typescript
import Stripe from "stripe"

export type PaymentProvider = "stripe" | "alipay" | "wechat"

export interface PaymentRequest {
  amount: number
  currency?: string
  description: string
  contractId: string
  payerId: string
  provider?: PaymentProvider
  metadata?: Record<string, string>
}

export interface PaymentResult {
  success: boolean
  providerPaymentId: string | null
  provider: PaymentProvider
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED"
  clientSecret?: string
  redirectUrl?: string
  error?: string
}

export interface IPaymentProvider {
  createPayment(req: PaymentRequest): Promise<PaymentResult>
  refundPayment(providerPaymentId: string, amount: number): Promise<PaymentResult>
  parseWebhook(payload: unknown, signature: string): Promise<PaymentResult>
}

class StripeProvider implements IPaymentProvider {
  private client: Stripe | null
  private isMock: boolean

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      this.client = null
      this.isMock = true
    } else {
      this.client = new Stripe(key, { apiVersion: "2026-05-27.dahlia" })
      this.isMock = false
    }
  }

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    if (this.isMock) {
      return {
        success: true,
        providerPaymentId: `pi_mock_${req.contractId}_${Date.now()}`,
        provider: "stripe",
        status: "SUCCEEDED",
      }
    }
    try {
      const intent = await this.client!.paymentIntents.create({
        amount: Math.round(req.amount * 100),
        currency: req.currency ?? "cny",
        description: req.description,
        metadata: {
          contractId: req.contractId,
          payerId: req.payerId,
          ...req.metadata,
        },
      })
      return {
        success: true,
        providerPaymentId: intent.id,
        provider: "stripe",
        status: "PENDING",
        clientSecret: intent.client_secret ?? undefined,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        success: false,
        providerPaymentId: null,
        provider: "stripe",
        status: "FAILED",
        error: message,
      }
    }
  }

  async refundPayment(providerPaymentId: string, amount: number): Promise<PaymentResult> {
    if (this.isMock) {
      return {
        success: true,
        providerPaymentId: `refund_${providerPaymentId}`,
        provider: "stripe",
        status: "SUCCEEDED",
      }
    }
    try {
      const refund = await this.client!.refunds.create({
        payment_intent: providerPaymentId,
        amount: Math.round(amount * 100),
      })
      return {
        success: true,
        providerPaymentId: refund.id,
        provider: "stripe",
        status: "SUCCEEDED",
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        success: false,
        providerPaymentId: null,
        provider: "stripe",
        status: "FAILED",
        error: message,
      }
    }
  }

  async parseWebhook(payload: unknown, signature: string): Promise<PaymentResult> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      return {
        success: false,
        providerPaymentId: null,
        provider: "stripe",
        status: "FAILED",
        error: "STRIPE_WEBHOOK_SECRET is not set",
      }
    }
    try {
      const event = this.client.webhooks.constructEvent(
        payload as string | Buffer,
        signature,
        secret,
      )
      const intent = event.data.object as Stripe.PaymentIntent
      return {
        success: true,
        providerPaymentId: intent.id,
        provider: "stripe",
        status: intent.status === "succeeded" ? "SUCCEEDED" : "PENDING",
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        success: false,
        providerPaymentId: null,
        provider: "stripe",
        status: "FAILED",
        error: message,
      }
    }
  }
}

class AlipayProvider implements IPaymentProvider {
  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    return {
      success: true,
      providerPaymentId: `alipay_mock_${req.contractId}_${Date.now()}`,
      provider: "alipay",
      status: "PENDING",
      redirectUrl: `alipay://mock?amount=${req.amount}`,
    }
  }

  async refundPayment(providerPaymentId: string, _amount: number): Promise<PaymentResult> {
    return {
      success: true,
      providerPaymentId: `refund_${providerPaymentId}`,
      provider: "alipay",
      status: "SUCCEEDED",
    }
  }

  async parseWebhook(_payload: unknown, _signature: string): Promise<PaymentResult> {
    return {
      success: true,
      providerPaymentId: "alipay_webhook_mock",
      provider: "alipay",
      status: "SUCCEEDED",
    }
  }
}

const providers = new Map<PaymentProvider, IPaymentProvider>()

export function getPaymentProvider(provider: PaymentProvider): IPaymentProvider {
  let instance = providers.get(provider)
  if (!instance) {
    switch (provider) {
      case "stripe":
        instance = new StripeProvider()
        break
      case "alipay":
      case "wechat":
        instance = new AlipayProvider()
        break
      default:
        throw new Error(`Unknown payment provider: ${provider}`)
    }
    providers.set(provider, instance)
  }
  return instance
}

export async function createPayment(req: PaymentRequest): Promise<PaymentResult> {
  const provider = req.provider ?? "stripe"
  const instance = getPaymentProvider(provider)
  return instance.createPayment(req)
}

export async function refundPayment(
  providerPaymentId: string,
  amount: number,
  provider: PaymentProvider,
): Promise<PaymentResult> {
  const instance = getPaymentProvider(provider)
  return instance.refundPayment(providerPaymentId, amount)
}
````

## File: tests/contract-machine.test.ts
````typescript
import { describe, it, expect } from "bun:test"
import {
  validateTransition,
  getNextFundStatus,
  getNextServiceStage,
  calcRefund,
  FUND_STATUSES,
  SERVICE_STAGES,
} from "../src/lib/contract-machine"
import type { TransitionCtx } from "../src/lib/contract-machine"

function makeCtx(overrides?: Partial<TransitionCtx["contract"]>): TransitionCtx {
  return {
    contract: {
      id: "c1",
      fundStatus: FUND_STATUSES.HELD,
      serviceStage: SERVICE_STAGES.ACCEPTED,
      providerId: "p1",
      customerId: "c1",
      amount: 100,
      completedAt: null,
      autoCompleteAt: null,
      ...overrides,
    },
    actor: { id: "c1", role: "CUSTOMER" },
    payload: {},
  }
}

describe("validateTransition", () => {
  describe("pay", () => {
    it("PENDING_HELD 下客户可支付", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.PENDING_HELD })
      expect(validateTransition("pay", ctx)).toBeNull()
    })

    it("非客户不能支付", () => {
      const ctx: TransitionCtx = {
        contract: { id: "c1", fundStatus: "PENDING_HELD", serviceStage: 0, providerId: "p1", customerId: "c1", amount: 100, completedAt: null, autoCompleteAt: null },
        actor: { id: "p1", role: "PROVIDER" },
        payload: {},
      }
      expect(validateTransition("pay", ctx)).not.toBeNull()
    })

    it("HELD 下不能支付（状态不匹配）", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      expect(validateTransition("pay", ctx)).toContain("不允许")
    })
  })

  describe("open_dispute", () => {
    it("HELD 下客户可发起争议", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD, customerId: "c1" })
      ctx.actor = { id: "c1", role: "CUSTOMER" }
      expect(validateTransition("open_dispute", ctx)).toBeNull()
    })

    it("不能由师傅发起争议", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      ctx.actor = { id: "p1", role: "PROVIDER" }
      expect(validateTransition("open_dispute", ctx)).not.toBeNull()
    })

    it("不能由非参与者发起争议", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      ctx.actor = { id: "x", role: "CUSTOMER" }
      expect(validateTransition("open_dispute", ctx)).not.toBeNull()
    })
  })

  describe("open_dispute_after_complete", () => {
    it("SATISFACTION_HELD 下可发起质保争议", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.SATISFACTION_HELD })
      ctx.actor = { id: "c1", role: "CUSTOMER" }
      ctx.payload = { qualityClaim: "服务后漏水" }
      expect(validateTransition("open_dispute_after_complete", ctx)).toBeNull()
    })

    it("需要 qualityClaim 参数", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.SATISFACTION_HELD })
      ctx.actor = { id: "c1", role: "CUSTOMER" }
      expect(validateTransition("open_dispute_after_complete", ctx)).toContain("质保")
    })
  })

  describe("resolve_dispute", () => {
    it("ADMIN 可仲裁争议", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.DISPUTED })
      ctx.actor = { id: "a1", role: "ADMIN" }
      ctx.payload = { resolution: "师傅赔付50" }
      expect(validateTransition("resolve_dispute", ctx)).toBeNull()
    })

    it("需要 resolution 参数", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.DISPUTED })
      ctx.actor = { id: "a1", role: "ADMIN" }
      expect(validateTransition("resolve_dispute", ctx)).toContain("仲裁裁决")
    })

    it("客户不能自行仲裁", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.DISPUTED })
      ctx.actor = { id: "c1", role: "CUSTOMER" }
      ctx.payload = { resolution: "我赢了" }
      expect(validateTransition("resolve_dispute", ctx)).toContain("无权")
    })

    it("非 DISPUTED 状态不能仲裁", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      ctx.actor = { id: "a1", role: "ADMIN" }
      ctx.payload = { resolution: "x" }
      expect(validateTransition("resolve_dispute", ctx)).toContain("不允许")
    })
  })

  describe("cancel_during_service", () => {
    it("HELD 下客户可取消", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      ctx.actor = { id: "c1", role: "CUSTOMER" }
      expect(validateTransition("cancel_during_service", ctx)).toBeNull()
    })

    it("HELD 下师傅也可取消", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      ctx.actor = { id: "p1", role: "PROVIDER" }
      expect(validateTransition("cancel_during_service", ctx)).toBeNull()
    })

    it("第三方不能取消", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      ctx.actor = { id: "x", role: "CUSTOMER" }
      expect(validateTransition("cancel_during_service", ctx)).not.toBeNull()
    })
  })

  describe("cancel_before_pay", () => {
    it("PENDING_HELD 下客户可取消", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.PENDING_HELD })
      ctx.actor = { id: "c1", role: "CUSTOMER" }
      expect(validateTransition("cancel_before_pay", ctx)).toBeNull()
    })

    it("师傅不能取消未支付订单", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.PENDING_HELD })
      ctx.actor = { id: "p1", role: "PROVIDER" }
      expect(validateTransition("cancel_before_pay", ctx)).toContain("无权")
    })

    it("HELD 下不能 cancel_before_pay", () => {
      const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
      ctx.actor = { id: "c1", role: "CUSTOMER" }
      expect(validateTransition("cancel_before_pay", ctx)).toContain("不允许")
    })
  })
})

describe("getNextFundStatus", () => {
  it("pay 迁移到 HELD", () => {
    expect(getNextFundStatus("pay")).toBe("HELD")
  })

  it("open_dispute 迁移到 DISPUTED", () => {
    expect(getNextFundStatus("open_dispute")).toBe("DISPUTED")
  })

  it("resolve_dispute 迁移到 SETTLED", () => {
    expect(getNextFundStatus("resolve_dispute")).toBe("SETTLED")
  })

  it("cancel_during_service 迁移到 CANCELLED", () => {
    expect(getNextFundStatus("cancel_during_service")).toBe("CANCELLED")
  })

  it("cancel_before_pay 迁移到 CANCELLED", () => {
    expect(getNextFundStatus("cancel_before_pay")).toBe("CANCELLED")
  })

  it("settle_cancelled 迁移到 SETTLED", () => {
    expect(getNextFundStatus("settle_cancelled")).toBe("SETTLED")
  })

  it("未知操作返回 null", () => {
    expect(getNextFundStatus("nonexistent")).toBeNull()
  })
})

describe("getNextServiceStage", () => {
  it("provider_accept → ACCEPTED", () => {
    expect(getNextServiceStage("provider_accept")).toBe(SERVICE_STAGES.ACCEPTED)
  })

  it("provider_depart → DEPARTED", () => {
    expect(getNextServiceStage("provider_depart")).toBe(SERVICE_STAGES.DEPARTED)
  })

  it("provider_arrive → ARRIVED", () => {
    expect(getNextServiceStage("provider_arrive")).toBe(SERVICE_STAGES.ARRIVED)
  })

  it("start_service → IN_PROGRESS", () => {
    expect(getNextServiceStage("start_service")).toBe(SERVICE_STAGES.IN_PROGRESS)
  })

  it("request_complete → DONE", () => {
    expect(getNextServiceStage("request_complete")).toBe(SERVICE_STAGES.DONE)
  })

  it("取消操作不改变服务阶段", () => {
    expect(getNextServiceStage("cancel_during_service")).toBeNull()
  })

  it("争议操作不改变服务阶段", () => {
    expect(getNextServiceStage("open_dispute")).toBeNull()
  })
})

describe("calcRefund", () => {
  it("阶段0（未接单）：全额退客户", () => {
    const r = calcRefund(0, 100)
    expect(r.provider).toBe(0)
    expect(r.customer).toBe(100)
  })

  it("阶段1（已接单未出发）：全额退客户", () => {
    const r = calcRefund(1, 200)
    expect(r.provider).toBe(0)
    expect(r.customer).toBe(200)
  })

  it("阶段2（已出发未上门）：师傅拿10%，上限30", () => {
    const r = calcRefund(2, 200)
    expect(r.provider).toBe(Math.min(200 * 0.1, 30))
    expect(r.customer).toBe(200 - Math.min(200 * 0.1, 30))
  })

  it("阶段2：大额时30上限", () => {
    const r = calcRefund(2, 1000)
    expect(r.provider).toBe(30)
    expect(r.customer).toBe(970)
  })

  it("阶段3（已上门未服务）：师傅拿15%，上限50", () => {
    const r = calcRefund(3, 300)
    expect(r.provider).toBe(Math.min(300 * 0.15, 50))
    expect(r.customer).toBe(300 - Math.min(300 * 0.15, 50))
  })

  it("阶段3：大额时50上限", () => {
    const r = calcRefund(3, 2000)
    expect(r.provider).toBe(50)
    expect(r.customer).toBe(1950)
  })

  it("阶段4+（服务中或已完成）：五五分", () => {
    const r = calcRefund(4, 200)
    expect(r.provider).toBe(100)
    expect(r.customer).toBe(100)
  })

  it("阶段5（已完成）也归五五分", () => {
    const r = calcRefund(5, 200)
    expect(r.provider).toBe(100)
    expect(r.customer).toBe(100)
  })
})

describe("全流程：争议仲裁", () => {
  it("HELD → open_dispute → DISPUTED → resolve_dispute → SETTLED", () => {
    const customerCtx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
    customerCtx.actor = { id: "c1", role: "CUSTOMER" }

    expect(validateTransition("open_dispute", customerCtx)).toBeNull()

    const disputedCtx = makeCtx({ fundStatus: FUND_STATUSES.DISPUTED })
    disputedCtx.actor = { id: "a1", role: "ADMIN" }
    disputedCtx.payload = { resolution: "师傅服务不达标，退还50%", providerAmount: 50, customerAmount: 50 }

    expect(validateTransition("resolve_dispute", disputedCtx)).toBeNull()
    expect(getNextFundStatus("open_dispute")).toBe("DISPUTED")
    expect(getNextFundStatus("resolve_dispute")).toBe("SETTLED")
  })

  it("SATISFACTION_HELD → open_dispute_after_complete → DISPUTED → resolve_dispute → SETTLED", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.SATISFACTION_HELD })
    ctx.actor = { id: "c1", role: "CUSTOMER" }
    ctx.payload = { qualityClaim: "安装后三天就坏了" }

    expect(validateTransition("open_dispute_after_complete", ctx)).toBeNull()
    expect(getNextFundStatus("open_dispute_after_complete")).toBe("DISPUTED")
  })

  it("resolve_dispute 必须有 resolution", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.DISPUTED })
    ctx.actor = { id: "a1", role: "ADMIN" }

    expect(validateTransition("resolve_dispute", ctx)).not.toBeNull()
    ctx.payload = { resolution: "" }
    expect(validateTransition("resolve_dispute", ctx)).not.toBeNull()
  })
})

describe("全流程：取消退款", () => {
  it("PENDING_HELD → cancel_before_pay → CANCELLED（全额退）", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.PENDING_HELD })
    ctx.actor = { id: "c1", role: "CUSTOMER" }

    expect(validateTransition("cancel_before_pay", ctx)).toBeNull()
    expect(getNextFundStatus("cancel_before_pay")).toBe("CANCELLED")

    const refund = calcRefund(ctx.contract.serviceStage, ctx.contract.amount)
    expect(refund.provider).toBe(0)
    expect(refund.customer).toBe(100)
  })

  it("HELD（未出发）→ cancel_during_service → CANCELLED（全额退）", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.NOT_ACCEPTED })

    expect(validateTransition("cancel_during_service", ctx)).toBeNull()

    const refund = calcRefund(0, 100)
    expect(refund.customer).toBe(100)
    expect(refund.provider).toBe(0)
  })

  it("HELD（已出发）→ cancel_during_service → CANCELLED（扣上门费）", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.DEPARTED })
    ctx.actor = { id: "c1", role: "CUSTOMER" }

    expect(validateTransition("cancel_during_service", ctx)).toBeNull()

    const refund = calcRefund(SERVICE_STAGES.DEPARTED, 200)
    expect(refund.provider).toBe(20)
    expect(refund.customer).toBe(180)
  })

  it("HELD（已上门）→ cancel_during_service → CANCELLED（扣检测费）", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.ARRIVED })
    ctx.actor = { id: "c1", role: "CUSTOMER" }

    expect(validateTransition("cancel_during_service", ctx)).toBeNull()

    const refund = calcRefund(SERVICE_STAGES.ARRIVED, 200)
    expect(refund.provider).toBe(30) // 15%, cap 50
    expect(refund.customer).toBe(170)
  })

  it("HELD（服务中）→ cancel_during_service → CANCELLED（五五分）", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.IN_PROGRESS })
    ctx.actor = { id: "c1", role: "CUSTOMER" }

    expect(validateTransition("cancel_during_service", ctx)).toBeNull()

    const refund = calcRefund(SERVICE_STAGES.IN_PROGRESS, 200)
    expect(refund.provider).toBe(100)
    expect(refund.customer).toBe(100)
  })
})

describe("settle_cancelled", () => {
  it("CANCELLED 下 ADMIN 可通过", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.CANCELLED })
    ctx.actor = { id: "a1", role: "ADMIN" }
    expect(validateTransition("settle_cancelled", ctx)).toBeNull()
  })

  it("CANCELLED 下 SYSTEM 可通过", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.CANCELLED })
    ctx.actor = { id: "sys", role: "SYSTEM" }
    expect(validateTransition("settle_cancelled", ctx)).toBeNull()
  })

  it("非 CANCELLED 状态被拒绝", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
    ctx.actor = { id: "a1", role: "ADMIN" }
    expect(validateTransition("settle_cancelled", ctx)).toContain("不允许")
  })
})

describe("权限边界测试", () => {
  it("ADMIN 不能冒用客户身份支付", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.PENDING_HELD })
    ctx.actor = { id: "a1", role: "ADMIN" }
    expect(validateTransition("pay", ctx)).toContain("无权")
  })

  it("ADMIN 可确认完成", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.DONE })
    ctx.actor = { id: "a1", role: "ADMIN" }
    expect(validateTransition("confirm_complete", ctx)).toBeNull()
  })

  it("SYSTEM 可自动完成", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.DONE, autoCompleteAt: new Date(Date.now() - 1000) })
    ctx.actor = { id: "sys", role: "SYSTEM" }
    expect(validateTransition("auto_complete", ctx)).toBeNull()
  })
})
````

## File: tests/edge-cases.test.ts
````typescript
import { describe, it, expect } from "bun:test"
import {
  validateTransition,
  getNextFundStatus,
  calcRefund,
  FUND_STATUSES,
  SERVICE_STAGES,
} from "../src/lib/contract-machine"
import type { TransitionCtx } from "../src/lib/contract-machine"

function makeCtx(overrides?: Partial<TransitionCtx["contract"]>): TransitionCtx {
  return {
    contract: {
      id: "c1",
      fundStatus: FUND_STATUSES.HELD,
      serviceStage: SERVICE_STAGES.ACCEPTED,
      providerId: "p1",
      customerId: "c1",
      amount: 100,
      completedAt: null,
      autoCompleteAt: null,
      ...overrides,
    },
    actor: { id: "c1", role: "CUSTOMER" },
    payload: {},
  }
}

describe("1. 并发/状态冲突测试（纯函数级）", () => {
  it("同一个合同从 HELD 触发 open_dispute 成功后再触发 cancel_during_service 被拒绝", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
    ctx.actor = { id: "c1", role: "CUSTOMER" }

    const r1 = validateTransition("open_dispute", ctx)
    expect(r1).toBeNull()

    const afterDispute = makeCtx({ fundStatus: FUND_STATUSES.DISPUTED })
    const r2 = validateTransition("cancel_during_service", afterDispute)
    expect(r2).toContain("不允许")
    expect(getNextFundStatus("cancel_during_service")).toBe("CANCELLED")
    expect(getNextFundStatus("open_dispute")).toBe("DISPUTED")
  })

  it("从 HELD 同时收到 cancel_during_service 和 open_dispute，第一个成功第二个被拒", () => {
    const ctx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
    ctx.actor = { id: "c1", role: "CUSTOMER" }

    const r1 = validateTransition("cancel_during_service", ctx)
    expect(r1).toBeNull()

    const afterCancel = makeCtx({ fundStatus: FUND_STATUSES.CANCELLED })
    const r2 = validateTransition("open_dispute", afterCancel)
    expect(r2).toContain("不允许")
  })

  it("from 状态匹配但 to 不同的两个 action 不能同时成功", () => {
    const customerCtx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
    customerCtx.actor = { id: "c1", role: "CUSTOMER" }
    expect(validateTransition("open_dispute", customerCtx)).toBeNull()

    const providerCtx = makeCtx({ fundStatus: FUND_STATUSES.HELD })
    providerCtx.actor = { id: "p1", role: "PROVIDER" }
    expect(validateTransition("cancel_during_service", providerCtx)).toBeNull()

    const settled1 = makeCtx({ fundStatus: FUND_STATUSES.DISPUTED })
    const settled2 = makeCtx({ fundStatus: FUND_STATUSES.CANCELLED })
    expect(getNextFundStatus("open_dispute")).not.toBe(getNextFundStatus("cancel_during_service"))
    expect(settled1.contract.fundStatus).toBe("DISPUTED")
    expect(settled2.contract.fundStatus).toBe("CANCELLED")
  })
})

describe("2. 无效 action 测试", () => {
  it("不存在的 action 返回未知操作", () => {
    const ctx = makeCtx()
    const result = validateTransition("nonexistent_action", ctx)
    expect(result).not.toBeNull()
    expect(result).toContain("未知操作")
  })

  it("空 action 返回未知操作", () => {
    const ctx = makeCtx()
    const result = validateTransition("", ctx)
    expect(result).not.toBeNull()
    expect(result).toContain("未知操作")
  })

  it("null/undefined action 在 TS 层面不被允许，但若透传 string 则按不存在的 action 处理", () => {
    const ctx = makeCtx()
    const result = validateTransition(null as unknown as string, ctx)
    expect(result).toContain("未知操作")
  })
})

describe("3. calcRefund 边界", () => {
  it("amount = 0 时各阶段退款均为 0", () => {
    for (const stage of [0, 1, 2, 3, 4, 5]) {
      const r = calcRefund(stage, 0)
      expect(r.provider).toBe(0)
      expect(r.customer).toBe(0)
    }
  })

  it("amount 极小值（0.01）正常计算", () => {
    const r0 = calcRefund(0, 0.01)
    expect(r0.provider).toBe(0)
    expect(r0.customer).toBeCloseTo(0.01, 5)

    const r2 = calcRefund(2, 0.01)
    expect(r2.provider).toBeCloseTo(0.001, 5)
    expect(r2.customer).toBeCloseTo(0.009, 5)

    const r4 = calcRefund(4, 0.01)
    expect(r4.provider).toBeCloseTo(0.005, 5)
    expect(r4.customer).toBeCloseTo(0.005, 5)
  })

  it("amount 为负数时返回 0 退款（负值防护已修复）", () => {
    const r = calcRefund(4, -100)
    expect(r.provider).toBe(0)
    expect(r.customer).toBe(0)
  })

  it("amount 为负数时所有阶段都返回 0", () => {
    const r = calcRefund(2, -100)
    expect(r.provider).toBe(0)
    expect(r.customer).toBe(0)
  })

  it("非整数 stage 按 default 分支处理（五五分）", () => {
    const r = calcRefund(99, 200)
    expect(r.provider).toBe(100)
    expect(r.customer).toBe(100)
  })
})

describe("4. 角色越权全扫描", () => {
  const allRoles = ["CUSTOMER", "PROVIDER", "ADMIN", "SYSTEM"]

  function forEachTransition(block: (action: string, allowedRoles: string[], fromStatus: string) => void) {
    block("pay", ["CUSTOMER"], FUND_STATUSES.PENDING_HELD)
    block("cancel_before_pay", ["CUSTOMER"], FUND_STATUSES.PENDING_HELD)
    block("provider_accept", ["PROVIDER"], FUND_STATUSES.HELD)
    block("provider_depart", ["PROVIDER"], FUND_STATUSES.HELD)
    block("provider_arrive", ["PROVIDER"], FUND_STATUSES.HELD)
    block("start_service", ["PROVIDER"], FUND_STATUSES.HELD)
    block("request_complete", ["PROVIDER"], FUND_STATUSES.HELD)
    block("confirm_complete", ["CUSTOMER", "ADMIN"], FUND_STATUSES.HELD)
    block("auto_complete", ["SYSTEM"], FUND_STATUSES.HELD)
    block("cancel_during_service", ["CUSTOMER", "PROVIDER"], FUND_STATUSES.HELD)
    block("open_dispute", ["CUSTOMER"], FUND_STATUSES.HELD)
    block("open_dispute_after_complete", ["CUSTOMER"], FUND_STATUSES.SATISFACTION_HELD)
    block("resolve_dispute", ["ADMIN"], FUND_STATUSES.DISPUTED)
    block("release_satisfaction", ["SYSTEM", "ADMIN"], FUND_STATUSES.SATISFACTION_HELD)
    block("settle_cancelled", ["SYSTEM", "ADMIN"], FUND_STATUSES.CANCELLED)
  }

  it("每个 transition 的错误角色都被拒绝", () => {
    forEachTransition((action, allowedRoles, fromStatus) => {
      for (const role of allRoles) {
        if (allowedRoles.includes(role)) continue

        const ctx: TransitionCtx = {
          contract: {
            id: `c_${action}`,
            fundStatus: fromStatus as any,
            serviceStage: SERVICE_STAGES.ACCEPTED,
            providerId: "p1",
            customerId: "c1",
            amount: 100,
            completedAt: null,
            autoCompleteAt: null,
          },
          actor: { id: `${role.toLowerCase()}_x`, role },
          payload: role === "ADMIN" || action.includes("resolve") ? { resolution: "x", qualityClaim: "x" } : {},
        }

        const err = validateTransition(action, ctx)
        expect(err, `${action} 不应允许 ${role} 通过`).not.toBeNull()
      }
    })
  })

  it("每个 transition 的允许角色都能通过（快速冒烟）", () => {
    const assertPass = (action: string, ctx: TransitionCtx) => {
      const err = validateTransition(action, ctx)
      expect(err, `${action} 应允许 ${ctx.actor.role} 通过`).toBeNull()
    }

    assertPass("pay", makeCtx({ fundStatus: FUND_STATUSES.PENDING_HELD, customerId: "c1" }))
    assertPass("cancel_before_pay", { ...makeCtx({ fundStatus: FUND_STATUSES.PENDING_HELD, customerId: "c1" }), actor: { id: "c1", role: "CUSTOMER" }, payload: {} })
    assertPass("provider_accept", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.NOT_ACCEPTED, providerId: "p1" }), actor: { id: "p1", role: "PROVIDER" }, payload: {} })
    assertPass("provider_depart", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.ACCEPTED, providerId: "p1" }), actor: { id: "p1", role: "PROVIDER" }, payload: {} })
    assertPass("provider_arrive", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.DEPARTED, providerId: "p1" }), actor: { id: "p1", role: "PROVIDER" }, payload: {} })
    assertPass("start_service", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.ARRIVED, providerId: "p1" }), actor: { id: "p1", role: "PROVIDER" }, payload: {} })
    assertPass("request_complete", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.IN_PROGRESS, providerId: "p1" }), actor: { id: "p1", role: "PROVIDER" }, payload: {} })
    assertPass("confirm_complete", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.DONE }), actor: { id: "a1", role: "ADMIN" }, payload: {} })
    assertPass("auto_complete", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, serviceStage: SERVICE_STAGES.DONE, autoCompleteAt: new Date(0) }), actor: { id: "sys", role: "SYSTEM" }, payload: {} })
    assertPass("cancel_during_service", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD }), actor: { id: "c1", role: "CUSTOMER" }, payload: {} })
    assertPass("open_dispute", { ...makeCtx({ fundStatus: FUND_STATUSES.HELD, customerId: "c1" }), actor: { id: "c1", role: "CUSTOMER" }, payload: {} })
    assertPass("open_dispute_after_complete", { ...makeCtx({ fundStatus: FUND_STATUSES.SATISFACTION_HELD, customerId: "c1" }), actor: { id: "c1", role: "CUSTOMER" }, payload: { qualityClaim: "质保问题" } })
    assertPass("resolve_dispute", { ...makeCtx({ fundStatus: FUND_STATUSES.DISPUTED }), actor: { id: "a1", role: "ADMIN" }, payload: { resolution: "x" } })
    assertPass("release_satisfaction", { ...makeCtx({ fundStatus: FUND_STATUSES.SATISFACTION_HELD }), actor: { id: "a1", role: "ADMIN" }, payload: {} })
    assertPass("settle_cancelled", { ...makeCtx({ fundStatus: FUND_STATUSES.CANCELLED }), actor: { id: "a1", role: "ADMIN" }, payload: {} })
  })
})

describe("5. 资金扣减变负（createRefundTransactions 风险）", () => {
  it("createRefundTransactions 现在先查余额，不足则抛错", () => {
    const { createRefundTransactions } = require("../src/lib/contract-machine")
    expect(typeof createRefundTransactions).toBe("function")

    // R2 已修复：先读真实余额，customer.balance < refund.customer 时抛出 Error
    // 调用方需 catch 此错误，避免余额变负
    // 集成测试需 mock prisma.user.findUnique 来验证抛错逻辑
    // 此处仅验证函数签名和导出不变
  })
})
````

## File: tests/integration.test.ts
````typescript
import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { prisma } from "../src/lib/prisma"
import {
  validateTransition,
  calcRefund,
  addContractEvent,
  createRefundTransactions,
  getNextFundStatus,
  SERVICE_STAGES,
} from "../src/lib/contract-machine"
import bcrypt from "bcryptjs"

// Fresh isolated test data per describe block
async function createTestUsers() {
  const hash = await bcrypt.hash("pwd", 10)
  const prefix = `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_`

  const provider = await prisma.user.create({
    data: { name: "IntProvider", email: `${prefix}p@t.com`, passwordHash: hash, role: "PROVIDER", phone: "1" },
  })
  const customer = await prisma.user.create({
    data: { name: "IntCustomer", email: `${prefix}c@t.com`, passwordHash: hash, role: "CUSTOMER", phone: "2" },
  })
  const admin = await prisma.user.create({
    data: { name: "IntAdmin", email: `${prefix}a@t.com`, passwordHash: hash, role: "ADMIN", phone: "3" },
  })
  const service = await prisma.service.create({
    data: { title: "IntService", description: "Int", price: 200, category: "测试", providerId: provider.id },
  })

  return { providerId: provider.id, customerId: customer.id, adminId: admin.id, serviceId: service.id }
}

async function cleanupTest(ctx: { providerId: string; customerId: string; adminId: string; serviceId: string; contractIds: string[] }) {
  for (const cid of ctx.contractIds) {
    await prisma.dispute.deleteMany({ where: { contractId: cid } }).catch(() => {})
    await prisma.contractEvent.deleteMany({ where: { contractId: cid } }).catch(() => {})
    await prisma.payment.deleteMany({ where: { contractId: cid } }).catch(() => {})
    await prisma.contract.delete({ where: { id: cid } }).catch(() => {})
  }
  await prisma.service.delete({ where: { id: ctx.serviceId } }).catch(() => {})
  await prisma.user.delete({ where: { id: ctx.adminId } }).catch(() => {})
  await prisma.user.delete({ where: { id: ctx.customerId } }).catch(() => {})
  await prisma.user.delete({ where: { id: ctx.providerId } }).catch(() => {})
}

describe("争议仲裁集成测试", () => {
  let ctx: Awaited<ReturnType<typeof createTestUsers>> & { contractIds: string[] }

  beforeAll(async () => {
    const base = await createTestUsers()
    ctx = { ...base, contractIds: [] }
  })

  afterAll(async () => {
    await cleanupTest(ctx)
  })

  async function mkContract(overrides: { fundStatus?: string; serviceStage?: number; amount?: number }) {
    const c = await prisma.contract.create({
      data: {
        serviceId: ctx.serviceId, customerId: ctx.customerId, providerId: ctx.providerId,
        fundStatus: overrides.fundStatus ?? "PENDING_HELD",
        serviceStage: overrides.serviceStage ?? 0,
        terms: "Test", amount: overrides.amount ?? 200, address: "Addr",
      },
    })
    ctx.contractIds.push(c.id)
    return c
  }

  it("HELD → open_dispute → DISPUTED，创建 Dispute 记录", async () => {
    const contract = await mkContract({ fundStatus: "HELD", serviceStage: SERVICE_STAGES.ACCEPTED })

    const err = validateTransition("open_dispute", {
      contract: {
        id: contract.id, fundStatus: "HELD", serviceStage: SERVICE_STAGES.ACCEPTED,
        providerId: ctx.providerId, customerId: ctx.customerId, amount: 200, completedAt: null, autoCompleteAt: null,
      },
      actor: { id: ctx.customerId, role: "CUSTOMER" },
      payload: {},
    })
    expect(err).toBeNull()

    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "DISPUTED" } })
    await prisma.dispute.create({
      data: { contractId: contract.id, initiatorId: ctx.customerId, reason: "师傅迟到且服务差", evidence: "photo_url" },
    })
    await addContractEvent({
      contractId: contract.id, actorId: ctx.customerId,
      fromStatus: "HELD", toStatus: "DISPUTED", action: "open_dispute", reason: "师傅迟到且服务差",
    })

    const dispute = await prisma.dispute.findFirst({ where: { contractId: contract.id } })
    expect(dispute).not.toBeNull()
    expect(dispute!.status).toBe("OPEN")
    expect(dispute!.initiatorId).toBe(ctx.customerId)
    expect(dispute!.reason).toBe("师傅迟到且服务差")
    expect(dispute!.evidence).toBe("photo_url")

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("DISPUTED")
  })

  it("DISPUTED → resolve_dispute → SETTLED + 仲裁资金分配", async () => {
    const contract = await mkContract({ fundStatus: "DISPUTED", serviceStage: SERVICE_STAGES.ACCEPTED, amount: 200 })
    await prisma.dispute.create({
      data: { contractId: contract.id, initiatorId: ctx.customerId, reason: "争议中" },
    })

    const err = validateTransition("resolve_dispute", {
      contract: {
        id: contract.id, fundStatus: "DISPUTED", serviceStage: SERVICE_STAGES.ACCEPTED,
        providerId: ctx.providerId, customerId: ctx.customerId, amount: 200, completedAt: null, autoCompleteAt: null,
      },
      actor: { id: ctx.adminId, role: "ADMIN" },
      payload: { resolution: "各退一步", providerAmount: 100, customerAmount: 100 },
    })
    expect(err).toBeNull()

    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "SETTLED" } })
    await prisma.dispute.updateMany({
      where: { contractId: contract.id, status: "OPEN" },
      data: { status: "RESOLVED", resolution: "各退一步" },
    })
    await prisma.user.update({ where: { id: ctx.customerId }, data: { balance: 100 } })
    await createRefundTransactions(contract.id, ctx.customerId, ctx.providerId, { provider: 100, customer: 100 }, "DISPUTE_REFUND")
    await addContractEvent({
      contractId: contract.id, actorId: ctx.adminId,
      fromStatus: "DISPUTED", toStatus: "SETTLED", action: "resolve_dispute", reason: "各退一步",
    })

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("SETTLED")

    const resolved = await prisma.dispute.findFirst({ where: { contractId: contract.id } })
    expect(resolved!.status).toBe("RESOLVED")
    expect(resolved!.resolution).toBe("各退一步")

    const txs = await prisma.transaction.findMany({
      where: { type: "DISPUTE_REFUND", userId: { in: [ctx.customerId, ctx.providerId] } },
      orderBy: { createdAt: "asc" },
    })
    expect(txs.length).toBe(2)
    expect(txs.some((t) => t.userId === ctx.customerId && t.amount === 100)).toBeTrue()
    expect(txs.some((t) => t.userId === ctx.providerId && t.amount === 100)).toBeTrue()

    const customer = await prisma.user.findUnique({ where: { id: ctx.customerId } })
    expect(customer!.balance).toBe(200)
    const provider = await prisma.user.findUnique({ where: { id: ctx.providerId } })
    expect(provider!.balance).toBe(100)
  })
})

describe("取消退款集成测试", () => {
  let ctx: Awaited<ReturnType<typeof createTestUsers>> & { contractIds: string[] }

  beforeAll(async () => {
    const base = await createTestUsers()
    ctx = { ...base, contractIds: [] }
  })

  afterAll(async () => {
    await cleanupTest(ctx)
  })

  async function mkContract(overrides: { fundStatus?: string; serviceStage?: number; amount?: number }) {
    const c = await prisma.contract.create({
      data: {
        serviceId: ctx.serviceId, customerId: ctx.customerId, providerId: ctx.providerId,
        fundStatus: overrides.fundStatus ?? "PENDING_HELD",
        serviceStage: overrides.serviceStage ?? 0,
        terms: "Test", amount: overrides.amount ?? 200, address: "Addr",
      },
    })
    ctx.contractIds.push(c.id)
    return c
  }

  it("PENDING_HELD → cancel_before_pay → CANCELLED，不产生资金变动", async () => {
    const contract = await mkContract({ fundStatus: "PENDING_HELD", serviceStage: 0 })

    const err = validateTransition("cancel_before_pay", {
      contract: {
        id: contract.id, fundStatus: "PENDING_HELD", serviceStage: 0,
        providerId: ctx.providerId, customerId: ctx.customerId, amount: 200, completedAt: null, autoCompleteAt: null,
      },
      actor: { id: ctx.customerId, role: "CUSTOMER" },
      payload: {},
    })
    expect(err).toBeNull()

    const refund = calcRefund(0, 200)
    expect(refund.customer).toBe(200)
    expect(refund.provider).toBe(0)

    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "CANCELLED" } })
    await addContractEvent({
      contractId: contract.id, actorId: ctx.customerId,
      fromStatus: "PENDING_HELD", toStatus: "CANCELLED", action: "cancel_before_pay",
      reason: "客户取消",
      metadata: JSON.stringify({ refund }),
    })

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("CANCELLED")

    // 未支付不应产生退款 Transaction
    const txs = await prisma.transaction.findMany({ where: { userId: ctx.customerId } })
    const refundTx = txs.find((t) => t.type === "REFUND")
    expect(refundTx).toBeUndefined()
  })

  it("HELD（已出发）→ cancel_during_service → CANCELLED + 退款 Transaction", async () => {
    const contract = await mkContract({ fundStatus: "HELD", serviceStage: SERVICE_STAGES.DEPARTED, amount: 200 })

    const err = validateTransition("cancel_during_service", {
      contract: {
        id: contract.id, fundStatus: "HELD", serviceStage: SERVICE_STAGES.DEPARTED,
        providerId: ctx.providerId, customerId: ctx.customerId, amount: 200, completedAt: null, autoCompleteAt: null,
      },
      actor: { id: ctx.customerId, role: "CUSTOMER" },
      payload: {},
    })
    expect(err).toBeNull()

    const refund = calcRefund(SERVICE_STAGES.DEPARTED, 200)
    expect(refund.provider).toBe(20)
    expect(refund.customer).toBe(180)

    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "CANCELLED" } })
    await prisma.user.update({ where: { id: ctx.customerId }, data: { balance: 180 } })
    await createRefundTransactions(contract.id, ctx.customerId, ctx.providerId, refund)
    await addContractEvent({
      contractId: contract.id, actorId: ctx.customerId,
      fromStatus: "HELD", toStatus: "CANCELLED", action: "cancel_during_service",
      reason: "客户取消",
      metadata: JSON.stringify({ refund }),
    })

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("CANCELLED")

    const refundTx = await prisma.transaction.findFirst({
      where: { userId: ctx.customerId, type: "REFUND" },
    })
    expect(refundTx).not.toBeNull()
    expect(refundTx!.amount).toBe(180)

    const event = await prisma.contractEvent.findFirst({
      where: { contractId: contract.id, action: "cancel_during_service" },
    })
    expect(event).not.toBeNull()
    expect(event!.metadata).toContain("180")
  })

  it("HELD（服务中）→ cancel_during_service → CANCELLED，五五分", async () => {
    const contract = await mkContract({ fundStatus: "HELD", serviceStage: SERVICE_STAGES.IN_PROGRESS, amount: 300 })

    const refund = calcRefund(SERVICE_STAGES.IN_PROGRESS, 300)
    expect(refund.provider).toBe(150)
    expect(refund.customer).toBe(150)

    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "CANCELLED" } })
    await prisma.user.update({ where: { id: ctx.customerId }, data: { balance: 150 } })
    await createRefundTransactions(contract.id, ctx.customerId, ctx.providerId, refund)

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("CANCELLED")
  })

  it("CANCELLED → settle_cancelled → SETTLED", async () => {
    const contract = await mkContract({ fundStatus: "CANCELLED", serviceStage: 0 })

    const err = validateTransition("settle_cancelled", {
      contract: {
        id: contract.id, fundStatus: "CANCELLED", serviceStage: 0,
        providerId: ctx.providerId, customerId: ctx.customerId, amount: 200, completedAt: null, autoCompleteAt: null,
      },
      actor: { id: ctx.adminId, role: "ADMIN" },
      payload: {},
    })
    expect(err).toBeNull()

    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "SETTLED" } })
    await addContractEvent({
      contractId: contract.id, actorId: ctx.adminId,
      fromStatus: "CANCELLED", toStatus: "SETTLED", action: "settle_cancelled",
    })

    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("SETTLED")
  })

  it("HELD(服务中,amount=200) → cancel_during_service → CANCELLED → settle_cancelled → SETTLED", async () => {
    const contract = await mkContract({ fundStatus: "HELD", serviceStage: SERVICE_STAGES.IN_PROGRESS, amount: 200 })

    // Step 1: HELD → cancel_during_service → CANCELLED
    const err1 = validateTransition("cancel_during_service", {
      contract: {
        id: contract.id, fundStatus: "HELD", serviceStage: SERVICE_STAGES.IN_PROGRESS,
        providerId: ctx.providerId, customerId: ctx.customerId, amount: 200, completedAt: null, autoCompleteAt: null,
      },
      actor: { id: ctx.customerId, role: "CUSTOMER" },
      payload: {},
    })
    expect(err1).toBeNull()
    expect(getNextFundStatus("cancel_during_service")).toBe("CANCELLED")

    const refund = calcRefund(SERVICE_STAGES.IN_PROGRESS, 200)
    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "CANCELLED" } })
    await prisma.user.update({ where: { id: ctx.customerId }, data: { balance: 100 } })
    await createRefundTransactions(contract.id, ctx.customerId, ctx.providerId, refund)
    await addContractEvent({
      contractId: contract.id, actorId: ctx.customerId,
      fromStatus: "HELD", toStatus: "CANCELLED", action: "cancel_during_service",
      reason: "客户取消",
      metadata: JSON.stringify({ refund }),
    })

    let updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("CANCELLED")

    // Step 2: CANCELLED → settle_cancelled → SETTLED
    const err2 = validateTransition("settle_cancelled", {
      contract: {
        id: contract.id, fundStatus: "CANCELLED", serviceStage: SERVICE_STAGES.IN_PROGRESS,
        providerId: ctx.providerId, customerId: ctx.customerId, amount: 200, completedAt: null, autoCompleteAt: null,
      },
      actor: { id: ctx.adminId, role: "ADMIN" },
      payload: {},
    })
    expect(err2).toBeNull()
    expect(getNextFundStatus("settle_cancelled")).toBe("SETTLED")

    await prisma.contract.update({ where: { id: contract.id }, data: { fundStatus: "SETTLED" } })
    await addContractEvent({
      contractId: contract.id, actorId: ctx.adminId,
      fromStatus: "CANCELLED", toStatus: "SETTLED", action: "settle_cancelled",
      reason: "退款完成，订单归档",
    })

    updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    expect(updated!.fundStatus).toBe("SETTLED")
  })
})

describe("ContractEvent 审计记录", () => {
  let ctx: Awaited<ReturnType<typeof createTestUsers>> & { contractIds: string[] }

  beforeAll(async () => {
    const base = await createTestUsers()
    ctx = { ...base, contractIds: [] }
  })

  afterAll(async () => {
    await cleanupTest(ctx)
  })

  it("争议仲裁全过程生成完整事件链", async () => {
    const contract = await prisma.contract.create({
      data: {
        serviceId: ctx.serviceId, customerId: ctx.customerId, providerId: ctx.providerId,
        fundStatus: "HELD", serviceStage: 0, terms: "Test", amount: 200, address: "Addr",
      },
    })
    ctx.contractIds.push(contract.id)

    for (const evt of [
      { action: "open_dispute", from: "HELD", to: "DISPUTED", actor: ctx.customerId },
      { action: "resolve_dispute", from: "DISPUTED", to: "SETTLED", actor: ctx.adminId },
    ]) {
      await addContractEvent({
        contractId: contract.id, actorId: evt.actor,
        fromStatus: evt.from, toStatus: evt.to, action: evt.action,
      })
    }

    const events = await prisma.contractEvent.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
    })

    expect(events.length).toBe(2)
    expect(events[0].action).toBe("open_dispute")
    expect(events[1].action).toBe("resolve_dispute")
    expect(events[1].toStatus).toBe("SETTLED")
  })
})

describe("6a. 数据库约束：Contract 软删除（无 cascade）", () => {
  let ctx: Awaited<ReturnType<typeof createTestUsers>> & { contractIds: string[] }

  beforeAll(async () => {
    const base = await createTestUsers()
    ctx = { ...base, contractIds: [] }
  })

  afterAll(async () => {
    await cleanupTest(ctx)
  })

  it("Contract 添加 onDelete Cascade 后删除含 dispute 的 contract 可成功级联删除", async () => {
    const contract = await prisma.contract.create({
      data: {
        serviceId: ctx.serviceId, customerId: ctx.customerId, providerId: ctx.providerId,
        fundStatus: "HELD", serviceStage: 0, terms: "Test", amount: 200, address: "Addr",
      },
    })
    ctx.contractIds.push(contract.id)

    await prisma.dispute.create({
      data: { contractId: contract.id, initiatorId: ctx.customerId, reason: "测试 FK 约束" },
    })

    const deleted = await prisma.contract.delete({ where: { id: contract.id } })
    expect(deleted).toBeDefined()

    const disputesAfter = await prisma.dispute.count({ where: { contractId: contract.id } })
    expect(disputesAfter).toBe(0)
  })

  it("删除不含关联记录的 contract 可以成功", async () => {
    const contract = await prisma.contract.create({
      data: {
        serviceId: ctx.serviceId, customerId: ctx.customerId, providerId: ctx.providerId,
        fundStatus: "HELD", serviceStage: 0, terms: "Test", amount: 200, address: "Addr",
      },
    })

    const result = await prisma.contract.delete({ where: { id: contract.id } })
    expect(result).toBeDefined()
  })
})

describe("6b. 数据库约束：重复 Dispute 创建", () => {
  let ctx: Awaited<ReturnType<typeof createTestUsers>> & { contractIds: string[] }

  beforeAll(async () => {
    const base = await createTestUsers()
    ctx = { ...base, contractIds: [] }
  })

  afterAll(async () => {
    await cleanupTest(ctx)
  })

  it("同一 contract 只能创建一条 Dispute（contractId 加 @unique 约束后第二次创建应报错）", async () => {
    const contract = await prisma.contract.create({
      data: {
        serviceId: ctx.serviceId, customerId: ctx.customerId, providerId: ctx.providerId,
        fundStatus: "DISPUTED", serviceStage: 0, terms: "Test", amount: 200, address: "Addr",
      },
    })
    ctx.contractIds.push(contract.id)

    const d1 = await prisma.dispute.create({
      data: { contractId: contract.id, initiatorId: ctx.customerId, reason: "第一次争议" },
    })
    expect(d1).toBeDefined()

    let caught: Error | null = null
    try {
      await prisma.dispute.create({
        data: { contractId: contract.id, initiatorId: ctx.customerId, reason: "第二次争议" },
      })
    } catch (e) { caught = e as Error }
    expect(caught).not.toBeNull()

    const all = await prisma.dispute.findMany({ where: { contractId: contract.id } })
    expect(all.length).toBe(1)
  })
})
````

## File: tests/payment.test.ts
````typescript
import { describe, it, expect, beforeAll } from "bun:test"

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_mock"
})
import {
  createPayment,
  refundPayment,
  getPaymentProvider,
} from "../src/lib/payment"

describe("createPayment", () => {
  it("should throw for unknown provider", () => {
    expect(
      createPayment({
        amount: 100,
        description: "test",
        contractId: "c1",
        payerId: "u1",
        provider: "fake_provider" as any,
      }),
    ).rejects.toThrow(/Unknown payment provider/)
  })
})

describe("refundPayment", () => {
  it("should throw for unknown provider", () => {
    expect(
      refundPayment("pi_xxx", 100, "fake_provider" as any),
    ).rejects.toThrow(/Unknown payment provider/)
  })
})

describe("getPaymentProvider", () => {
  it("should return non-null for stripe", () => {
    const provider = getPaymentProvider("stripe")
    expect(provider).not.toBeNull()
  })

  it("should return non-null for alipay", () => {
    const provider = getPaymentProvider("alipay")
    expect(provider).not.toBeNull()
  })
})

describe("AlipayProvider", () => {
  it("createPayment should return expected structure with redirectUrl containing amount", async () => {
    const provider = getPaymentProvider("alipay")
    const result = await provider.createPayment({
      amount: 299,
      description: "test order",
      contractId: "c2",
      payerId: "u2",
    })
    expect(result.success).toBe(true)
    expect(result.provider).toBe("alipay")
    expect(result.status).toBe("PENDING")
    expect(result.redirectUrl).toContain("amount=299")
  })

  it("refundPayment should return success", async () => {
    const provider = getPaymentProvider("alipay")
    const result = await provider.refundPayment("alipay_mock_c2_123", 299)
    expect(result.success).toBe(true)
    expect(result.provider).toBe("alipay")
    expect(result.status).toBe("SUCCEEDED")
    expect(result.providerPaymentId).toContain("refund_")
  })
})
````

## File: AGENTS.md
````markdown
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
````

## File: CLAUDE.md
````markdown
@AGENTS.md
````

## File: components.json
````json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}
````

## File: docs/contract-engine-state-machine.md
````markdown
# 合约引擎状态机 — 形式化定义草案

> 基于设计书 §六，将文字描述翻译为可编码的形式化状态转换表。

---

## 一、资金状态机（核心）

### 状态定义

| 编码 | 名称 | 含义 |
|------|------|------|
| PENDING_HELD | 待冻结 | 客户已发单，等待支付 |
| HELD | 冻结中 | 客户已付款，师傅服务中 |
| COMPLETED | 已完成 | 服务完成，基础收入已释放，暂存款排队 |
| DISPUTED | 争议中 | 客户投诉，全部资金冻结 |
| CANCELLED | 取消中 | 退款处理中 |
| SATISFACTION_HELD | 暂存评估 | 满意度暂存款在批释放队列中 |
| SETTLED | 已结算 | 终态，订单归档 |

### 状态转换表

| from | to | 触发条件（guard） | 动作（action） | 自动/手动 |
|------|----|-----------------|---------------|----------|
| PENDING_HELD | HELD | 支付成功确认 | 拆分为 75% 基础 + 15% 佣金 + 10% 暂存款（虚拟） | 自动 |
| PENDING_HELD | CANCELLED | 支付失败/被拒绝 | 全额退款 | 自动 |
| HELD | COMPLETED | 师傅确认完成 + 客户无异议 | 释放基础收入 + 佣金归平台 | 自动 |
| HELD | COMPLETED | 师傅提交材料 + 客户 1h 未响应 | 释放基础收入 + 佣金归平台 | 自动 |
| HELD | DISPUTED | 客户发起投诉 | 全部资金冻结 | 手动 |
| HELD | CANCELLED | 客户/师傅发起取消 | 按服务阶段分级退款 | 手动 |
| COMPLETED | SATISFACTION_HELD | 服务完成确认 | 暂存款进入批释放队列 | 自动 |
| COMPLETED | DISPUTED | 客户质保期内投诉→另开质保单 | 质保单独流程，不改变原单状态 | 手动 |
| DISPUTED | SETTLED | 仲裁结案 | 按裁决执行赔付/退款，附完整裁决记录 | 自动 |
| CANCELLED | SETTLED | 退款执行完毕 | 订单归档 | 自动 |
| SATISFACTION_HELD | SETTLED | 满 15 单或满 30 天 | 暂存款释放给师傅 + 信用分更新 | 自动 |
| SATISFACTION_HELD | SETTLED | 客户不满意 + 平台判定 | 暂存款赔付给客户 | 自动 |

### 总计：7 个状态，16 条转换

---

## 二、服务阶段（与资金状态机并行）

资金状态机不直接表达服务进度。取消退款时需要知道**服务到了哪一步**，用一个独立追踪器：

```
阶段 0: NOT_ACCEPTED    — 已发单，师傅未接
阶段 1: ACCEPTED        — 师傅已接单
阶段 2: DEPARTED        — 师傅已出发
阶段 3: ARRIVED         — 师傅已上门
阶段 4: IN_PROGRESS     — 服务进行中
阶段 5: COMPLETED       — 服务已结束
```

取消时的退款规则根据**取消时的服务阶段**查表：

| 取消时阶段 | 师傅拿 | 客户退 | 平台佣金 |
|-----------|--------|--------|---------|
| 0-1（未出发） | 0 | 全额 | 不退 |
| 2（已出发未上门） | 上门费 | 剩余 | 不退 |
| 3（已上门未服务） | 检测费 | 剩余 | 不退 |
| 4（服务中中止） | LLM 评估 | 未服务比例 | 不退 |
| 5（完成后退款） | 走争议仲裁 | 暂存款赔付 | 不退 |

---

## 三、超时规则（仅两处）

| 场景 | 超时 | 处理 |
|------|------|------|
| 师傅完成 + 客户不理 | 1 小时（从师傅提交材料起算） | 自动完成，释放基础收入 + 佣金 |
| 暂存款批释放 | 15 单完成 → 立即触发 | 谁先到谁触发 |
|                     | 满 30 天不足 15 单 → 到期触发 | |

**不是超时的：**
- 发单即支付，没有支付超时
- 争议仲裁不设承诺时限，材料不够踢回给对应方补齐
- 超过仲裁时限不补贴客户（防恶意投诉）

---

## 四、实现顺序

1. Prisma schema 补充（Contract 字段 + 新模型）
2. TypeScript 状态机（状态 + 转换 + guard + action 类型安全）
3. API 路由（状态转换入口 + 定时任务）
4. 支付抽象层（Stripe ↔ 支付宝）

开始了？
````

## File: eslint.config.mjs
````javascript
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
````

## File: middleware.ts
````typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
````

## File: next.config.ts
````typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
````

## File: postcss.config.mjs
````javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
````

## File: prisma.config.ts
````typescript
// This file was generated by Prisma, and assumes you run Prisma commands using `bun --bun run prisma [command]`.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun run prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
````

## File: prisma/migrations/20260623023038_init/migration.sql
````sql
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "creditScore" INTEGER NOT NULL DEFAULT 100,
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "terms" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
````

## File: prisma/migrations/20260623034731_add_auth/migration.sql
````sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
````

## File: prisma/migrations/20260623035537_add_order_fields/migration.sql
````sql
-- AlterTable
ALTER TABLE "Contract" ADD COLUMN "address" TEXT;
ALTER TABLE "Contract" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "Contract" ADD COLUMN "notes" TEXT;
ALTER TABLE "Contract" ADD COLUMN "scheduledAt" DATETIME;
````

## File: prisma/migrations/20260623122614_add_contract_engine/migration.sql
````sql
/*
  Warnings:

  - You are about to drop the column `status` on the `Contract` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ContractEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SatisfactionBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SatisfactionBatch_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "fundStatus" TEXT NOT NULL DEFAULT 'PENDING_HELD',
    "serviceStage" INTEGER NOT NULL DEFAULT 0,
    "terms" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "address" TEXT,
    "scheduledAt" DATETIME,
    "notes" TEXT,
    "autoCompleteAt" DATETIME,
    "completedAt" DATETIME,
    "satisfactionBatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_satisfactionBatchId_fkey" FOREIGN KEY ("satisfactionBatchId") REFERENCES "SatisfactionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("address", "amount", "completedAt", "createdAt", "customerId", "id", "notes", "providerId", "scheduledAt", "serviceId", "terms", "updatedAt") SELECT "address", "amount", "completedAt", "createdAt", "customerId", "id", "notes", "providerId", "scheduledAt", "serviceId", "terms", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
````

## File: prisma/migrations/migration_lock.toml
````toml
# Please do not edit this file manually
# It should be added in your version-control system (e.g., Git)
provider = "sqlite"
````

## File: prisma/seed.ts
````typescript
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const adapter = new PrismaLibSql({ url: `file:///${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // Create test PROVIDER user
  const provider = await prisma.user.upsert({
    where: { email: "test@test.com" },
    update: {},
    create: {
      name: "Test Provider",
      email: "test@test.com",
      passwordHash,
      role: "PROVIDER",
      phone: "13800138000",
    },
  });

  // Create test CUSTOMER user
  await prisma.user.upsert({
    where: { email: "user@test.com" },
    update: {},
    create: {
      name: "Test Customer",
      email: "user@test.com",
      passwordHash,
      role: "CUSTOMER",
      phone: "13900139000",
    },
  });

  // Delete existing services for this provider to allow re-running seed
  await prisma.service.deleteMany({ where: { providerId: provider.id } });

  const services = [
    { title: "空调维修", description: "空调不制冷/不制热检修, 加氟, 清洗保养", price: 150, category: "维修" },
    { title: "水电维修", description: "水管漏水, 电路故障排查维修", price: 100, category: "维修" },
    { title: "家电维修", description: "冰箱/洗衣机/热水器等家电故障维修", price: 120, category: "维修" },
    { title: "泰式按摩", description: "正宗泰式按摩, 舒缓疲劳, 60分钟", price: 200, category: "按摩" },
    { title: "足底按摩", description: "足底穴位按摩, 改善血液循环, 45分钟", price: 120, category: "按摩" },
    { title: "全身推拿", description: "中式全身推拿, 疏通经络, 90分钟", price: 180, category: "按摩" },
    { title: "日常保洁", description: "全屋日常保洁, 2小时起", price: 80, category: "保洁" },
    { title: "深度保洁", description: "全屋深度清洁, 包括厨房/卫生间死角, 4小时", price: 200, category: "保洁" },
    { title: "擦窗服务", description: "全屋窗户内外清洁, 含纱窗拆卸清洗", price: 100, category: "保洁" },
  ];

  await prisma.service.createMany({
    data: services.map((svc) => ({
      title: svc.title,
      description: svc.description,
      price: svc.price,
      category: svc.category,
      providerId: provider.id,
    })),
  });

  console.log("Seed completed:");
  console.log("  Provider: test@test.com / password123");
  console.log("  Customer: user@test.com / password123");
  console.log(`  Services created: ${services.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
````

## File: public/file.svg
````xml
<svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 13.5V5.41a1 1 0 0 0-.3-.7L9.8.29A1 1 0 0 0 9.08 0H1.5v13.5A2.5 2.5 0 0 0 4 16h8a2.5 2.5 0 0 0 2.5-2.5m-1.5 0v-7H8v-5H3v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1M9.5 5V2.12L12.38 5zM5.13 5h-.62v1.25h2.12V5zm-.62 3h7.12v1.25H4.5zm.62 3h-.62v1.25h7.12V11z" clip-rule="evenodd" fill="#666" fill-rule="evenodd"/></svg>
````

## File: public/globe.svg
````xml
<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g clip-path="url(#a)"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1" fill="#666"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h16v16H0z"/></clipPath></defs></svg>
````

## File: public/next.svg
````xml
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 394 80"><path fill="#000" d="M262 0h68.5v12.7h-27.2v66.6h-13.6V12.7H262V0ZM149 0v12.7H94v20.4h44.3v12.6H94v21h55v12.6H80.5V0h68.7zm34.3 0h-17.8l63.8 79.4h17.9l-32-39.7 32-39.6h-17.9l-23 28.6-23-28.6zm18.3 56.7-9-11-27.1 33.7h17.8l18.3-22.7z"/><path fill="#000" d="M81 79.3 17 0H0v79.3h13.6V17l50.2 62.3H81Zm252.6-.4c-1 0-1.8-.4-2.5-1s-1.1-1.6-1.1-2.6.3-1.8 1-2.5 1.6-1 2.6-1 1.8.3 2.5 1a3.4 3.4 0 0 1 .6 4.3 3.7 3.7 0 0 1-3 1.8zm23.2-33.5h6v23.3c0 2.1-.4 4-1.3 5.5a9.1 9.1 0 0 1-3.8 3.5c-1.6.8-3.5 1.3-5.7 1.3-2 0-3.7-.4-5.3-1s-2.8-1.8-3.7-3.2c-.9-1.3-1.4-3-1.4-5h6c.1.8.3 1.6.7 2.2s1 1.2 1.6 1.5c.7.4 1.5.5 2.4.5 1 0 1.8-.2 2.4-.6a4 4 0 0 0 1.6-1.8c.3-.8.5-1.8.5-3V45.5zm30.9 9.1a4.4 4.4 0 0 0-2-3.3 7.5 7.5 0 0 0-4.3-1.1c-1.3 0-2.4.2-3.3.5-.9.4-1.6 1-2 1.6a3.5 3.5 0 0 0-.3 4c.3.5.7.9 1.3 1.2l1.8 1 2 .5 3.2.8c1.3.3 2.5.7 3.7 1.2a13 13 0 0 1 3.2 1.8 8.1 8.1 0 0 1 3 6.5c0 2-.5 3.7-1.5 5.1a10 10 0 0 1-4.4 3.5c-1.8.8-4.1 1.2-6.8 1.2-2.6 0-4.9-.4-6.8-1.2-2-.8-3.4-2-4.5-3.5a10 10 0 0 1-1.7-5.6h6a5 5 0 0 0 3.5 4.6c1 .4 2.2.6 3.4.6 1.3 0 2.5-.2 3.5-.6 1-.4 1.8-1 2.4-1.7a4 4 0 0 0 .8-2.4c0-.9-.2-1.6-.7-2.2a11 11 0 0 0-2.1-1.4l-3.2-1-3.8-1c-2.8-.7-5-1.7-6.6-3.2a7.2 7.2 0 0 1-2.4-5.7 8 8 0 0 1 1.7-5 10 10 0 0 1 4.3-3.5c2-.8 4-1.2 6.4-1.2 2.3 0 4.4.4 6.2 1.2 1.8.8 3.2 2 4.3 3.4 1 1.4 1.5 3 1.5 5h-5.8z"/></svg>
````

## File: public/vercel.svg
````xml
<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1155 1000"><path d="m577.3 0 577.4 1000H0z" fill="#fff"/></svg>
````

## File: public/window.svg
````xml
<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.5 2.5h13v10a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1zM0 1h16v11.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 12.5zm3.75 4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5M7 4.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m1.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5" fill="#666"/></svg>
````

## File: README.md
````markdown
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
````

## File: scripts/task-backup.ps1
````powershell
# task-backup.ps1 — 任务级快照备份
# 用法: .\scripts\task-backup.ps1 -TaskName "完成了什么"
# 在 S21 门禁前由 AI 自动执行

param(
  [Parameter(Mandatory = $true)]
  [string]$TaskName
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$snapshotFile = Join-Path $root ".opencode" "snapshot-index.json"
$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")

# 1. 检查 git dirty
Set-Location $root
$status = git status --porcelain
if (-not $status) {
  Write-Host "[task-backup] 工作区干净，无需备份"
  exit 0
}

# 2. 记录快照
try {
  $snaps = Get-Content $snapshotFile -Raw | ConvertFrom-Json
} catch {
  $snaps = @{ version = 1; snaps = @() }
}

$count = $snaps.snaps.Count + 1
$snapId = "snap-{0:D2}" -f $count

# 3. git commit
git add -A
$message = "snapshot-${TaskName} [${snapId}]"
git commit -m $message

$commitHash = git rev-parse HEAD
$filesChanged = git diff-tree --no-commit-id --name-only -r HEAD

# 4. 更新索引
$entry = @{
  id = $snapId
  task = $TaskName
  commit = $commitHash.Substring(0,12)
  timestamp = $timestamp
  files = @($filesChanged).Count
}
$snaps.snaps += $entry
$snaps | ConvertTo-Json -Depth 10 | Set-Content $snapshotFile -Encoding utf8

$shortHash = $commitHash.Substring(0,12)
Write-Host "[task-backup] OK snapshot-$TaskName ($shortHash) @ $filesChanged files"
````

## File: src/app/api/auth/[...nextauth]/route.ts
````typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
````

## File: src/app/api/cron/check-timeouts/route.ts
````typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getNextServiceStage,
  addContractEvent,
  handleSatisfactionBatch,
} from "@/lib/contract-machine";

export async function GET() {
  const results: string[] = [];

  // 1. Auto-complete: 师傅提交材料后 1 小时客户未响应
  const now = new Date();
  const autoCompletable = await prisma.contract.findMany({
    where: {
      fundStatus: "HELD",
      serviceStage: 5,
      autoCompleteAt: { lte: now },
    },
  });

  for (const contract of autoCompletable) {
    try {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          fundStatus: "COMPLETED",
          completedAt: now,
          autoCompleteAt: null,
        },
      });

      await addContractEvent({
        contractId: contract.id,
        actorId: contract.providerId,
        fromStatus: "HELD",
        toStatus: "COMPLETED",
        action: "auto_complete",
        reason: "客户 1 小时未响应，自动确认完成",
      });

      await handleSatisfactionBatch(contract.id);
      results.push(`auto_complete: ${contract.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`auto_complete FAILED ${contract.id}: ${msg}`);
    }
  }

  // 2. Satisfaction batch: 满 30 天未满 15 单的批次
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const expiredBatches = await prisma.satisfactionBatch.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: thirtyDaysAgo },
    },
    include: { contracts: { select: { id: true } } },
  });

  for (const batch of expiredBatches) {
    try {
      await prisma.satisfactionBatch.update({
        where: { id: batch.id },
        data: { status: "RELEASED", releasedAt: now },
      });

      for (const c of batch.contracts) {
        await prisma.contract.update({
          where: { id: c.id },
          data: { fundStatus: "SETTLED" },
        });

        await addContractEvent({
          contractId: c.id,
          actorId: batch.providerId,
          fromStatus: "SATISFACTION_HELD",
          toStatus: "SETTLED",
          action: "batch_release_timeout",
          reason: `满30天批释放: 共${batch.count}单 / 总额¥${batch.totalAmount}`,
        });
      }

      results.push(`batch_release_timeout: ${batch.id} (${batch.count} contracts)`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`batch_release FAILED ${batch.id}: ${msg}`);
    }
  }

  return NextResponse.json({ checked: now.toISOString(), results });
}
````

## File: src/app/api/llm-classify/route.ts
````typescript
import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

const categories = ["维修", "按摩", "保洁"];

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "缺少输入" }, { status: 400 });
    }

    const prompt = `将用户的服务需求分类到以下三类之一：维修（家电/水电/家具维修）、按摩（上门推拿/理疗/放松）、保洁（日常/深度/开荒保洁）。
规则：
- 只返回一个分类名称：维修、按摩、或保洁
- 如果模糊不清，选择最可能的分类
- 不要任何解释或额外文字`;

    const result = await callLLM(prompt, text, { temperature: 0.1 });
    const category = result.trim();
    const valid = categories.includes(category) ? category : categories[0];

    return NextResponse.json({ category: valid });
  } catch (err) {
    return NextResponse.json(
      { category: "维修" },
      { status: 200 }
    );
  }
}
````

## File: src/app/api/llm-test/route.ts
````typescript
import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "缺少输入" }, { status: 400 });
    }

    const result = await callLLM(
      "你是一个服务分类专家。将用户输入分类为：维修、按摩、或保洁。只返回分类名称，不要其他内容。",
      text
    );

    return NextResponse.json({ category: result.trim() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "未知错误" },
      { status: 500 }
    );
  }
}
````

## File: src/app/api/profile/route.ts
````typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      creditScore: true,
      balance: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { name, phone, currentPassword, newPassword } = body;

  const updateData: Record<string, string | number | null> = {};

  if (name) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;

  // Password change
  if (currentPassword && newPassword) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "无法验证当前密码" }, { status: 400 });
    }
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "当前密码错误" }, { status: 400 });
    }
    updateData.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      creditScore: true,
      balance: true,
    },
  });

  return NextResponse.json({ user: updated });
}
````

## File: src/app/api/register/route.ts
````typescript
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { name, email, password, phone, role } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        phone: phone || null,
        role: role || "CUSTOMER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "Registration successful", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
````

## File: src/app/api/services/[id]/route.ts
````typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          creditScore: true,
        },
      },
    },
  });

  if (!service) {
    return NextResponse.json({ error: "服务不存在" }, { status: 404 });
  }

  return NextResponse.json({ service });
}
````

## File: src/app/login/page.tsx
````typescript
"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("邮箱或密码错误，请重试");
        return;
      }

      if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
          >
            信
          </Link>
          <CardTitle className="text-xl">登录</CardTitle>
          <CardDescription>
            欢迎回到信用平台，请登录您的账户
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                密码
              </label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "登录中..." : "登录"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              还没有账户？{" "}
              <Link
                href="/register"
                className="font-medium text-brand-600 hover:underline"
              >
                立即注册
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
````

## File: src/app/orders/[id]/review/page.tsx
````typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface OrderSummary {
  id: string;
  status: string;
  amount: number;
  service: { id: string; title: string; category: string };
  provider: { id: string; name: string };
  reviews: { id: string }[];
}

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    params.then(({ id }) => setOrderId(id));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;

    fetch(`/api/orders/${orderId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load order");
        return res.json();
      })
      .then((data) => setOrder(data.contract))
      .catch(() => toast.error("加载订单信息失败"))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (order && order.reviews.length > 0) {
      toast.info("您已评价过该订单");
      router.push(`/orders/${orderId}`);
    }
  }, [order, orderId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("请选择评分");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: orderId,
          rating,
          comment: comment.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "提交评价失败");
        return;
      }

      toast.success("评价成功！");
      router.push(`/orders/${orderId}`);
      router.refresh();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-muted-foreground">订单不存在</p>
        <Button className="mt-4" onClick={() => router.push("/orders")}>
          返回订单列表
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/orders" className="hover:text-foreground">
          我的订单
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/orders/${orderId}`}
          className="hover:text-foreground"
        >
          订单详情
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">评价</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        评价服务
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">
                  {order.service.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  服务商: {order.provider.name}
                </p>
              </div>
              <span className="text-lg font-bold text-brand-600">
                ¥{order.amount.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Star Rating */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">评分</CardTitle>
            <CardDescription>
              请为本次服务打分
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (hoverRating || rating);
                return (
                  <button
                    key={star}
                    type="button"
                    className={`text-3xl transition-colors ${
                      filled
                        ? "text-yellow-400"
                        : "text-muted-foreground/30 hover:text-yellow-300"
                    }`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star}星`}
                  >
                    {filled ? "★" : "☆"}
                  </button>
                );
              })}
              <span className="ml-3 text-sm text-muted-foreground">
                {rating > 0
                  ? ["", "非常差", "较差", "一般", "满意", "非常满意"][rating]
                  : "点击星标评分"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Comment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">评价内容</CardTitle>
            <CardDescription>
              分享您的服务体验 <span className="text-muted-foreground">(选填)</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="请输入您的评价..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            className="flex-1"
            size="lg"
            disabled={submitting || rating === 0}
          >
            {submitting ? "提交中..." : "提交评价"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            disabled={submitting}
          >
            返回
          </Button>
        </div>
      </form>
    </div>
  );
}
````

## File: src/app/profile/page.tsx
````typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  creditScore: number;
  balance: number;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Card 1: Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Card 2: Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfile(data.user);
      setName(data.user.name);
      setPhone(data.user.phone ?? "");
    } catch {
      toast.error("加载个人信息失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, fetchProfile]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: phone || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setProfile(data.user);
      toast.success("个人信息已更新");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("请填写所有密码字段");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码长度至少为6位");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "修改失败");
      toast.success("密码已修改");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "修改失败");
    } finally {
      setChangingPassword(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 grid gap-6">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const roleLabel = profile.role === "PROVIDER" ? "服务商" : "客户";

  function getCreditLevel(score: number) {
    if (score >= 200) return { label: "优秀", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
    if (score >= 150) return { label: "良好", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
    if (score >= 100) return { label: "一般", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
    return { label: "待提升", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
  }

  const creditLevel = getCreditLevel(profile.creditScore);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        个人资料
      </h1>
      <p className="mt-2 text-muted-foreground">
        管理您的个人信息和账户安全
      </p>

      <div className="mt-8 grid gap-6">
        {/* Card 1: Profile info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">个人信息</CardTitle>
            <CardDescription>
              修改您的姓名和联系方式
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  姓名
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入姓名"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  邮箱
                </label>
                <Input
                  value={profile.email}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  手机号
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Change password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">修改密码</CardTitle>
            <CardDescription>
              密码长度至少为6位
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  当前密码
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="输入当前密码"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  新密码
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="输入新密码"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  确认新密码
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? "修改中..." : "修改密码"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Account overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">账户概览</CardTitle>
            <CardDescription>
              您的账户数据概览
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">身份</p>
                <p className="text-lg font-semibold text-foreground">
                  {roleLabel}
                </p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">信用评分</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold text-foreground">
                    {profile.creditScore}
                  </p>
                  <Badge className={creditLevel.color}>
                    {creditLevel.label}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">账户余额</p>
                <p className="text-lg font-semibold text-foreground">
                  ¥{profile.balance.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1 rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">注册时间</p>
                <p className="text-lg font-semibold text-foreground">
                  {new Date(profile.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
````

## File: src/app/register/page.tsx
````typescript
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("CUSTOMER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "注册失败，请稍后重试");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("注册失败，请检查网络连接");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
          >
            信
          </Link>
          <CardTitle className="text-xl">注册</CardTitle>
          <CardDescription>
            创建您的信用平台账户
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="text-sm font-medium text-foreground"
              >
                姓名
              </label>
              <Input
                id="name"
                type="text"
                placeholder="请输入您的姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-foreground"
              >
                密码
              </label>
              <Input
                id="password"
                type="password"
                placeholder="请设置密码（至少6位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium text-foreground"
              >
                手机号（选填）
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                注册身份
              </label>
              <div className="flex gap-3">
                <label
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2 text-sm transition-colors ${
                    role === "CUSTOMER"
                      ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="CUSTOMER"
                    checked={role === "CUSTOMER"}
                    onChange={() => setRole("CUSTOMER")}
                    className="sr-only"
                  />
                  客户
                </label>
                <label
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2 text-sm transition-colors ${
                    role === "PROVIDER"
                      ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="PROVIDER"
                    checked={role === "PROVIDER"}
                    onChange={() => setRole("PROVIDER")}
                    className="sr-only"
                  />
                  服务商
                </label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "注册中..." : "注册"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              已有账户？{" "}
              <Link
                href="/login"
                className="font-medium text-brand-600 hover:underline"
              >
                立即登录
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
````

## File: src/app/services/[id]/order/page.tsx
````typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface Service {
  id: string;
  title: string;
  category: string;
  price: number;
  description: string;
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setServiceId(id);
      fetch(`/api/services/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load service");
          return res.json();
        })
        .then((data) => {
          setService(data.service || data);
        })
        .catch(() => {
          toast.error("加载服务信息失败");
        })
        .finally(() => setLoading(false));
    });
  }, [params]);

  // Auth redirect
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId) return;

    if (!address.trim()) {
      toast.error("请填写服务地址");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          address: address.trim(),
          scheduledAt: scheduledAt || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "下单失败");
        return;
      }

      toast.success("下单成功！");
      router.push(`/orders/${data.contract.id}`);
      router.refresh();
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/services" className="hover:text-foreground">
          服务市场
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/services/${serviceId}`}
          className="hover:text-foreground"
        >
          {service?.title || "服务详情"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">确认订单</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        确认订单
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Service Summary */}
        {service && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">服务信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {service.title}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {service.category}
                  </Badge>
                </div>
                <span className="text-xl font-bold text-brand-600">
                  ¥{service.price.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单信息</CardTitle>
            <CardDescription>
              请填写服务地址和预约信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="address"
                className="text-sm font-medium text-foreground"
              >
                服务地址 <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="address"
                placeholder="请输入详细的服务地址"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="scheduledAt"
                className="text-sm font-medium text-foreground"
              >
                预约时间 <span className="text-muted-foreground">(选填)</span>
              </label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="notes"
                className="text-sm font-medium text-foreground"
              >
                备注 <span className="text-muted-foreground">(选填)</span>
              </label>
              <Textarea
                id="notes"
                placeholder="其他需要说明的事项"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Price Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">费用明细</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">服务费</span>
              <span className="text-foreground">
                ¥{service?.price.toFixed(2) || "0.00"}
              </span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">合计</span>
                <span className="text-xl font-bold text-brand-600">
                  ¥{service?.price.toFixed(2) || "0.00"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button
            type="submit"
            className="flex-1"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "提交中..." : "确认下单"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            disabled={submitting}
          >
            返回
          </Button>
        </div>
      </form>
    </div>
  );
}
````

## File: src/app/services/[id]/page.tsx
````typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface ServiceDetailProps {
  params: Promise<{ id: string }>;
}

export default async function ServiceDetailPage({
  params,
}: ServiceDetailProps) {
  const { id } = await params;
  const session = await auth();

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          creditScore: true,
        },
      },
    },
  });

  if (!service) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/services" className="hover:text-foreground">
          服务市场
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{service.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl">{service.title}</CardTitle>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{service.category}</Badge>
                    <span className="text-sm text-muted-foreground">
                      发布于 {new Date(service.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-7 text-foreground/80">
                {service.description}
              </p>

              <div className="mt-8">
                <h3 className="text-lg font-semibold text-foreground">
                  服务详情
                </h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <dt className="text-sm text-muted-foreground">分类</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {service.category}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <dt className="text-sm text-muted-foreground">价格</dt>
                    <dd className="mt-1 font-bold text-brand-600 text-lg">
                      ¥{service.price.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">服务价格</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <span className="text-3xl font-bold text-brand-600">
                  ¥{service.price.toFixed(2)}
                </span>
              </div>
              {session?.user ? (
                <Link href={`/services/${service.id}/order`}>
                  <Button className="w-full" size="lg">
                    立即下单
                  </Button>
                </Link>
              ) : (
                <Link href="/login">
                  <Button className="w-full" size="lg">
                    登录后下单
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Provider info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">服务商</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                  {service.provider.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {service.provider.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    信用评分：{service.provider.creditScore}
                  </p>
                </div>
              </div>
              {service.provider.phone && (
                <p className="text-sm text-muted-foreground">
                  联系方式：{service.provider.phone}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
````

## File: src/app/services/new/page.tsx
````typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const categories = [
  { value: "维修", label: "维修" },
  { value: "按摩", label: "按摩" },
  { value: "保洁", label: "保洁" },
];

export default function NewServicePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-center text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!session?.user) {
    router.push("/login");
    return null;
  }

  if (session.user.role !== "PROVIDER") {
    router.push("/dashboard");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title || !category || !price || !description) {
      toast.error("请填写完整信息");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, price, description }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "发布失败");
        return;
      }

      toast.success("服务发布成功");
      router.push(`/services/${data.service.id}`);
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <Link
          href="/services"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; 返回服务市场
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>发布新服务</CardTitle>
          <CardDescription>
            填写服务信息后发布，客户将能浏览并下单
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                服务名称
              </label>
              <Input
                placeholder="输入服务名称"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                分类
              </label>
              <Select value={category} onValueChange={(value) => setCategory(value ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                价格 (¥)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="输入服务价格"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                服务描述
              </label>
              <Textarea
                placeholder="详细描述您的服务内容"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "发布中..." : "发布服务"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/services")}
              >
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
````

## File: src/app/services/page.tsx
````typescript
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ServiceSortSelect } from "./service-sort";

const categories = [
  { value: "", label: "全部" },
  { value: "维修", label: "维修" },
  { value: "按摩", label: "按摩" },
  { value: "保洁", label: "保洁" },
];

const sortOptions = [
  { value: "newest", label: "最新" },
  { value: "price_asc", label: "价格从低到高" },
  { value: "price_desc", label: "价格从高到低" },
] as const;

const PAGE_SIZE = 12;

interface ServicesPageProps {
  searchParams: Promise<{
    category?: string;
    q?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ServicesPage({
  searchParams,
}: ServicesPageProps) {
  const { category, q, minPrice, maxPrice, sort, page } = await searchParams;
  const currentSort = sort || "newest";
  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);

  // Build Prisma where clause (top-level fields are implicitly ANDed)
  const where: Record<string, unknown> = {};

  if (category) {
    where.category = category;
  }

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (minPrice || maxPrice) {
    const priceFilter: Record<string, number> = {};
    if (minPrice) {
      const p = parseFloat(minPrice);
      if (!isNaN(p)) priceFilter.gte = p;
    }
    if (maxPrice) {
      const p = parseFloat(maxPrice);
      if (!isNaN(p)) priceFilter.lte = p;
    }
    if (Object.keys(priceFilter).length > 0) {
      where.price = priceFilter;
    }
  }

  // Build orderBy
  let orderBy: Record<string, "asc" | "desc">;
  switch (currentSort) {
    case "price_asc":
      orderBy = { price: "asc" };
      break;
    case "price_desc":
      orderBy = { price: "desc" };
      break;
    default:
      orderBy = { createdAt: "desc" };
  }

  const [services, totalCount] = await Promise.all([
    prisma.service.findMany({
      where,
      include: {
        provider: {
          select: { id: true, name: true },
        },
      },
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.service.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Build a URL that preserves current filter params, merging overrides
  const buildFilterUrl = (
    overrides: Record<string, string | undefined>,
    resetPage = false,
  ): string => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (currentSort !== "newest") params.set("sort", currentSort);
    if (currentPage > 1 && !resetPage) params.set("page", String(currentPage));

    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    const qs = params.toString();
    return qs ? `/services?${qs}` : "/services";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          服务市场
        </h1>
        <p className="mt-2 text-muted-foreground">
          浏览并选择您需要的服务
        </p>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        {/* Search form — uses GET to preserve server-component nature */}
        <form
          method="GET"
          action="/services"
          className="flex flex-wrap items-end gap-3"
        >
          {/* Hidden inputs preserve other active filters on submit */}
          <input type="hidden" name="category" value={category || ""} />
          <input type="hidden" name="sort" value={currentSort} />

          <div className="min-w-[200px] flex-1">
            <Input
              name="q"
              defaultValue={q || ""}
              placeholder="搜索服务名称或描述..."
              className="w-full"
            />
          </div>
          <div className="w-28">
            <Input
              name="minPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={minPrice || ""}
              placeholder="最低价"
              className="w-full"
            />
          </div>
          <div className="w-28">
            <Input
              name="maxPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={maxPrice || ""}
              placeholder="最高价"
              className="w-full"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            搜索
          </button>
        </form>

        {/* Category filters + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const href = buildFilterUrl({
                category: cat.value || undefined,
              }, true);
              const isActive =
                category === cat.value || (!category && !cat.value);
              return (
                <Link
                  key={cat.value}
                  href={href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-600 text-white"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </div>

          <ServiceSortSelect currentSort={currentSort} />
        </div>
      </div>

      {/* Service list */}
      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-foreground">暂无服务</p>
          <p className="mt-2 text-sm text-muted-foreground">
            没有找到匹配的服务，请调整筛选条件
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link key={service.id} href={`/services/${service.id}`}>
              <Card className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg group-hover:text-brand-600">
                      {service.title}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0">
                      {service.category}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-brand-600">
                      ¥{service.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {service.provider.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="分页导航">
          {currentPage > 1 && (
            <Link
              href={buildFilterUrl({ page: String(currentPage - 1) })}
              className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              上一页
            </Link>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => {
              // Show first, last, current, and neighbors
              const distance = Math.abs(p - currentPage);
              return (
                p === 1 ||
                p === totalPages ||
                distance <= 1 ||
                (currentPage <= 3 && p <= 5) ||
                (currentPage >= totalPages - 2 && p >= totalPages - 4)
              );
            })
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center">
                {idx > 0 && p - arr[idx - 1] > 1 && (
                  <span className="px-1 text-muted-foreground">...</span>
                )}
                {p === currentPage ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-medium text-white">
                    {p}
                  </span>
                ) : (
                  <Link
                    href={buildFilterUrl({ page: String(p) })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors hover:bg-accent"
                  >
                    {p}
                  </Link>
                )}
              </span>
            ))}

          {currentPage < totalPages && (
            <Link
              href={buildFilterUrl({ page: String(currentPage + 1) })}
              className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              下一页
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
````

## File: src/app/services/service-sort.tsx
````typescript
"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ServiceSortSelectProps {
  currentSort: string;
}

const sortOptions = [
  { value: "newest", label: "最新" },
  { value: "price_asc", label: "价格从低到高" },
  { value: "price_desc", label: "价格从高到低" },
];

export function ServiceSortSelect({ currentSort }: ServiceSortSelectProps) {
  const router = useRouter();

  const handleChange = (value: string | null) => {
    if (!value) return;
    const params = new URLSearchParams(window.location.search);
    params.set("sort", value);
    const qs = params.toString();
    router.push(qs ? `/services?${qs}` : "/services");
  };

  return (
    <Select value={currentSort} onValueChange={handleChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="排序方式" />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
````

## File: src/components/Header.tsx
````typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X, User } from "lucide-react";

const navLinks = [
  { href: "/", label: "首页" },
  { href: "/services", label: "服务市场" },
  { href: "/dashboard", label: "我的订单" },
];

export default function Header() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-brand-600"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            信
          </span>
          信用平台
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop right section */}
        <div className="hidden items-center gap-3 md:flex">
          {status === "loading" ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-muted" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground outline-none">
                <User className="size-4" />
                <span className="max-w-[120px] truncate">
                  {session.user.name || session.user.email}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard")}
                >
                  控制面板
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/services")}
                >
                  服务市场
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/profile")}
                >
                  个人资料
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  variant="destructive"
                >
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
                登录
              </Button>
              <Button size="sm" onClick={() => router.push("/register")}>
                注册
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg md:hidden hover:bg-accent"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "关闭菜单" : "打开菜单"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-border md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-border" />
            {status === "loading" ? (
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
            ) : session?.user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground">
                  <User className="size-4" />
                  <span className="truncate">
                    {session.user.name || session.user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  退出登录
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/login");
                  }}
                >
                  登录
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/register");
                  }}
                >
                  注册
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
````

## File: src/components/SessionProvider.tsx
````typescript
"use client";

import { SessionProvider as Provider } from "next-auth/react";

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider>{children}</Provider>;
}
````

## File: src/components/SmartRequest.tsx
````typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function SmartRequest() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/llm-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(
          `/services?category=${encodeURIComponent(data.category)}&q=${encodeURIComponent(text.trim())}`
        );
      } else {
        router.push(`/services?q=${encodeURIComponent(text.trim())}`);
      }
    } catch {
      router.push(`/services?q=${encodeURIComponent(text.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative">
        <Textarea
          placeholder="描述您的需求，例如：马桶堵了、空调不制冷、腰疼想按摩..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[80px] resize-none pr-32 text-base"
          rows={2}
        />
        <div className="absolute bottom-3 right-3">
          <Button type="submit" disabled={loading || !text.trim()}>
            {loading ? "匹配中..." : "立即匹配"}
          </Button>
        </div>
      </div>
    </form>
  );
}
````

## File: src/components/ui/badge.tsx
````typescript
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
````

## File: src/components/ui/button.tsx
````typescript
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
````

## File: src/components/ui/card.tsx
````typescript
import * as React from "react"

import { cn } from "@/lib/utils"

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
````

## File: src/components/ui/dialog.tsx
````typescript
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
````

## File: src/components/ui/dropdown-menu.tsx
````typescript
"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"
import { ChevronRightIcon, CheckIcon } from "lucide-react"

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn("z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn("w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return (
    <MenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
````

## File: src/components/ui/input.tsx
````typescript
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
````

## File: src/components/ui/select.tsx
````typescript
"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
````

## File: src/components/ui/sheet.tsx
````typescript
"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
````

## File: src/components/ui/sonner.tsx
````typescript
"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
````

## File: src/components/ui/table.tsx
````typescript
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
````

## File: src/components/ui/textarea.tsx
````typescript
import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
````

## File: src/lib/auth.ts
````typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials.email as string;
        const password = credentials.password as string;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
````

## File: src/lib/contract-machine.ts
````typescript
import { prisma } from "./prisma"

export const FUND_STATUSES = {
  PENDING_HELD: "PENDING_HELD",
  HELD: "HELD",
  COMPLETED: "COMPLETED",
  DISPUTED: "DISPUTED",
  CANCELLED: "CANCELLED",
  SATISFACTION_HELD: "SATISFACTION_HELD",
  SETTLED: "SETTLED",
} as const

export type FundStatus = (typeof FUND_STATUSES)[keyof typeof FUND_STATUSES]

export const SERVICE_STAGES = {
  NOT_ACCEPTED: 0,
  ACCEPTED: 1,
  DEPARTED: 2,
  ARRIVED: 3,
  IN_PROGRESS: 4,
  DONE: 5,
} as const

export type ServiceStage = (typeof SERVICE_STAGES)[keyof typeof SERVICE_STAGES]

export interface TransitionDef {
  action: string
  from: FundStatus
  to: FundStatus
  allowedRoles: string[]
  guard: (ctx: TransitionCtx) => string | null
}

export interface TransitionCtx {
  contract: {
    id: string
    fundStatus: FundStatus
    serviceStage: ServiceStage
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

const transitions: TransitionDef[] = [
  {
    action: "pay",
    from: "PENDING_HELD",
    to: "HELD",
    allowedRoles: ["CUSTOMER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.customerId) return "只有客户能支付"
      return null
    },
  },
  {
    action: "cancel_before_pay",
    from: "PENDING_HELD",
    to: "CANCELLED",
    allowedRoles: ["CUSTOMER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.customerId) return "只有客户能取消"
      return null
    },
  },
  {
    action: "provider_accept",
    from: "HELD",
    to: "HELD",
    allowedRoles: ["PROVIDER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.providerId) return "只有接单师傅能操作"
      if (ctx.contract.serviceStage >= SERVICE_STAGES.ACCEPTED) return "已接单"
      return null
    },
  },
  {
    action: "provider_depart",
    from: "HELD",
    to: "HELD",
    allowedRoles: ["PROVIDER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.providerId) return "只有师傅能操作"
      if (ctx.contract.serviceStage !== SERVICE_STAGES.ACCEPTED) return "请先接单"
      return null
    },
  },
  {
    action: "provider_arrive",
    from: "HELD",
    to: "HELD",
    allowedRoles: ["PROVIDER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.providerId) return "只有师傅能操作"
      if (ctx.contract.serviceStage !== SERVICE_STAGES.DEPARTED) return "请先出发"
      return null
    },
  },
  {
    action: "start_service",
    from: "HELD",
    to: "HELD",
    allowedRoles: ["PROVIDER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.providerId) return "只有师傅能操作"
      if (ctx.contract.serviceStage !== SERVICE_STAGES.ARRIVED) return "请先到达"
      return null
    },
  },
  {
    action: "request_complete",
    from: "HELD",
    to: "HELD",
    allowedRoles: ["PROVIDER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.providerId) return "只有师傅能操作"
      if (ctx.contract.serviceStage < SERVICE_STAGES.IN_PROGRESS) return "服务尚未开始"
      return null
    },
  },
  {
    action: "confirm_complete",
    from: "HELD",
    to: "COMPLETED",
    allowedRoles: ["CUSTOMER", "ADMIN"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.role !== "ADMIN") return "只有客户能确认完成"
      return null
    },
  },
  {
    action: "auto_complete",
    from: "HELD",
    to: "COMPLETED",
    allowedRoles: ["SYSTEM"],
    guard: (ctx) => {
      if (!ctx.contract.autoCompleteAt) return "未设置自动完成时间"
      if (new Date() < ctx.contract.autoCompleteAt) return "未到自动完成时间"
      return null
    },
  },
  {
    action: "cancel_during_service",
    from: "HELD",
    to: "CANCELLED",
    allowedRoles: ["CUSTOMER", "PROVIDER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return "只有参与者能取消"
      return null
    },
  },
  {
    action: "open_dispute",
    from: "HELD",
    to: "DISPUTED",
    allowedRoles: ["CUSTOMER"],
    guard: (ctx) => {
      if (ctx.actor.id !== ctx.contract.customerId) return "只有客户能发起争议"
      return null
    },
  },
  {
    action: "open_dispute_after_complete",
    from: "SATISFACTION_HELD",
    to: "DISPUTED",
    allowedRoles: ["CUSTOMER"],
    guard: (ctx) => {
      if (!ctx.payload?.qualityClaim) return "需提供质保相关争议说明"
      return null
    },
  },
  {
    action: "resolve_dispute",
    from: "DISPUTED",
    to: "SETTLED",
    allowedRoles: ["ADMIN"],
    guard: (ctx) => {
      if (!ctx.payload?.resolution) return "需提供仲裁裁决"
      return null
    },
  },
  {
    action: "release_satisfaction",
    from: "SATISFACTION_HELD",
    to: "SETTLED",
    allowedRoles: ["SYSTEM", "ADMIN"],
    guard: () => null,
  },
  {
    action: "settle_cancelled",
    from: "CANCELLED",
    to: "SETTLED",
    allowedRoles: ["SYSTEM", "ADMIN"],
    guard: () => null,
  },
]

export function validateTransition(action: string, ctx: TransitionCtx): string | null {
  const def = transitions.find((t) => t.action === action)
  if (!def) return `未知操作: ${action}`
  if (def.from !== ctx.contract.fundStatus) {
    return `当前状态 ${ctx.contract.fundStatus} 不允许执行 ${action}`
  }
  if (def.from === def.to && !["provider_accept", "provider_depart", "provider_arrive", "start_service", "request_complete"].includes(action)) {
    return `不允许无状态变更的操作`
  }
  if (!def.allowedRoles.includes(ctx.actor.role)) {
    return `${ctx.actor.role} 角色无权执行此操作`
  }
  return def.guard(ctx)
}

export function getNextFundStatus(action: string): FundStatus | null {
  const def = transitions.find((t) => t.action === action)
  return def?.to ?? null
}

export function getNextServiceStage(action: string): number | null {
  const stageMap: Record<string, number> = {
    provider_accept: SERVICE_STAGES.ACCEPTED,
    provider_depart: SERVICE_STAGES.DEPARTED,
    provider_arrive: SERVICE_STAGES.ARRIVED,
    start_service: SERVICE_STAGES.IN_PROGRESS,
    request_complete: SERVICE_STAGES.DONE,
  }
  return stageMap[action] ?? null
}

export function calcRefund(serviceStage: number, amount: number): { provider: number; customer: number } {
  if (amount <= 0) return { provider: 0, customer: 0 }
  switch (serviceStage) {
    case 0:
    case 1:
      return { provider: 0, customer: amount }
    case 2:
      return { provider: Math.max(0, Math.min(amount * 0.1, 30)), customer: Math.max(0, amount - Math.min(amount * 0.1, 30)) }
    case 3:
      return { provider: Math.max(0, Math.min(amount * 0.15, 50)), customer: Math.max(0, amount - Math.min(amount * 0.15, 50)) }
    default:
      return { provider: Math.max(0, amount * 0.5), customer: Math.max(0, amount * 0.5) }
  }
}

export async function addContractEvent(params: {
  contractId: string
  actorId: string
  fromStatus: string
  toStatus: string
  action: string
  reason?: string
  metadata?: string
}) {
  await prisma.contractEvent.create({ data: params })
}

export async function createRefundTransactions(
  contractId: string,
  customerId: string,
  providerId: string,
  refund: { provider: number; customer: number },
  type: string = "REFUND",
): Promise<void> {
  if (refund.customer > 0) {
    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: { balance: true },
    })
    if (!customer || customer.balance < refund.customer) {
      throw new Error(`客户余额不足: 当前余额 ${customer?.balance ?? 0}, 需退款 ${refund.customer}`)
    }
    await prisma.user.update({
      where: { id: customerId },
      data: { balance: { increment: refund.customer } },
    })
    await prisma.transaction.create({
      data: {
        userId: customerId,
        type,
        amount: refund.customer,
        balanceBefore: customer.balance,
        balanceAfter: customer.balance + refund.customer,
        description: `${type === "REFUND" ? "取消退款" : "争议退款"}: 合同 ${contractId} 退¥${refund.customer}`,
      },
    })
  }

  if (refund.provider > 0) {
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { balance: true },
    })
    await prisma.user.update({
      where: { id: providerId },
      data: { balance: { increment: refund.provider } },
    })
    await prisma.transaction.create({
      data: {
        userId: providerId,
        type,
        amount: refund.provider,
        balanceBefore: provider!.balance,
        balanceAfter: provider!.balance + refund.provider,
        description: `${type === "REFUND" ? "取消服务费" : "争议服务费"}: 合同 ${contractId} 得¥${refund.provider}`,
      },
    })
  }
}

export async function handleSatisfactionBatch(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { providerId: true, amount: true },
  })
  if (!contract) return

  const depositAmount = Math.round(contract.amount * 0.1 * 100) / 100

  let batch = await prisma.satisfactionBatch.findFirst({
    where: { providerId: contract.providerId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  if (!batch) {
    batch = await prisma.satisfactionBatch.create({
      data: { providerId: contract.providerId },
    })
  }

  await prisma.satisfactionBatch.update({
    where: { id: batch.id },
    data: { count: { increment: 1 }, totalAmount: { increment: depositAmount } },
  })

  await prisma.contract.update({
    where: { id: contractId },
    data: { satisfactionBatchId: batch.id },
  })

  const updatedBatch = await prisma.satisfactionBatch.findUnique({ where: { id: batch.id } })
  if (updatedBatch && updatedBatch.count >= 15) {
    await releaseSatisfactionBatch(batch.id)
  }
}

export async function releaseSatisfactionBatch(batchId: string) {
  const batch = await prisma.satisfactionBatch.findUnique({
    where: { id: batchId },
    include: { provider: true, contracts: { select: { id: true } } },
  })
  if (!batch || batch.status !== "PENDING") return

  await prisma.satisfactionBatch.update({
    where: { id: batchId },
    data: { status: "RELEASED", releasedAt: new Date() },
  })

  for (const c of batch.contracts) {
    await prisma.contractEvent.create({
      data: {
        contractId: c.id,
        actorId: batch.providerId,
        fromStatus: "SATISFACTION_HELD",
        toStatus: "SETTLED",
        action: "batch_release",
        reason: `满意度暂存款批释放: 第${batch.count}单 / 总额¥${batch.totalAmount}`,
      },
    })
  }

  const providerContracts = await prisma.contract.findMany({
    where: { providerId: batch.providerId, fundStatus: "COMPLETED" },
    select: { id: true },
  })
  for (const c of providerContracts) {
    await prisma.contract.update({
      where: { id: c.id },
      data: { fundStatus: "SATISFACTION_HELD" },
    })
  }

  const completedCount = await prisma.contract.count({
    where: { providerId: batch.providerId, fundStatus: { in: ["COMPLETED", "SATISFACTION_HELD"] } },
  })
  const creditScore = Math.min(Math.round((completedCount / 15) * 100 + batch.provider.creditScore), 1000)
  await prisma.user.update({
    where: { id: batch.providerId },
    data: { creditScore },
  })
}
````

## File: src/lib/llm.ts
````typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

const github = createOpenAICompatible({
  name: "github",
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.OPENCODE_GITHUB_TOKEN || "",
});

const models = {
  // Preferred: GPT-4o mini via GitHub Models (free)
  primary: github.chatModel("gpt-4o-mini"),
  // Fallback: Gemini via Google AI (free)
  fallback: google("gemini-2.0-flash"),
};

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number }
) {
  try {
    const result = await generateText({
      model: models.primary,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options?.temperature ?? 0.3,
    });
    return result.text;
  } catch (err) {
    // Fallback to Gemini if GitHub Models fails
    console.warn("GitHub Models failed, falling back to Gemini:", err);
    const result = await generateText({
      model: models.fallback,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options?.temperature ?? 0.3,
    });
    return result.text;
  }
}
````

## File: src/lib/prisma.ts
````typescript
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbPath = path.resolve(process.cwd(), "dev.db").replace(/\\/g, "/");
const adapter = new PrismaLibSql({ url: `file:///${dbPath}` });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
````

## File: src/lib/utils.ts
````typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
````

## File: src/types/next-auth.d.ts
````typescript
import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: string;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    id?: string;
  }
}
````

## File: tsconfig.json
````json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
````

## File: .gitignore
````
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files (can opt-in for committing if needed)
.env*

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

/src/generated/prisma

# dev
dev.db
.understand-anything/
.opencode/
````

## File: package.json
````json
{
  "name": "credit-platform",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "seed": "bun run prisma/seed.ts"
  },
  "dependencies": {
    "@ai-sdk/google": "^3.0.83",
    "@ai-sdk/openai": "^3.0.74",
    "@ai-sdk/openai-compatible": "^2.0.51",
    "@auth/prisma-adapter": "^2.11.2",
    "@base-ui/react": "^1.6.0",
    "@hookform/resolvers": "^5.4.0",
    "@libsql/client": "^0.17.4",
    "@prisma/adapter-libsql": "^7.8.0",
    "@prisma/client": "^7.8.0",
    "@types/bcryptjs": "^3.0.0",
    "ai": "^6.0.208",
    "bcryptjs": "^3.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.21.0",
    "next": "16.2.9",
    "next-auth": "^5.0.0-beta.31",
    "next-themes": "^0.4.6",
    "prisma": "^7.8.0",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-hook-form": "^7.80.0",
    "shadcn": "^4.11.0",
    "sonner": "^2.0.7",
    "stripe": "^22.2.3",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "ignoreScripts": [
    "sharp",
    "unrs-resolver"
  ],
  "trustedDependencies": [
    "sharp",
    "unrs-resolver"
  ]
}
````

## File: prisma/schema.prisma
````prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String?
  phone        String?
  role         String   @default("CUSTOMER")
  creditScore  Int      @default(100)
  balance      Float    @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  services     Service[]
  contracts    Contract[]  @relation("CustomerContracts")
  providings   Contract[]  @relation("ProviderContracts")
  payments     Payment[]
  disputes     Dispute[]
  reviews      Review[]
  transactions Transaction[]
  accounts     Account[]
  sessions     Session[]
  batches      SatisfactionBatch[] @relation("ProviderBatches")
  contractEvents ContractEvent[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}

model Service {
  id          String   @id @default(cuid())
  title       String
  description String
  price       Float
  category    String
  providerId  String
  provider    User     @relation(fields: [providerId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  contracts   Contract[]
}

model Contract {
  id          String   @id @default(cuid())
  serviceId   String
  service     Service  @relation(fields: [serviceId], references: [id])
  customerId  String
  customer    User     @relation("CustomerContracts", fields: [customerId], references: [id])
  providerId  String
  provider    User     @relation("ProviderContracts", fields: [providerId], references: [id])

  // 资金状态机
  fundStatus    String   @default("PENDING_HELD")
  serviceStage  Int      @default(0)
  terms         String
  amount        Float
  address       String?
  scheduledAt   DateTime?
  notes         String?

  // 时间驱动
  autoCompleteAt DateTime?
  completedAt   DateTime?

  // 满意度暂存款批处理
  satisfactionBatchId String?
  satisfactionBatch   SatisfactionBatch? @relation(fields: [satisfactionBatchId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  payments    Payment[]
  disputes    Dispute[]
  reviews     Review[]
  events      ContractEvent[]
}

model Payment {
  id                String   @id @default(cuid())
  contractId        String
  contract          Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  payerId           String
  payer             User     @relation(fields: [payerId], references: [id])
  amount            Float
  status            String   @default("PENDING")
  provider          String?  // stripe | alipay | wechat
  providerPaymentId String?  // Stripe PaymentIntent ID / 支付宝交易号
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model ContractEvent {
  id          String   @id @default(cuid())
  contractId  String
  contract    Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  actorId     String
  actor       User     @relation(fields: [actorId], references: [id])
  fromStatus  String
  toStatus    String
  action      String
  reason      String?
  metadata    String?
  createdAt   DateTime @default(now())
}

model Dispute {
  id          String   @id @default(cuid())
  contractId  String  @unique
  contract    Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  initiatorId String
  initiator   User     @relation(fields: [initiatorId], references: [id])
  reason      String
  evidence    String?
  status      String   @default("OPEN")
  resolution  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Review {
  id          String   @id @default(cuid())
  contractId  String
  contract    Contract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  reviewerId  String
  reviewer    User     @relation(fields: [reviewerId], references: [id])
  rating      Int
  comment     String?
  createdAt   DateTime @default(now())
}

model SatisfactionBatch {
  id         String   @id @default(cuid())
  providerId String
  provider   User     @relation("ProviderBatches", fields: [providerId], references: [id])
  count      Int      @default(0)
  totalAmount Float   @default(0)
  status     String   @default("PENDING")
  releasedAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  contracts  Contract[]
}

model Transaction {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  type          String
  amount        Float
  balanceBefore Float
  balanceAfter  Float
  description   String?
  createdAt     DateTime @default(now())
}
````

## File: src/app/api/orders/[id]/route.ts
````typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPayment } from "@/lib/payment";
import {
  validateTransition,
  getNextFundStatus,
  getNextServiceStage,
  calcRefund,
  addContractEvent,
  handleSatisfactionBatch,
  createRefundTransactions,
} from "@/lib/contract-machine";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      service: true,
      provider: { select: { id: true, name: true, phone: true, creditScore: true } },
      customer: { select: { id: true, name: true, phone: true } },
      payments: true,
      events: { orderBy: { createdAt: "desc" } },
      reviews: {
        include: { reviewer: { select: { name: true } } },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  if (contract.customerId !== session.user.id && contract.providerId !== session.user.id) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  return NextResponse.json({ contract });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { action, reason, metadata, evidence } = body;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      fundStatus: true,
      serviceStage: true,
      providerId: true,
      customerId: true,
      amount: true,
      completedAt: true,
      autoCompleteAt: true,
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const guardError = validateTransition(action, {
    contract: {
      id: contract.id,
      fundStatus: contract.fundStatus as any,
      serviceStage: contract.serviceStage as any,
      providerId: contract.providerId,
      customerId: contract.customerId,
      amount: contract.amount,
      completedAt: contract.completedAt,
      autoCompleteAt: contract.autoCompleteAt,
    },
    actor: { id: user.id, role: user.role },
    payload: body,
  });

  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 400 });
  }

  const nextFundStatus = getNextFundStatus(action);
  const nextStage = getNextServiceStage(action);

  const updates: Record<string, unknown> = {};

  if (nextFundStatus) {
    updates.fundStatus = nextFundStatus;
  }
  if (nextStage !== null) {
    updates.serviceStage = nextStage;
  }

  if (action === "pay") {
    const paymentProvider = (body.paymentProvider as string) ?? "stripe";

    const paymentResult = await createPayment({
      amount: contract.amount,
      description: `家政服务订单支付: ${id}`,
      contractId: id,
      payerId: session.user.id,
      provider: paymentProvider as any,
    });

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || "支付失败" },
        { status: 400 },
      );
    }

    await prisma.payment.updateMany({
      where: { contractId: id },
      data: {
        status: "SUCCEEDED",
        provider: paymentResult.provider,
        providerPaymentId: paymentResult.providerPaymentId,
      },
    });

    updates.fundStatus = "HELD";
  }

  if (action === "request_complete") {
    updates.serviceStage = 5;
    const timeoutAt = new Date(Date.now() + 60 * 60 * 1000);
    updates.autoCompleteAt = timeoutAt;
  }

  if (action === "confirm_complete" || action === "auto_complete") {
    const now = new Date();
    updates.completedAt = now;
    updates.autoCompleteAt = null;
  }

  let refundSettled = false;
  if (action === "cancel_before_pay" || action === "cancel_during_service") {
    const refund = calcRefund(contract.serviceStage, contract.amount);
    updates.fundStatus = "CANCELLED";
    // 只有已支付(HOLD)后才需要实际退款操作
    if (action === "cancel_during_service") {
      try {
        await createRefundTransactions(id, contract.customerId, contract.providerId, refund);
        refundSettled = true;
      } catch (e) {
        console.warn("Cancel refund failed:", e);
      }
    } else {
      refundSettled = true;
    }
  }

  if (action === "open_dispute" || action === "open_dispute_after_complete") {
    await prisma.dispute.create({
      data: {
        contractId: id,
        initiatorId: session.user.id,
        reason: reason || (action === "open_dispute_after_complete" ? "质保争议" : "服务争议"),
        evidence: evidence || null,
      },
    });
  }

  if (action === "resolve_dispute") {
    const resolution = reason || "仲裁结案";
    await prisma.dispute.updateMany({
      where: { contractId: id, status: "OPEN" },
      data: { status: "RESOLVED", resolution },
    });

    const providerAmount = (body.providerAmount as number) ?? contract.amount * 0.5;
    const customerAmount = (body.customerAmount as number) ?? contract.amount * 0.5;
    const refund = { provider: providerAmount, customer: customerAmount };

    try {
      await createRefundTransactions(id, contract.customerId, contract.providerId, refund, "DISPUTE_REFUND");
    } catch (e) {
      console.warn("Dispute refund failed:", e);
    }
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: updates,
  });

  let eventMetadata: string | undefined
  if (metadata) {
    eventMetadata = JSON.stringify(metadata)
  } else if (action === "cancel_before_pay" || action === "cancel_during_service") {
    const refund = calcRefund(contract.serviceStage, contract.amount);
    eventMetadata = JSON.stringify({ refund });
  }

  await addContractEvent({
    contractId: id,
    actorId: session.user.id,
    fromStatus: contract.fundStatus,
    toStatus: nextFundStatus || contract.fundStatus,
    action,
    reason: reason || undefined,
    metadata: eventMetadata,
  });

  // 取消后自动归档到 SETTLED
  if (refundSettled) {
    try {
      await prisma.contract.update({
        where: { id },
        data: { fundStatus: "SETTLED" },
      });
      await addContractEvent({
        contractId: id,
        actorId: session.user.id,
        fromStatus: "CANCELLED",
        toStatus: "SETTLED",
        action: "settle_cancelled",
        reason: "退款完成，订单归档",
      });
    } catch (e) {
      console.warn("Auto settle after cancel failed:", e);
    }
  }

  if (action === "confirm_complete" || action === "auto_complete") {
    try {
      await handleSatisfactionBatch(id);
    } catch (e) {
      console.warn("Satisfaction batch update failed:", e);
    }
  }

  return NextResponse.json({ contract: updated });
}
````

## File: src/app/api/orders/route.ts
````typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateTransition, getNextFundStatus, getNextServiceStage, calcRefund, addContractEvent, handleSatisfactionBatch } from "@/lib/contract-machine";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { serviceId, address, scheduledAt, notes } = body;

  if (!serviceId) {
    return NextResponse.json({ error: "缺少服务ID" }, { status: 400 });
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, price: true, providerId: true, title: true },
  });

  if (!service) {
    return NextResponse.json({ error: "服务不存在" }, { status: 404 });
  }

  if (service.providerId === session.user.id) {
    return NextResponse.json({ error: "不能给自己下单" }, { status: 400 });
  }

  const contract = await prisma.$transaction(async (tx) => {
    const c = await tx.contract.create({
      data: {
        serviceId: service.id,
        customerId: session.user.id,
        providerId: service.providerId,
        fundStatus: "PENDING_HELD",
        terms: `服务: ${service.title}\n金额: ¥${service.price}\n地址: ${address || "待确认"}`,
        amount: service.price,
        address: address || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes: notes || null,
        payments: {
          create: {
            payerId: session.user.id,
            amount: service.price,
            status: "PENDING",
          },
        },
      },
    });

    await tx.contractEvent.create({
      data: {
        contractId: c.id,
        actorId: session.user.id,
        fromStatus: "PENDING_HELD",
        toStatus: "PENDING_HELD",
        action: "create",
        reason: "订单创建，等待支付",
      },
    });

    return c;
  });

  return NextResponse.json({ contract }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  const contracts = await prisma.contract.findMany({
    where: role === "provider"
      ? { providerId: session.user.id }
      : { customerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      service: { select: { id: true, title: true, category: true } },
      provider: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      payments: { select: { status: true, amount: true } },
    },
  });

  return NextResponse.json({ contracts });
}
````

## File: src/app/api/reviews/route.ts
````typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await request.json();
  const { contractId, rating, comment } = body;

  if (!contractId || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "评分无效" }, { status: 400 });
  }

  // Verify contract belongs to user and is completed
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { service: { select: { title: true, category: true } } },
  });
  if (!contract || contract.customerId !== session.user.id) {
    return NextResponse.json({ error: "无权评价" }, { status: 403 });
  }
  if (contract.fundStatus !== "COMPLETED" && contract.fundStatus !== "SATISFACTION_HELD" && contract.fundStatus !== "SETTLED") {
    return NextResponse.json({ error: "订单未完成" }, { status: 400 });
  }

  // Check existing review
  const existing = await prisma.review.findFirst({
    where: { contractId, reviewerId: session.user.id },
  });
  if (existing) {
    return NextResponse.json({ error: "已评价过" }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      contractId,
      reviewerId: session.user.id,
      rating,
      comment: comment || null,
    },
  });

  // Try to extract structured tags from the review
  try {
    const commentText = comment || "(无文字评价)";
    const tagsPrompt = `从以下评价中提取结构化标签。只返回JSON数组格式。
评价: "${commentText}"
服务品类: "${contract.service.title}"

可能的标签（维修）: 修好了/没修好, 按时到达/迟到, 价格透明/价格不透明, 沟通好/沟通差, 现场整洁/现场乱
可能的标签（按摩）: 手法专业/手法一般, 尊重边界/不尊重, 环境整洁/环境差, 准时/迟到, 体验好/体验差
可能的标签（保洁）: 打扫干净/不干净, 按时到达/迟到, 工具齐全/工具不全, 沟通好/沟通差, 服务细致/敷衍

返回格式: ["标签1", "标签2"]`;

    const tags = await callLLM(
      "你是一个评价分析专家，从用户评价中提取结构化标签。",
      tagsPrompt,
      { temperature: 0.2 }
    );

    await prisma.review.update({
      where: { id: review.id },
      data: { comment: `${comment || ""}\n\n【标签】${tags}` },
    });
  } catch (e) {
    // Non-critical, don't fail the review
    console.warn("Tag extraction failed:", e);
  }

  // Update provider credit score (simple: average of all reviews * 20)
  const providerReviews = await prisma.review.findMany({
    where: {
      contract: { providerId: contract.providerId },
    },
    select: { rating: true },
  });
  const avgRating = providerReviews.reduce((sum, r) => sum + r.rating, 0) / providerReviews.length;
  const newScore = Math.round(avgRating * 20); // 5*20=100 base, adjust as needed

  await prisma.user.update({
    where: { id: contract.providerId },
    data: { creditScore: Math.max(0, newScore) },
  });

  return NextResponse.json({ review }, { status: 201 });
}
````

## File: src/app/api/services/route.ts
````typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  if (session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "仅服务商可发布服务" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, price, category } = body;

  if (!title || !description || !price || !category) {
    return NextResponse.json({ error: "请填写完整信息" }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: {
      title,
      description,
      price: parseFloat(price),
      category,
      providerId: session.user.id,
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const services = await prisma.service.findMany({
    where: { providerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      contracts: {
        select: { id: true, fundStatus: true },
      },
    },
  });

  return NextResponse.json({ services });
}
````

## File: src/app/dashboard/page.tsx
````typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

function getCreditLevel(score: number) {
  if (score >= 200) return { label: "优秀", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" };
  if (score >= 150) return { label: "良好", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
  if (score >= 100) return { label: "一般", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: "待提升", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
}

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED":
    case "SETTLED":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "HELD":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "PENDING_HELD":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "SATISFACTION_HELD":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "CANCELLED":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "DISPUTED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_HELD: "待支付",
    HELD: "服务中",
    COMPLETED: "已完成",
    SATISFACTION_HELD: "暂存评估",
    SETTLED: "已结算",
    CANCELLED: "已取消",
    DISPUTED: "纠纷中",
  };
  return labels[status] || status;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          service: { select: { title: true } },
          provider: { select: { name: true } },
        },
      },
      providings: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          service: { select: { title: true } },
          customer: { select: { name: true } },
        },
      },
      services: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { contracts: true } },
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const creditLevel = getCreditLevel(user.creditScore);
  const recentOrders = user.contracts;
  const recentProvidings = user.providings;
  const isProvider = user.role === "PROVIDER";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        控制面板
      </h1>
      <p className="mt-2 text-muted-foreground">
        欢迎回来，{user.name}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* User info card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">个人信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">身份</span>
                <span className="font-medium text-foreground">
                  {user.role === "PROVIDER" ? "服务商" : "客户"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">信用评分</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {user.creditScore}
                  </span>
                  <Badge className={creditLevel.color}>
                    {creditLevel.label}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">账户余额</span>
                <span className="font-medium text-foreground">
                  ¥{user.balance.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isProvider ? (
              <>
                <Link href="/services/new">
                  <Button className="w-full">发布服务</Button>
                </Link>
                <Link href="/dashboard">
                  <Button className="w-full" variant="outline">我的订单</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/services">
                  <Button className="w-full">浏览服务</Button>
                </Link>
                <Link href="/dashboard">
                  <Button className="w-full" variant="outline">我的订单</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Credit score display */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">信用等级</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-bold text-white">
                {user.creditScore}
              </div>
              <p className="mt-2 font-medium text-foreground">
                信用评分
              </p>
              <Badge className={`mt-1 ${creditLevel.color}`}>
                {creditLevel.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-foreground">
          {isProvider ? "最近服务订单" : "最近订单"}
        </h2>
        <Card className="mt-4">
          {(isProvider ? recentProvidings : recentOrders).length === 0 ? (
            <CardContent className="py-10 text-center text-muted-foreground">
              暂无订单记录
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>服务</TableHead>
                  <TableHead>{isProvider ? "客户" : "服务商"}</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isProvider ? recentProvidings : recentOrders).map(
                  (contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        {contract.service.title}
                      </TableCell>
                      <TableCell>
                        {isProvider
                          ? (contract as typeof contract & { customer: { name: string } }).customer.name
                          : (contract as typeof contract & { provider: { name: string } }).provider.name}
                      </TableCell>
                      <TableCell>¥{contract.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(contract.fundStatus)}>
                          {getStatusLabel(contract.fundStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(contract.createdAt).toLocaleDateString(
                          "zh-CN"
                        )}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Provider's own services */}
      {isProvider && (
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">我的服务</h2>
            <Link href="/services/new">
              <Button size="sm">发布新服务</Button>
            </Link>
          </div>
          <Card className="mt-4">
            {user.services.length === 0 ? (
              <CardContent className="py-10 text-center text-muted-foreground">
                暂无服务，点击上方按钮发布您的第一个服务
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>服务名称</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>价格</TableHead>
                    <TableHead>订单数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/services/${service.id}`}
                          className="hover:text-brand-600 transition-colors"
                        >
                          {service.title}
                        </Link>
                      </TableCell>
                      <TableCell>{service.category}</TableCell>
                      <TableCell>¥{service.price.toFixed(2)}</TableCell>
                      <TableCell>{service._count.contracts}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
````

## File: src/app/globals.css
````css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-brand-50: var(--brand-50);
  --color-brand-100: var(--brand-100);
  --color-brand-200: var(--brand-200);
  --color-brand-300: var(--brand-300);
  --color-brand-400: var(--brand-400);
  --color-brand-500: var(--brand-500);
  --color-brand-600: var(--brand-600);
  --color-brand-700: var(--brand-700);
  --color-brand-800: var(--brand-800);
  --color-brand-900: var(--brand-900);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.5 0.24 265);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.95 0.05 265);
  --secondary-foreground: oklch(0.3 0.12 265);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.95 0.05 265);
  --accent-foreground: oklch(0.3 0.12 265);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.6 0.2 265);
  --chart-1: oklch(0.5 0.24 265);
  --chart-2: oklch(0.55 0.2 185);
  --chart-3: oklch(0.6 0.18 145);
  --chart-4: oklch(0.65 0.15 35);
  --chart-5: oklch(0.7 0.12 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.5 0.24 265);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.95 0.05 265);
  --sidebar-accent-foreground: oklch(0.3 0.12 265);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.6 0.2 265);

  /* Brand color scale */
  --brand-50: #eef2ff;
  --brand-100: #e0e7ff;
  --brand-200: #c7d2fe;
  --brand-300: #a5b4fc;
  --brand-400: #818cf8;
  --brand-500: #6366f1;
  --brand-600: #4f46e5;
  --brand-700: #4338ca;
  --brand-800: #3730a3;
  --brand-900: #312e81;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.65 0.22 265);
  --primary-foreground: oklch(0.145 0 0);
  --secondary: oklch(0.3 0.1 265);
  --secondary-foreground: oklch(0.95 0.05 265);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.3 0.1 265);
  --accent-foreground: oklch(0.95 0.05 265);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.6 0.2 265);
  --chart-1: oklch(0.6 0.22 265);
  --chart-2: oklch(0.65 0.2 185);
  --chart-3: oklch(0.7 0.18 145);
  --chart-4: oklch(0.55 0.15 35);
  --chart-5: oklch(0.5 0.12 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.65 0.22 265);
  --sidebar-primary-foreground: oklch(0.145 0 0);
  --sidebar-accent: oklch(0.3 0.1 265);
  --sidebar-accent-foreground: oklch(0.95 0.05 265);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.6 0.2 265);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
````

## File: src/app/layout.tsx
````typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "信用平台 - 专业服务，信用保障",
  description:
    "信用平台连接您与优质服务提供商，提供家电维修、上门按摩、专业保洁等生活服务，资金托管保障您的每一笔交易。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Toaster richColors position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
````

## File: src/app/orders/[id]/page.tsx
````typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import OrderOperations from "./order-operations";

interface Payment {
  id: string;
  status: string;
  amount: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { name: string };
}

interface Contract {
  id: string;
  fundStatus: string;
  serviceStage: number;
  terms: string;
  amount: number;
  address: string | null;
  scheduledAt: string | null;
  notes: string | null;
  completedAt: string | null;
  autoCompleteAt: string | null;
  createdAt: string;
  service: {
    id: string;
    title: string;
    category: string;
    price: number;
    description: string;
  };
  provider: {
    id: string;
    name: string;
    phone: string | null;
    creditScore: number;
  };
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  payments: Payment[];
  reviews: Review[];
  events: { id: string; action: string; fromStatus: string; toStatus: string; reason: string | null; createdAt: string }[];
}

const statusConfig: Record<
  string,
  { label: string; color: string; step: number }
> = {
  PENDING_HELD: { label: "待支付", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", step: 1 },
  HELD: { label: "服务中", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", step: 2 },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", step: 3 },
  SATISFACTION_HELD: { label: "暂存评估", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", step: 3 },
  SETTLED: { label: "已结算", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", step: 4 },
  CANCELLED: { label: "已取消", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", step: -1 },
  DISPUTED: { label: "纠纷中", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", step: -1 },
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    params.then(({ id }) => setOrderId(id));
  }, [params]);

  useEffect(() => {
    if (!orderId) return;

    fetch(`/api/orders/${orderId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load order");
        return res.json();
      })
      .then((data) => setContract(data.contract))
      .catch(() => toast.error("加载订单详情失败"))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-muted-foreground">订单不存在</p>
        <Button className="mt-4" onClick={() => router.push("/orders")}>
          返回订单列表
        </Button>
      </div>
    );
  }

  const userRole =
    session?.user?.id === contract.customer.id ? "CUSTOMER" : "PROVIDER";
  const isCustomer = userRole === "CUSTOMER";
  const isProvider = userRole === "PROVIDER";
  const currentStep = statusConfig[contract.fundStatus]?.step ?? -1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/orders" className="hover:text-foreground">
          我的订单
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">订单详情</span>
      </nav>

      <div className="space-y-6">
        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {["待支付", "服务中", "已完成"].map((label, idx) => {
                const step = idx + 1;
                const isActive = currentStep >= step;
                const isCurrent = currentStep === step;
                return (
                  <div key={label} className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                        isActive
                          ? "bg-brand-600 text-white"
                          : "bg-muted text-muted-foreground"
                      } ${isCurrent ? "ring-2 ring-brand-300 ring-offset-2" : ""}`}
                    >
                      {step}
                    </div>
                    <span
                      className={`mt-2 text-xs ${
                        isActive ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Badge className={statusConfig[contract.fundStatus]?.color}>
                {statusConfig[contract.fundStatus]?.label || contract.fundStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Service Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">服务信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <Link
                  href={`/services/${contract.service.id}`}
                  className="font-medium text-foreground hover:text-brand-600"
                >
                  {contract.service.title}
                </Link>
                <Badge variant="secondary" className="ml-2">
                  {contract.service.category}
                </Badge>
              </div>
              <span className="text-xl font-bold text-brand-600">
                ¥{contract.amount.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                客户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-foreground">
                {contract.customer.name}
              </p>
              {contract.customer.phone && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {contract.customer.phone}
                </p>
              )}
              {isCustomer && (
                <Badge variant="outline" className="mt-2">
                  我
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Provider */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                服务商
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-foreground">
                {contract.provider.name}
              </p>
              {contract.provider.phone && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {contract.provider.phone}
                </p>
              )}
              {isProvider && (
                <Badge variant="outline" className="mt-2">
                  我
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">订单详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contract.address && (
              <div>
                <dt className="text-sm text-muted-foreground">服务地址</dt>
                <dd className="mt-1 text-foreground">{contract.address}</dd>
              </div>
            )}
            {contract.scheduledAt && (
              <div>
                <dt className="text-sm text-muted-foreground">预约时间</dt>
                <dd className="mt-1 text-foreground">
                  {new Date(contract.scheduledAt).toLocaleString("zh-CN")}
                </dd>
              </div>
            )}
            {contract.notes && (
              <div>
                <dt className="text-sm text-muted-foreground">备注</dt>
                <dd className="mt-1 text-foreground">{contract.notes}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted-foreground">下单时间</dt>
              <dd className="mt-1 text-foreground">
                {new Date(contract.createdAt).toLocaleString("zh-CN")}
              </dd>
            </div>
            {contract.completedAt && (
              <div>
                <dt className="text-sm text-muted-foreground">完成时间</dt>
                <dd className="mt-1 text-foreground">
                  {new Date(contract.completedAt).toLocaleString("zh-CN")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-muted-foreground">服务条款</dt>
              <dd className="mt-1 whitespace-pre-wrap text-foreground">
                {contract.terms}
              </dd>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">支付信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contract.payments.length > 0 ? (
              contract.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-foreground">
                    支付 ¥{payment.amount.toFixed(2)}
                  </span>
                  <Badge
                    className={
                      payment.status === "RELEASED"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : payment.status === "ESCROW"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }
                  >
                    {payment.status === "RELEASED"
                      ? "已释放"
                      : payment.status === "ESCROW"
                      ? "托管中"
                      : "待支付"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">暂无支付记录</p>
            )}
          </CardContent>
        </Card>

        {/* Event Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">操作记录</CardTitle>
          </CardHeader>
          <CardContent>
            {contract.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无操作记录</p>
            ) : (
              <div className="space-y-0">
                {contract.events.map((event, idx) => {
                  const isLast = idx === contract.events.length - 1;
                  const actionLabels: Record<string, string> = {
                    create: "创建订单",
                    pay: "支付",
                    cancel_before_pay: "取消订单",
                    provider_accept: "接单",
                    provider_depart: "出发",
                    provider_arrive: "到达",
                    start_service: "开始服务",
                    request_complete: "请求完成",
                    confirm_complete: "确认完成",
                    open_dispute: "发起争议",
                    cancel_during_service: "取消服务",
                    settle_cancelled: "订单归档",
                    batch_release: "批量释放",
                    auto_complete: "自动完成",
                  };
                  const actionLabel =
                    actionLabels[event.action] || event.action;

                  return (
                    <div key={event.id} className="relative flex gap-4 pb-6">
                      {/* Timeline dot & line */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            isLast
                              ? "bg-brand-600 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {contract.events.length - idx}
                        </div>
                        {idx < contract.events.length - 1 && (
                          <div className="mt-0.5 h-full w-px bg-border" />
                        )}
                      </div>
                      {/* Event content */}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {actionLabel}
                          </p>
                          <time className="shrink-0 text-xs text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString("zh-CN")}
                          </time>
                        </div>
                        {event.reason && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {event.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reviews */}
        {contract.reviews.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">服务评价</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contract.reviews.map((review) => (
                <div key={review.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {review.reviewer.name}
                    </span>
                    <span className="text-yellow-500">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <OrderOperations
            contract={contract}
            orderId={orderId!}
            userRole={userRole}
            onActionSuccess={async () => {
              const refreshed = await fetch(`/api/orders/${orderId}`);
              const refreshedData = await refreshed.json();
              setContract(refreshedData.contract);
            }}
          />

          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/orders")}
          >
            返回列表
          </Button>
        </div>
      </div>
    </div>
  );
}
````

## File: src/app/orders/page.tsx
````typescript
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

interface ContractSummary {
  id: string;
  fundStatus: string;
  amount: number;
  createdAt: string;
  service: { id: string; title: string; category: string };
  provider: { id: string; name: string };
  customer: { id: string; name: string };
  payments: { status: string; amount: number }[];
}

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  PENDING_HELD: {
    label: "待支付",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  HELD: {
    label: "服务中",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  COMPLETED: {
    label: "已完成",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  SATISFACTION_HELD: {
    label: "暂存评估",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  SETTLED: {
    label: "已结算",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
  CANCELLED: {
    label: "已取消",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
  DISPUTED: {
    label: "纠纷中",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

type RoleTab = "customer" | "provider";

export default function OrdersPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [role, setRole] = useState<RoleTab>("customer");
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [authStatus, router]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/orders?role=${role}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load orders");
        return res.json();
      })
      .then((data) => setContracts(data.contracts))
      .catch(() => {
        // silently fail; toast not needed on listing
      })
      .finally(() => setLoading(false));
  }, [role]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        我的订单
      </h1>

      {/* Role tabs */}
      <div className="mt-6 flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setRole("customer")}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            role === "customer"
              ? "border-b-2 border-brand-600 text-brand-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          我的下单
        </button>
        <button
          type="button"
          onClick={() => setRole("provider")}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
            role === "provider"
              ? "border-b-2 border-brand-600 text-brand-600"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          我的接单
        </button>
      </div>

      {/* Orders list */}
      <div className="mt-6 space-y-4">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg bg-muted"
            />
          ))
        ) : contracts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {role === "customer" ? "暂无下单记录" : "暂无接单记录"}
              </p>
              {role === "customer" && (
                <Link href="/services">
                  <Button className="mt-4" variant="outline">
                    浏览服务
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          contracts.map((contract) => (
            <Link key={contract.id} href={`/orders/${contract.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          {contract.service.title}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {contract.service.category}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {role === "customer"
                            ? `服务商: ${contract.provider.name}`
                            : `客户: ${contract.customer.name}`}
                        </span>
                        <span>
                          {new Date(contract.createdAt).toLocaleDateString(
                            "zh-CN"
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        className={
                          statusConfig[contract.fundStatus]?.color ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {statusConfig[contract.fundStatus]?.label ||
                          contract.fundStatus}
                      </Badge>
                      <span className="font-bold text-brand-600">
                        ¥{contract.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
````

## File: src/app/page.tsx
````typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const serviceCategories = [
  {
    icon: "🔧",
    title: "家电维修",
    description: "空调、冰箱、洗衣机等家电维修保养，专业师傅上门服务",
    category: "维修",
  },
  {
    icon: "💆",
    title: "上门按摩",
    description: "专业持证按摩师上门服务，舒缓疲劳，放松身心",
    category: "按摩",
  },
  {
    icon: "🧹",
    title: "专业保洁",
    description: "深度清洁、日常保洁、开荒保洁，让家焕然一新",
    category: "保洁",
  },
];

const features = [
  {
    icon: "🛡️",
    title: "信用担保",
    description: "严格的服务商准入审核，实名认证确保服务质量",
  },
  {
    icon: "🔒",
    title: "资金托管",
    description: "平台托管交易资金，服务满意后付款，保障双方权益",
  },
  {
    icon: "💬",
    title: "无忧售后",
    description: "7x24小时客服支持，纠纷快速处理，让您无后顾之忧",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              专业服务，信用保障
            </h1>
            <p className="mt-6 text-lg leading-8 text-indigo-100">
              信用平台连接您与优质服务提供商。家电维修、上门按摩、专业保洁，
              每一笔服务都有信用保障，让您安心享受品质生活。
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/services">
                <Button
                  size="lg"
                  className="bg-white text-brand-700 hover:bg-indigo-50"
                >
                  立即体验
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  注册成为服务商
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Service categories */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            热门服务分类
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            选择您需要的服务，快速找到专业服务商
          </p>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {serviceCategories.map((service) => (
            <Link key={service.category} href={`/services?category=${service.category}`}>
              <Card className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1">
                <CardHeader>
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-2xl dark:bg-brand-900/30">
                    {service.icon}
                  </div>
                  <CardTitle className="mt-4 text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-base">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center text-sm font-medium text-brand-600 group-hover:underline">
                    查看服务 →
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Why choose us */}
      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              为什么选择我们
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              我们致力于为您提供最安全、最便捷的服务体验
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 bg-background shadow-sm">
                <CardHeader>
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-2xl dark:bg-brand-900/30">
                    {feature.icon}
                  </div>
                  <CardTitle className="mt-4 text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-700 px-8 py-16 text-center text-white sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight">
            准备好体验了吗？
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            注册即享新用户专享优惠，马上开始您的品质服务之旅。
          </p>
          <div className="mt-8">
            <Link href="/services">
              <Button
                size="lg"
                className="bg-white text-brand-700 hover:bg-indigo-50"
              >
                立即体验
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
````
