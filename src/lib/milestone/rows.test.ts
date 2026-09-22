import { describe, expect, it } from "vitest";
import { MilestoneRowError, releaseStageRow, submitStageRow } from "./rows";

const NOW = "2026-09-23T00:00:00.000Z";

interface Fx {
  row?: unknown;
  contract?: unknown;
  wallet?: unknown;
  logRows?: unknown[];
  updatedRows?: unknown[];
  updateError?: { message: string } | null;
  captured?: { table: string; payload: unknown }[];
}

/** 最小链式 stub（select/eq/single 与 update/eq/select 双终态）。 */
function stubSvc(fx: Fx) {
  const st = { table: "", mode: "" };
  const b: Record<string, (...args: never[]) => unknown> = {};
  const self = b as unknown as {
    select: () => unknown;
    update: (p: unknown) => unknown;
    insert: (p: unknown) => unknown;
    eq: () => unknown;
    like: () => unknown;
    limit: () => unknown;
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
  b.eq = () => self;
  b.like = () => self;
  b.limit = () => self;
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
      return { data: null, error: null };
    })().then(res, rej);
  };
  const svc = {
    from: (table: string) => {
      st.table = table;
      st.mode = "";
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
const CONTRACT = { customer_id: "u-c", provider_id: "u-p" };

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
