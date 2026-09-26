import { describe, expect, it, vi } from "vitest";
import {
  MilestoneRowError,
  releaseStageRow,
  submitStageRow,
  sweepMilestoneTimeouts,
} from "./rows";

const NOW = "2026-09-23T00:00:00.000Z";

// M3：费率配置可控（缺省全 0＝M1 语义；逐例按需调高）。
const cfgState = vi.hoisted(() => ({
  commissionRate: 0,
  channelRates: { wechat: 0, alipay: 0, stripe: 0 },
}));
vi.mock("@/lib/platform/config", () => ({
  getConfig: async () => ({
    fees: {
      commissionRate: cfgState.commissionRate,
      channelRates: cfgState.channelRates,
    },
  }),
}));

interface Fx {
  row?: unknown;
  contract?: unknown;
  wallet?: unknown;
  logRows?: unknown[];
  payRows?: unknown[];
  dueRows?: unknown[];
  openRows?: unknown[];
  selectContracts?: unknown[];
  updatedRows?: unknown[];
  updateError?: { message: string } | null;
  captured?: { table: string; payload: unknown }[];
}

/** 最小链式 stub（select/eq/single 与 update/eq/select 双终态；lte/in 供 sweep）。 */
function stubSvc(fx: Fx) {
  const st = { table: "", mode: "", filters: [] as { op: string; args: unknown[] }[] };
  const b: Record<string, (...args: never[]) => unknown> = {};
  const self = b as unknown as {
    select: () => unknown;
    update: (p: unknown) => unknown;
    insert: (p: unknown) => unknown;
    eq: (...a: unknown[]) => unknown;
    like: () => unknown;
    order: () => unknown;
    limit: () => unknown;
    lte: (...a: unknown[]) => unknown;
    in: (...a: unknown[]) => unknown;
    single: () => Promise<{ data: unknown; error: null }>;
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) => void;
  };
  b.select = () => {
    if (!st.mode) st.mode = "select";
    return self;
  };
  b.update = (payload: unknown) => {
    st.mode = "update";
    (fx.captured ??= []).push({ table: st.table, payload });
    return self;
  };
  b.insert = (payload: unknown) => {
    st.mode = "insert";
    (fx.captured ??= []).push({ table: st.table, payload });
    return self;
  };
  b.eq = (...a: unknown[]) => {
    st.filters.push({ op: "eq", args: a });
    return self;
  };
  b.like = () => self;
  b.order = () => self;
  b.limit = () => self;
  b.lte = (...a: unknown[]) => {
    st.filters.push({ op: "lte", args: a });
    return self;
  };
  b.in = (...a: unknown[]) => {
    st.filters.push({ op: "in", args: a });
    return self;
  };
  b.single = async () => {
    if (st.table === "milestone_schedules") return { data: fx.row ?? null, error: null };
    if (st.table === "contracts") return { data: fx.contract ?? null, error: null };
    if (st.table === "provider_wallets") return { data: fx.wallet ?? null, error: null };
    return { data: null, error: null };
  };
  b.then = (res, rej) => {
    (async () => {
      if (st.mode === "update") {
        if (fx.updateError) return { data: null, error: fx.updateError };
        return { data: fx.updatedRows ?? [{ id: "r1" }], error: null };
      }
      if (st.mode === "select" && st.table === "wallet_logs") {
        return { data: fx.logRows ?? [], error: null };
      }
      if (st.mode === "select" && st.table === "payments") {
        return { data: fx.payRows ?? null, error: null };
      }
      if (st.mode === "select" && st.table === "milestone_schedules") {
        if (st.filters.some((f) => f.op === "lte")) return { data: fx.dueRows ?? [], error: null };
        if (st.filters.some((f) => f.op === "in")) return { data: fx.openRows ?? [], error: null };
        return { data: [], error: null };
      }
      if (st.mode === "select" && st.table === "contracts") {
        return { data: fx.selectContracts ?? [], error: null };
      }
      return { data: null, error: null };
    })().then(res, rej);
  };
  const svc = {
    from: (table: string) => {
      st.table = table;
      st.mode = "";
      st.filters = [];
      return self;
    },
  };
  return { svc: svc as never, fx };
}

const ROW = {
  id: "row-1",
  contract_id: "c-1",
  title: "水电改造",
  amount: 500,
  step_number: 2,
  status: "PENDING",
  sla_hours: 24,
};
const CONTRACT = { customer_id: "u-c", provider_id: "u-p", dispute_status: null };

async function errOf(p: Promise<unknown>): Promise<MilestoneRowError> {
  try {
    await p;
  } catch (e) {
    return e as MilestoneRowError;
  }
  throw new Error("expected throw");
}

describe("submitStageRow 服务方交验", () => {
  it("PENDING→SUBMITTED：落 submitted_at＋sla 死线", async () => {
    const { svc, fx } = stubSvc({ row: ROW, contract: CONTRACT });
    const r = await submitStageRow(svc as never, "row-1", "u-p", NOW);
    expect(r).toEqual({
      submitted: true,
      stepNumber: 2,
      autoConfirmAt: "2026-09-24T00:00:00.000Z",
    });
    expect(fx.captured).toContainEqual({
      table: "milestone_schedules",
      payload: {
        status: "SUBMITTED",
        submitted_at: NOW,
        auto_confirm_at: "2026-09-24T00:00:00.000Z",
      },
    });
  });

  it("需求方交验 → 403", async () => {
    const { svc } = stubSvc({ row: ROW, contract: CONTRACT });
    const e = await errOf(submitStageRow(svc as never, "row-1", "u-c", NOW));
    expect(e).toBeInstanceOf(MilestoneRowError);
    expect(e.status).toBe(403);
  });

  it("已放款行再交验 → 409", async () => {
    const { svc } = stubSvc({
      row: { ...ROW, status: "RELEASED" },
      contract: CONTRACT,
    });
    const e = await errOf(submitStageRow(svc as never, "row-1", "u-p", NOW));
    expect(e.status).toBe(409);
  });

  it("SUBMITTED 重交验幂等直返", async () => {
    const { svc, fx } = stubSvc({
      row: { ...ROW, status: "SUBMITTED" },
      contract: CONTRACT,
    });
    const r = await submitStageRow(svc as never, "row-1", "u-p", NOW);
    expect(r.alreadySubmitted).toBe(true);
    expect(fx.captured ?? []).toEqual([]);
  });
});

describe("releaseStageRow 需求方放款", () => {
  it("SUBMITTED→RELEASED：钱包到账＋MILESTONE_PAYOUT 落账", async () => {
    const { svc, fx } = stubSvc({
      row: { ...ROW, status: "SUBMITTED" },
      contract: CONTRACT,
      wallet: { balance: 10 },
    });
    const r = await releaseStageRow(svc as never, "row-1", "u-c", NOW);
    expect(r).toEqual({
      released: true,
      amountYuan: 500,
      providerNetYuan: 500,
      commissionYuan: 0,
      channelFeeYuan: 0,
      skippedAcceptance: false,
    });
    expect(fx.captured).toContainEqual({
      table: "provider_wallets",
      payload: expect.objectContaining({ balance: 510 }),
    });
    expect(fx.captured).toContainEqual({
      table: "wallet_logs",
      payload: expect.objectContaining({ type: "milestone_payout", amount: 500 }),
    });
    expect(fx.captured).toContainEqual({
      table: "milestone_schedules",
      payload: expect.objectContaining({ status: "RELEASED" }),
    });
  });

  it("HELD 免验收直放：skippedAcceptance 标记", async () => {
    const { svc } = stubSvc({
      row: { ...ROW, status: "HELD" },
      contract: CONTRACT,
      wallet: { balance: 0 },
    });
    const r = await releaseStageRow(svc as never, "row-1", "u-c", NOW);
    expect(r.released).toBe(true);
    expect(r.skippedAcceptance).toBe(true);
  });

  it("服务方放款 → 403", async () => {
    const { svc } = stubSvc({
      row: { ...ROW, status: "SUBMITTED" },
      contract: CONTRACT,
    });
    const e = await errOf(releaseStageRow(svc as never, "row-1", "u-p", NOW));
    expect(e.status).toBe(403);
  });

  it("RELEASED 重放幂等：不碰钱包", async () => {
    const { svc, fx } = stubSvc({
      row: { ...ROW, status: "RELEASED" },
      contract: CONTRACT,
    });
    const r = await releaseStageRow(svc as never, "row-1", "u-c", NOW);
    expect(r.alreadyReleased).toBe(true);
    expect(fx.captured ?? []).toEqual([]);
  });

  it("崩溃重放：已有放款日志 → 只补翻状态（recovered，不二次入账）", async () => {
    const { svc, fx } = stubSvc({
      row: { ...ROW, status: "SUBMITTED" },
      contract: CONTRACT,
      logRows: [{ id: "log-9" }],
    });
    const r = await releaseStageRow(svc as never, "row-1", "u-c", NOW);
    expect(r.recovered).toBe(true);
    expect(fx.captured ?? []).toEqual([
      {
        table: "milestone_schedules",
        payload: expect.objectContaining({ status: "RELEASED" }),
      },
    ]);
  });
});

describe("行金额单位（P7 元口径）", () => {
  it("非法金额 → 500", async () => {
    const { svc } = stubSvc({
      row: { ...ROW, status: "SUBMITTED", amount: 0 },
      contract: CONTRACT,
    });
    const e = await errOf(releaseStageRow(svc as never, "row-1", "u-c", NOW));
    expect(e.code).toBe("INVALID_AMOUNT");
  });
});

describe("M3 费用分摊（佣金逐期＋通道同口径）", () => {
  it("佣金 5%：平台记 COMMISSION 行，师傅实得 475", async () => {
    cfgState.commissionRate = 0.05;
    try {
      const { svc, fx } = stubSvc({
        row: { ...ROW, status: "SUBMITTED" },
        contract: CONTRACT,
        wallet: { balance: 10 },
      });
      const r = await releaseStageRow(svc as never, "row-1", "u-c", NOW);
      expect(r).toEqual({
        released: true,
        amountYuan: 500,
        providerNetYuan: 475,
        commissionYuan: 25,
        channelFeeYuan: 0,
        skippedAcceptance: false,
      });
      expect(fx.captured).toContainEqual({
        table: "provider_wallets",
        payload: expect.objectContaining({ balance: 485 }),
      });
      expect(fx.captured).toContainEqual({
        table: "transactions",
        payload: expect.objectContaining({ type: "COMMISSION", amount: -25 }),
      });
      expect(fx.captured).toContainEqual({
        table: "wallet_logs",
        payload: expect.objectContaining({ type: "milestone_payout", amount: 475 }),
      });
    } finally {
      cfgState.commissionRate = 0;
    }
  });

  it("通道费：微信 0.6% 按本期计提，师傅实得 497", async () => {
    cfgState.channelRates = { wechat: 0.006, alipay: 0.006, stripe: 0.029 };
    try {
      const { svc, fx } = stubSvc({
        row: { ...ROW, status: "SUBMITTED" },
        contract: CONTRACT,
        wallet: { balance: 10 },
        payRows: [{ provider: "wechat", amount: 500 }],
      });
      const r = await releaseStageRow(svc as never, "row-1", "u-c", NOW);
      expect(r.channelFeeYuan).toBe(3);
      expect(r.providerNetYuan).toBe(497);
      expect(fx.captured).toContainEqual({
        table: "provider_wallets",
        payload: expect.objectContaining({ balance: 507 }),
      });
    } finally {
      cfgState.channelRates = { wechat: 0, alipay: 0, stripe: 0 };
    }
  });

  it("费用超本期 → 500（P3 守恒硬锁逐期）", async () => {
    cfgState.commissionRate = 0.9;
    cfgState.channelRates = { wechat: 0.2, alipay: 0.2, stripe: 0.2 };
    try {
      const { svc } = stubSvc({
        row: { ...ROW, status: "SUBMITTED", amount: 100 },
        contract: CONTRACT,
        wallet: { balance: 0 },
        payRows: [{ provider: "wechat", amount: 100 }],
      });
      const e = await errOf(releaseStageRow(svc as never, "row-1", "u-c", NOW));
      expect(e.code).toBe("INVALID_FEE");
    } finally {
      cfgState.commissionRate = 0;
      cfgState.channelRates = { wechat: 0, alipay: 0, stripe: 0 };
    }
  });
});

describe("M4 争议冻结（OPEN/PENDING_REVIEW 钱不动）", () => {
  it("交验被冻结 → 409 DISPUTE_OPEN", async () => {
    const { svc } = stubSvc({
      row: ROW,
      contract: { ...CONTRACT, dispute_status: "OPEN" },
    });
    const e = await errOf(submitStageRow(svc as never, "row-1", "u-p", NOW));
    expect(e.code).toBe("DISPUTE_OPEN");
    expect(e.status).toBe(409);
  });

  it("放款被冻结 → 409（PENDING_REVIEW 同冻）", async () => {
    const { svc } = stubSvc({
      row: { ...ROW, status: "SUBMITTED" },
      contract: { ...CONTRACT, dispute_status: "PENDING_REVIEW" },
    });
    const e = await errOf(releaseStageRow(svc as never, "row-1", "u-c", NOW));
    expect(e.code).toBe("DISPUTE_OPEN");
  });

  it("RESOLVED 不冻结（终裁后阶段路恢复）", async () => {
    const { svc, fx } = stubSvc({
      row: { ...ROW, status: "SUBMITTED" },
      contract: { ...CONTRACT, dispute_status: "RESOLVED" },
      wallet: { balance: 0 },
    });
    const r = await releaseStageRow(svc as never, "row-1", "u-c", NOW);
    expect(r.released).toBe(true);
    expect(fx.captured?.some((c) => c.table === "provider_wallets")).toBe(true);
  });
});

describe("M4 兜底扫描 sweepMilestoneTimeouts", () => {
  const DUE_ROW = {
    id: "r-due",
    contract_id: "c-1",
    title: "水电改造",
    amount: 300,
    step_number: 1,
    status: "SUBMITTED",
    sla_hours: 24,
  };

  it("到期 SUBMITTED → 系统自动放款（免调用方身份，钱照付）", async () => {
    const { svc, fx } = stubSvc({
      row: DUE_ROW,
      contract: CONTRACT,
      wallet: { balance: 0 },
      dueRows: [{ id: "r-due", contract_id: "c-1" }],
      openRows: [{ id: "r-due", contract_id: "c-1" }],
      selectContracts: [{ id: "c-1", fund_status: "HELD" }],
    });
    const r = await sweepMilestoneTimeouts(svc as never, "2026-09-25T00:00:00.000Z");
    expect(r.autoReleased).toEqual(["r-due"]);
    expect(r.autoFailed).toEqual([]);
    expect(fx.captured).toContainEqual({
      table: "provider_wallets",
      payload: expect.objectContaining({ balance: 300 }),
    });
  });

  it("争议中到期行 → 记 hold 不放款（autoFailed 留痕）", async () => {
    const { svc, fx } = stubSvc({
      row: DUE_ROW,
      contract: { ...CONTRACT, dispute_status: "OPEN" },
      dueRows: [{ id: "r-due", contract_id: "c-1" }],
      openRows: [],
    });
    const r = await sweepMilestoneTimeouts(svc as never, "2026-09-25T00:00:00.000Z");
    expect(r.autoReleased).toEqual([]);
    expect(r.autoFailed).toHaveLength(1);
    expect(r.autoFailed[0]).toContain("DISPUTE_OPEN");
    expect(fx.captured ?? []).toEqual([]);
  });

  it("终局合同未终态行 → REFUNDED 收敛（只关状态不动钱）", async () => {
    const { svc, fx } = stubSvc({
      dueRows: [],
      openRows: [{ id: "r-9", contract_id: "c-9" }],
      selectContracts: [{ id: "c-9", fund_status: "CANCELLED" }],
    });
    const r = await sweepMilestoneTimeouts(svc as never, NOW);
    expect(r.closedTerminal).toEqual(["r-9"]);
    expect(fx.captured).toContainEqual({
      table: "milestone_schedules",
      payload: expect.objectContaining({ status: "REFUNDED" }),
    });
    expect(fx.captured?.some((c) => c.table === "provider_wallets")).toBe(false);
  });

  it("非终局合同行不动", async () => {
    const { svc, fx } = stubSvc({
      dueRows: [],
      openRows: [{ id: "r-9", contract_id: "c-9" }],
      selectContracts: [{ id: "c-9", fund_status: "HELD" }],
    });
    const r = await sweepMilestoneTimeouts(svc as never, NOW);
    expect(r.closedTerminal).toEqual([]);
    expect(fx.captured ?? []).toEqual([]);
  });
});
