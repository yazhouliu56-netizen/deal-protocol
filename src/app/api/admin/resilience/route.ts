import { appendFileSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import {
  DEGRADATION_LEVELS,
  describeDegradationRules,
  getGlobalDegradationLevel,
  isDegradationLevel,
  setGlobalDegradationLevel,
  type DegradationLevel,
} from "@/base/platform/resilience"
import { installResiliencePersistence } from "@/lib/resilience-state"

installResiliencePersistence()

const AUDIT_FILE = join(process.cwd(), ".resilience-audit.jsonl")

function appendAudit(entry: { level: DegradationLevel; by: string; at: string }) {
  try {
    appendFileSync(AUDIT_FILE, `${JSON.stringify(entry)}\n`, "utf8")
  } catch {
    // 审计失败不阻断容灾切换（控制面优先）
  }
}

function withAdmin(
  handler: (req: Request, user: { id: string; email?: string | null; [k: string]: unknown }) => Promise<NextResponse>,
) {
  return withAuth(async (req, user) => {
    if (user.role !== "ADMIN" && user.role !== "admin") {
      return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 })
    }
    return handler(req, user)
  })
}

/**
 * 容灾控制面（L6-M3）：管理员毫秒级切换全局降级等级。
 * GET  ➔ 当前等级 + 可用等级 + 拦截规则矩阵；
 * POST ➔ 校验 ADMIN 后切换等级 + 审计日志。
 */
export const GET = withAdmin(async () => {
  const level = getGlobalDegradationLevel()
  return NextResponse.json({
    level,
    availableLevels: DEGRADATION_LEVELS,
    rules: describeDegradationRules(level),
  })
})

export const POST = withAdmin(async (req, user) => {
  let body: { level?: unknown } = {}
  try {
    body = (await req.json()) as { level?: unknown }
  } catch {
    return NextResponse.json({ error: "请求体必须为 JSON" }, { status: 400 })
  }
  if (!isDegradationLevel(body.level)) {
    return NextResponse.json(
      { error: "非法容灾等级", availableLevels: DEGRADATION_LEVELS },
      { status: 400 },
    )
  }

  const { level, persisted } = setGlobalDegradationLevel(body.level)
  const audit = { level, by: user.email ?? user.id, at: new Date().toISOString() }
  appendAudit(audit)

  return NextResponse.json({
    level,
    persisted,
    availableLevels: DEGRADATION_LEVELS,
    rules: describeDegradationRules(level),
  })
})
