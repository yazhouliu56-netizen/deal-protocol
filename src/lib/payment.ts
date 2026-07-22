import Stripe from "stripe"
import { PaymentManager as PaymentCoreManager } from "@daviekong/payment-core"

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
      this.client = new Stripe(key, { apiVersion: "2026-06-24.dahlia" })
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
    if (!this.client) {
      return {
        success: false,
        providerPaymentId: null,
        provider: "stripe",
        status: "FAILED",
        error: "Stripe client not initialized (missing STRIPE_SECRET_KEY)",
      }
    }
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

const providers = new Map<PaymentProvider, IPaymentProvider>()

export function getPaymentProvider(provider: PaymentProvider): IPaymentProvider {
  let instance = providers.get(provider)
  if (!instance) {
    switch (provider) {
      case "stripe":
        instance = new StripeProvider()
        break
      case "alipay":
      case "wechat": {
        const manager = PaymentCoreManager.getInstance()
        if (!manager.isConfigured(provider)) {
          throw new Error(`国内支付渠道密钥未配置: ${provider}`)
        }
        instance = {
          async createPayment(req) {
            const result = (await manager.createPayment({
              contractId: req.contractId,
              amount: req.amount,
              channel: provider,
              description: req.description,
              payerId: req.payerId,
              notifyUrl: `${process.env.PAYMENT_NOTIFY_URL || ''}/api/payment/notify`,
            } as any)) as { success: boolean; providerPaymentId?: string; redirectUrl?: string; error?: string }
            return {
              success: result.success,
              providerPaymentId: result.providerPaymentId || null,
              provider,
              status: result.success ? 'PENDING' : 'FAILED',
              redirectUrl: result.redirectUrl,
              error: result.error,
            }
          },
          async refundPayment(providerPaymentId, amount) {
            const result = (await (manager as any).refund(providerPaymentId, amount, provider)) as { success: boolean; providerPaymentId?: string; error?: string }
            return {
              success: result.success,
              providerPaymentId: result.providerPaymentId || null,
              provider,
              status: result.success ? 'SUCCEEDED' : 'FAILED',
              error: result.error,
            }
          },
          async parseWebhook(payload, signature) {
            const result = (await manager.handleNotify(provider, payload as string, { signature })) as { success: boolean; providerPaymentId?: string; error?: string }
            return {
              success: result.success,
              providerPaymentId: result.providerPaymentId || null,
              provider,
              status: result.success ? 'SUCCEEDED' : 'FAILED',
              error: result.error,
            }
          },
        }
        break
      }
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

export function getPaymentManager(): PaymentCoreManager {
  return PaymentCoreManager.getInstance()
}

export function getAvailablePaymentChannels(): string[] {
  const manager = PaymentCoreManager.getInstance()
  return manager.getAvailableChannels()
}
