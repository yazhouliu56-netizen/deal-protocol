/**
 * 容灾等级持久化适配器（服务端专用，L6-M3）：
 * proxy 与 route handler 分属不同 bundle，模块级内存不共享，
 * 以 `.resilience-state.json` 文件为唯一跨层事实源。
 * 客户端 bundle 严禁 import 本文件（含 node:fs）。
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  configureResiliencePersistence,
  isDegradationLevel,
  type DegradationLevel,
} from "@/base/platform/resilience"

const STATE_FILE_ENV = "RESILIENCE_STATE_FILE"
const DEFAULT_STATE_FILE = join(process.cwd(), ".resilience-state.json")

const stateFilePath = () => process.env[STATE_FILE_ENV] || DEFAULT_STATE_FILE

let cached: { path: string; level: DegradationLevel | null; at: number } = {
  path: "",
  level: null,
  at: 0,
}
const FILE_READ_TTL_MS = 1000

const persistence = {
  read(): DegradationLevel | null {
    const p = stateFilePath()
    const now = Date.now()
    if (cached.path !== p || now - cached.at > FILE_READ_TTL_MS) {
      let level: DegradationLevel | null = null
      try {
        const raw = readFileSync(p, "utf8")
        const parsed = JSON.parse(raw) as { level?: unknown }
        if (isDegradationLevel(parsed.level)) level = parsed.level
      } catch {
        level = null
      }
      cached = { path: p, level, at: now }
    }
    return cached.level
  },
  write(level: DegradationLevel): boolean {
    try {
      const payload = JSON.stringify({ level, updatedAt: new Date().toISOString() })
      writeFileSync(stateFilePath(), payload, "utf8")
      cached = { path: stateFilePath(), level, at: Date.now() }
      return true
    } catch {
      return false
    }
  },
}

/** 幂等安装：服务端入口（proxy.ts / api 路由）调用一次即可。 */
export function installResiliencePersistence(): void {
  configureResiliencePersistence(persistence)
}
