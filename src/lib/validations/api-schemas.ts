import { z } from 'zod';

export const locationSchema = z.object({
  lat: z.number().min(-90, '纬度必须在 -90 到 90 之间').max(90, '纬度必须在 -90 到 90 之间'),
  lng: z.number().min(-180, '经度必须在 -180 到 180 之间').max(180, '经度必须在 -180 到 180 之间'),
  address: z.string().max(255).optional(),
  city: z.string().max(50).optional(),
});

export const createDemandSchema = z.object({
  title: z.string().min(2, '需求标题至少2个字符').max(100, '需求标题最多100个字符'),
  category: z.string().min(1, '服务分类不能为空'),
  budget: z.number().positive('预算必须大于0').max(1000000, '预算超出允许上限'),
  location: locationSchema.optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

export const generateProtocolSchema = z.object({
  category: z.string().min(1, '品类不能为空'),
  core_fields: z.object({
    time_window: z.string().min(1, '服务时间窗口不能为空'),
    budget_range: z.array(z.number()).length(2, '预算区间必须包含最小值和最大值').optional(),
    location: locationSchema.optional(),
  }).passthrough(),
  custom_modifiers: z.object({
    incentive_penalty_sla: z.array(z.object({
      rule: z.string(),
      delta_amount: z.number(),
    })).optional(),
  }).optional(),
  response_mode: z.enum(['grab_first', 'interest_list', 'agency_dispatch'], {
    errorMap: () => ({ message: '无效的响应模式' }),
  }),
  risk_tier: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({ message: '无效的风控等级' }),
  }),
});

export const arbitrateDisputeSchema = z.object({
  dispute_id: z.string().uuid('无效的争议记录 UUID'),
  reason: z.string().min(5, '仲裁说明不能少于5个字符').max(1000, '仲裁说明不能超过1000字'),
  evidence_ids: z.array(z.string().uuid('证据ID必须为合法UUID')).optional(),
});

export const withdrawRequestSchema = z.object({
  amount: z.number().min(10, '单次提现金额不能低于10元').max(100000, '单次提现金额不能高于100,000元'),
  channel: z.enum(['alipay', 'wechat', 'stripe', 'bank'], {
    errorMap: () => ({ message: '不支持的提现渠道' }),
  }),
  account_info: z.object({
    account_number: z.string().min(1, '收款账号不能为空'),
    real_name: z.string().min(1, '真实姓名不能为空'),
    bank_name: z.string().optional(),
  }),
});

export type CreateDemandInput = z.infer<typeof createDemandSchema>;
export type GenerateProtocolInput = z.infer<typeof generateProtocolSchema>;
export type ArbitrateDisputeInput = z.infer<typeof arbitrateDisputeSchema>;
export type WithdrawRequestInput = z.infer<typeof withdrawRequestSchema>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errorResponse: { status: number; body: { error: string; details: string[] } } };

export function validateApiInput<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const parseResult = schema.safeParse(data);
  if (!parseResult.success) {
    const details = parseResult.error.errors.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    );
    return {
      success: false,
      errorResponse: {
        status: 400,
        body: {
          error: 'Invalid Request Body',
          details,
        },
      },
    };
  }
  return {
    success: true,
    data: parseResult.data,
  };
}
