import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createStore } from "zustand/vanilla";
import { enqueue as enqueueOp } from "@/base/platform/offlineQueue";
import { createSafeSlice } from "./safeSlice";
import { createPlatformSlice } from "./platformSlice";
import { useIdentityStore } from "../useIdentityStore";
import type { WaveStore } from "../useWaveStore";

/** 最小 WaveStore 桩：仅挂载 safe + platform 两切片运行时所需状态。 */
function makeStore() {
  return createStore<WaveStore>()((set, get, api) =>
    ({
      crisisRecords: [],
      offlineQueue: [],
      privacySessions: [],
      forgetRequests: [],
      ...createSafeSlice(set, get, api),
      ...createPlatformSlice(set, get, api),
    }) as unknown as WaveStore
  );
}

async function flushAsync(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe("P1-3 一键 SOS 联动链 · Store 接线层（safeSlice + platformSlice）", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useIdentityStore.setState({
      identity: { ...useIdentityStore.getState().identity, id: "u-test" },
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("在线触发：自动封装快照入 CrisisRecord + POST /api/sos/trigger（队列零残留）", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const store = makeStore();

    const out = store.getState().raiseCrisis({
      level: 3,
      note: "考卷 SOS",
      waveId: "w-e2e",
      contacts: ["紧急联系人"],
    });

    expect(out.record).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sos/trigger");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.crisisId).toBe(out.record!.id);
    expect(body.waveId).toBe("w-e2e");

    // 快照已挂载记录且与上报载荷同源（同一 snapshotId）
    const snap = out.record!.forensicSnapshot!;
    expect(snap.snapshotId).toBe((body.snapshot as { snapshotId: string }).snapshotId);
    expect(store.getState().crisisRecords.some((r) => r.id === out.record!.id)).toBe(true);
    expect(store.getState().offlineQueue).toHaveLength(0);
  });

  test("降级分支（红线 5）：无硬件环境 → NO_GPS_DATA 空包 + 零录音切片，绝不抛异常", () => {
    vi.stubGlobal("navigator", { onLine: true });
    fetchMock.mockResolvedValue({ ok: true });
    const store = makeStore();

    const out = store.getState().raiseCrisis({
      level: 2,
      note: "无 GPS 无麦克风",
      contacts: [],
    });
    const snap = out.record!.forensicSnapshot!;
    expect(snap.trajectoryPayload.anomalyFlags).toContain("NO_GPS_DATA");
    expect(snap.trajectoryPayload.pointCount).toBe(0);
    expect(snap.audioEvidenceSummary.chunkCount).toBe(0);
    expect(snap.audioEvidenceSummary.integrityOk).toBe(true);
  });

  test("离线分支：navigator.onLine=false → 不发请求，sos-report 压入 offlineQueue", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const store = makeStore();

    const out = store.getState().raiseCrisis({ level: 3, note: "离线报警", contacts: [] });
    expect(fetchMock).not.toHaveBeenCalled();

    const queue = store.getState().offlineQueue;
    expect(queue).toHaveLength(1);
    expect(queue[0].op.kind).toBe("sos-report");
    const payload = JSON.parse(queue[0].op.payload) as {
      path: string;
      idempotencyKey: string;
      body: Record<string, unknown>;
    };
    expect(payload.path).toBe("/api/sos/trigger");
    expect(payload.idempotencyKey).toBe(out.record!.forensicSnapshot!.snapshotId);
    expect(payload.body.crisisId).toBe(out.record!.id);
  });

  test("弱网失败分支：res.ok=false → 异步补报入队（不阻断主流程返回）", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const store = makeStore();

    const out = store.getState().raiseCrisis({ level: 3, note: "服务端 500", contacts: [] });
    expect(store.getState().offlineQueue).toHaveLength(0); // 同步阶段未入队

    await flushAsync();
    const queue = store.getState().offlineQueue;
    expect(queue).toHaveLength(1);
    expect(queue[0].op.kind).toBe("sos-report");
    const payload = JSON.parse(queue[0].op.payload) as { idempotencyKey: string };
    expect(payload.idempotencyKey).toBe(out.record!.forensicSnapshot!.snapshotId);
  });

  test("replayQueue 补放：sos-report 冲刷携带 x-idempotency-key，成功置 done", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const store = makeStore();

    const body = { userId: "u-test", crisisId: "c-1", level: 3 };
    const payload = JSON.stringify({
      path: "/api/sos/trigger",
      idempotencyKey: "sos-test-key-1",
      body,
    });
    const seeded = enqueueOp(
      store.getState().offlineQueue,
      { kind: "sos-report", payload },
      Date.now()
    );
    store.setState({ offlineQueue: seeded.q });

    await store.getState().replayQueue();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sos/trigger");
    expect((init.headers as Record<string, string>)["x-idempotency-key"]).toBe(
      "sos-test-key-1"
    );
    const queue = store.getState().offlineQueue;
    expect(queue.filter((q) => q.op.kind === "sos-report").every((q) => q.done)).toBe(true);
  });
});
