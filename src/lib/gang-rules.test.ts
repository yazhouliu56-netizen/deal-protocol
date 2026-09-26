import { describe, expect, it } from "vitest";
import {
  checkMutualBrushPair,
  findIdCollision,
  meetupSafetyPackage,
  MUTUAL_BRUSH_THRESHOLD,
} from "./gang-rules";

interface Fx {
  rows?: unknown[];
  error?: { message: string } | null;
  captured?: { table: string; op: string; payload?: unknown }[];
}

/** 最小链式 stub（select/eq/gte/neq/limit 单终态＋insert 捕获）。 */
function stubSvc(fx: Fx) {
  const st = { table: "", mode: "" };
  const b: Record<string, (...args: never[]) => unknown> = {};
  const self = b as unknown as {
    select: () => unknown;
    insert: (p: unknown) => unknown;
    eq: () => unknown;
    neq: () => unknown;
    gte: () => unknown;
    limit: () => unknown;
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) => void;
  };
  b.select = () => {
    st.mode = "select";
    return self;
  };
  b.insert = (payload: unknown) => {
    st.mode = "insert";
    (fx.captured ??= []).push({ table: st.table, op: "insert", payload });
    return self;
  };
  b.eq = () => self;
  b.neq = () => self;
  b.gte = () => self;
  b.limit = () => self;
  b.then = (res, rej) => {
    (async () => {
      if (st.mode === "insert") return { data: null, error: null };
      if (fx.error) return { data: null, error: fx.error };
      return { data: fx.rows ?? [], error: null };
    })().then(res, rej);
  };
  return {
    svc: {
      from: (table: string) => {
        st.table = table;
        st.mode = "";
        return self;
      },
    } as never,
    fx,
  };
}

describe("R1 互刷环（同对 30 天已结算≥3）", () => {
  it("达阈值 → hit＋metric 旗", async () => {
    const { svc, fx } = stubSvc({ rows: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    const r = await checkMutualBrushPair(svc, "u-c", "u-p");
    expect(r).toEqual({ hit: true, count: 3 });
    expect(fx.captured).toContainEqual({
      table: "metric_events",
      op: "insert",
      payload: expect.objectContaining({ name: "risk.mutual_brush_flag", value: 3 }),
    });
  });

  it("未达阈值 → 放行无旗", async () => {
    const { svc, fx } = stubSvc({ rows: [{ id: "a" }] });
    const r = await checkMutualBrushPair(svc, "u-c", "u-p");
    expect(r).toEqual({ hit: false, count: 1 });
    expect(fx.captured ?? []).toEqual([]);
  });

  it("查询异常 → 放行（可用性优先）", async () => {
    const { svc } = stubSvc({ error: { message: "db down" } });
    const r = await checkMutualBrushPair(svc, "u-c", "u-p");
    expect(r).toEqual({ hit: false, count: 0 });
  });

  it("阈值常量＝用户拍板 3", () => {
    expect(MUTUAL_BRUSH_THRESHOLD).toBe(3);
  });
});

describe("R2 马甲撞库（同证多号）", () => {
  it("撞车 → 返回他方 id＋metric 旗", async () => {
    const { svc, fx } = stubSvc({ rows: [{ id: "u-other" }] });
    const r = await findIdCollision(svc, "hash9", "u-me");
    expect(r).toBe("u-other");
    expect(fx.captured).toContainEqual({
      table: "metric_events",
      op: "insert",
      payload: expect.objectContaining({ name: "risk.id_collision" }),
    });
  });

  it("无撞车 → null；异常 → null 放行", async () => {
    const { svc } = stubSvc({ rows: [] });
    expect(await findIdCollision(svc, "hash9", "u-me")).toBeNull();
    const { svc: svc2 } = stubSvc({ error: { message: "db down" } });
    expect(await findIdCollision(svc2, "hash9", "u-me")).toBeNull();
  });
});

describe("见面安全包判定", () => {
  it("首单或入户即触达（可叠加）， routine 不扰", () => {
    expect(meetupSafetyPackage({ isFirstOrder: true })).toEqual({ send: true, reasons: ["first-order"] });
    expect(meetupSafetyPackage({ isFirstOrder: false, supplyCluster: "C2_IN_HOME" })).toEqual({
      send: true,
      reasons: ["home-access"],
    });
    expect(
      meetupSafetyPackage({ isFirstOrder: true, supplyCluster: "C2_IN_HOME" }).reasons,
    ).toHaveLength(2);
    expect(meetupSafetyPackage({ isFirstOrder: false, supplyCluster: "C1_MOBILITY" })).toEqual({
      send: false,
      reasons: [],
    });
  });
});
