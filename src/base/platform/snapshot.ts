/**
 * 本地数据快照（数据自主权）— 纯函数：收集 / 校验 / 回灌。
 * 导出：读取所有 `oto-` 前缀的 storage 键（zustand persist + 自管键），
 * 打包为版本化 JSON；导入：校验后逐键回写 + 由调用方 reload 触发 rehydrate。
 * bundleVer 等版本守卫在 transport 合并层继续生效，回灌并非绕过。
 */

export const SNAPSHOT_VERSION = 1;
/** 快照只会携带的键前缀（安全地避开其它应用数据）。 */
export const SNAPSHOT_PREFIX = "oto-";
/** 快照归属的应用标识（防串包）。 */
export const SNAPSHOT_APP = "oto-spatial";

/** 只有同步字符串读写的 storage 形状（实现方 = window.localStorage / 测试 fake）。 */
export interface LikeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  key(i: number): string | null;
  length: number;
}

/** 导出文件骨架：meta + stores（键 → JSON 字符串）。 */
export interface Snapshot {
  app: string;
  version: number;
  exportedAt: number;
  /** 导出的 storage 键名。 */
  keys: string[];
  stores: Record<string, string>;
}

/** 收集全部 `oto-` 前缀键。 */
export function collectSnapshot(
  storage: LikeStorage,
  now: number = Date.now()
): Snapshot {
  const stores: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith(SNAPSHOT_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;
    stores[key] = raw;
  }
  return {
    app: SNAPSHOT_APP,
    version: SNAPSHOT_VERSION,
    exportedAt: now,
    keys: Object.keys(stores),
    stores,
  };
}

/** 校验结构：应用标识 / 版本兼容 / stores 形状。 */
export function validateSnapshot(raw: unknown): raw is Snapshot {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Partial<Snapshot>;
  if (s.app !== SNAPSHOT_APP) return false;
  if (typeof s.version !== "number" || s.version > SNAPSHOT_VERSION) return false;
  if (!s.stores || typeof s.stores !== "object") return false;
  if (!Array.isArray(s.keys) || s.keys.some((k) => typeof k !== "string")) {
    return false;
  }
  return Object.values(s.stores).every((v) => typeof v === "string");
}

/** 回灌：仅接受可解析、键仍带 `oto-` 前缀的 store 项 → 返回写入成功清单。 */
export function applySnapshot(
  storage: LikeStorage,
  raw: string | unknown
): { applied: string[]; skipped: number; error?: string } {
  const snap = typeof raw === "string" ? parseSnapshot(raw) : raw;
  if (!validateSnapshot(snap)) {
    return { applied: [], skipped: 0, error: "快照格式无效或版本过新" };
  }
  const applied: string[] = [];
  let skipped = 0;
  for (const [key, value] of Object.entries(snap.stores)) {
    if (!key.startsWith(SNAPSHOT_PREFIX)) {
      skipped++;
      continue;
    }
    try {
      storage.setItem(key, value);
      applied.push(key);
    } catch {
      skipped++;
    }
  }
  return { applied, skipped };
}

/** 序列化 / 反序列化（统一入口，便于未来切换格式）。 */
export function packSnapshot(snap: Snapshot): string {
  return JSON.stringify(snap);
}

export function parseSnapshot(raw: string): Snapshot | null {
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}