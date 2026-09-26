import { describe, expect, it } from "vitest";
import {
  decideStageAmendment,
  listStageAmendments,
  proposeStageAmendment,
} from "./amend";
import { MilestoneRowError } from "./rows";

interface Fx {
  contract?: unknown;
  submittedRows?: unknown[];
  latest?: unknown[];
  proposals?: unknown[];
  proposal?: unknown;
  inserted?: unknown[];
  captured?: { table: string; op: string; payload?: unknown }[];
}

/** 链式 stub（select 参数区分 latest/list；insert 回显可配）。 */
function stubSvc(fx: Fx) {
  const st = { table: "", mode: "", selectArgs: "" };
  const b: Record<string, (...args: never[]) => unknown> = {};
  const self = b as unknown as {
    select: (s?: string) => unknown;
    update: (p: unknown) => unknown;
    insert: (p: unknown) => unknown;
    delete: () => unknown;
    eq: () => unknown;
    order: () => unknown;
    limit: () => unknown;
    in: () => unknown;
    single: () => Promise<{ data: unknown; error: null }>;
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) => void;
  };
  b.select = (s?: string) => {
    if (!st.mode) st.mode = "select";
    if (s) st.selectArgs = s;
    return self;
  };
  b.update = (payload: unknown) => {
    st.mode = "update";
    (fx.captured ??= []).push({ table: st.table, op: "update", payload });
    return self;
  };
  b.insert = (payload: unknown) => {
    st.mode = "insert";
    (fx.captured ??= []).push({ table: st.table, op: "insert", payload });
    return self;
  };
  b.delete = () => {
    st.mode = "delete";
    (fx.captured ??= []).push({ table: st.table, op: "delete" });
    return self;
  };
  b.eq = () => self;
  b.order = () => self;
  b.limit = () => self;
  b.in = () => self;
  b.single = async () => {
    if (st.table === "contracts") return { data: fx.contract ?? null, error: null };
    if (st.table === "milestone_amendments") return { data: fx.proposal ?? null, error: null };
    return { data: null, error: null };
  };
  b.then = (res, rej) => {
    (async () => {
      if (st.mode === "insert" && st.table === "milestone_amendments") {
        return { data: fx.inserted ?? [{ id: "p-new" }], error: null };
      }
      if (st.mode === "select" && st.table === "milestone_schedules") {
        return { data: fx.submittedRows ?? [], error: null };
      }
      if (st.mode === "select" && st.table === "milestone_amendments") {
        return st.selectArgs === "version"
          ? { data: fx.latest ?? [], error: null }
          : { data: fx.proposals ?? [], error: null };
      }
      return { data: null, error: null };
    })().then(res, rej);
  };
  return {
    svc: {
      from: (table: string) => {
        st.table = table;
        st.mode = "";
        st.selectArgs = "";
        return self;
      },
    } as never,
    fx,
  };
}

const CONTRACT = { customer_id: "u-c", provider_id: "u-p", amount: 1000 };
const STAGES = [
  { title: "拆旧", weightPct: 50, acceptance: "清运干净" },
  { title: "水电", weightPct: 50, acceptance: "通电通水" },
];

async function errOf(p: Promise<unknown>): Promise<MilestoneRowError> {
  try {
    await p;
  } catch (e) {
    return e as MilestoneRowError;
  }
  throw new Error("expected throw");
}

describe("proposeStageAmendment 改期提议", () => {
  it("合法计划 → 版本递增写入 PROPOSED", async () => {
    const { svc, fx } = stubSvc({ contract: CONTRACT, latest: [{ version: 2 }] });
    const r = await proposeStageAmendment(svc, "c-1", "u-c", STAGES);
    expect(r).toEqual({ proposalId: "p-new", version: 3 });
    expect(fx.captured).toContainEqual({
      table: "milestone_amendments",
      op: "insert",
      payload: expect.objectContaining({ version: 3, proposed_by: "u-c", status: "PROPOSED" }),
    });
  });

  it("权重和≠100 → INVALID_PLAN 400", async () => {
    const { svc } = stubSvc({ contract: CONTRACT });
    const e = await errOf(
      proposeStageAmendment(svc, "c-1", "u-c", [{ ...STAGES[0], weightPct: 40 }, STAGES[1]]),
    );
    expect(e.code).toBe("INVALID_PLAN");
    expect(e.status).toBe(400);
  });

  it("有在途验收 → IN_FLIGHT 409", async () => {
    const { svc } = stubSvc({ contract: CONTRACT, submittedRows: [{ id: "r1" }] });
    const e = await errOf(proposeStageAmendment(svc, "c-1", "u-c", STAGES));
    expect(e.code).toBe("IN_FLIGHT");
  });

  it("局外人 → FORBIDDEN 403", async () => {
    const { svc } = stubSvc({ contract: CONTRACT });
    const e = await errOf(proposeStageAmendment(svc, "c-1", "stranger", STAGES));
    expect(e.status).toBe(403);
  });
});

describe("decideStageAmendment 改期裁决", () => {
  const PROPOSAL = {
    id: "p-1",
    contract_id: "c-1",
    version: 3,
    stages: STAGES,
    proposed_by: "u-c",
    status: "PROPOSED",
  };

  it("对方接受 → 删未放款行＋按合同额重切＋ACCEPTED", async () => {
    const { svc, fx } = stubSvc({ contract: CONTRACT, proposal: PROPOSAL });
    const r = await decideStageAmendment(svc, "p-1", "u-p", true);
    expect(r).toEqual({ accepted: true, version: 3 });
    expect(fx.captured).toContainEqual({ table: "milestone_schedules", op: "delete" });
    expect(fx.captured).toContainEqual({
      table: "milestone_schedules",
      op: "insert",
      payload: [
        expect.objectContaining({ title: "拆旧", amount: 500, step_number: 1, status: "PENDING" }),
        expect.objectContaining({ title: "水电", amount: 500, step_number: 2, status: "PENDING" }),
      ],
    });
    expect(fx.captured).toContainEqual({
      table: "milestone_amendments",
      op: "update",
      payload: expect.objectContaining({ status: "ACCEPTED", decided_by: "u-p" }),
    });
  });

  it("提议人自批 → FORBIDDEN（须对方确认）", async () => {
    const { svc } = stubSvc({ contract: CONTRACT, proposal: PROPOSAL });
    const e = await errOf(decideStageAmendment(svc, "p-1", "u-c", true));
    expect(e.status).toBe(403);
  });

  it("拒绝 → REJECTED，不动行", async () => {
    const { svc, fx } = stubSvc({ contract: CONTRACT, proposal: PROPOSAL });
    const r = await decideStageAmendment(svc, "p-1", "u-p", false);
    expect(r).toEqual({ accepted: false, version: 3 });
    expect(fx.captured?.some((c) => c.table === "milestone_schedules")).toBe(false);
    expect(fx.captured).toContainEqual({
      table: "milestone_amendments",
      op: "update",
      payload: expect.objectContaining({ status: "REJECTED" }),
    });
  });

  it("已裁决提案 → 409", async () => {
    const { svc } = stubSvc({
      contract: CONTRACT,
      proposal: { ...PROPOSAL, status: "ACCEPTED" },
    });
    const e = await errOf(decideStageAmendment(svc, "p-1", "u-p", true));
    expect(e.status).toBe(409);
  });
});

describe("listStageAmendments 列表＋canDecide", () => {
  it("自己的提案不可批，对方的可批", async () => {
    const { svc } = stubSvc({
      contract: CONTRACT,
      proposals: [
        { id: "p-1", version: 1, stages: STAGES, proposed_by: "u-c", status: "PROPOSED" },
        { id: "p-2", version: 2, stages: STAGES, proposed_by: "u-p", status: "PROPOSED" },
        { id: "p-0", version: 0, stages: STAGES, proposed_by: "u-p", status: "REJECTED" },
      ],
    });
    const list = await listStageAmendments(svc, "c-1", "u-c");
    expect(list.find((p) => p.id === "p-1")?.canDecide).toBe(false);
    expect(list.find((p) => p.id === "p-2")?.canDecide).toBe(true);
    expect(list.find((p) => p.id === "p-0")?.canDecide).toBe(false);
  });
});
