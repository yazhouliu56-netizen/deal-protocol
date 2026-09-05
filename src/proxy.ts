import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import {
  classifyApiPath,
  evaluateDegradationGate,
  getGlobalDegradationLevel,
  DEGRADATION_ERROR_MESSAGES,
} from "@/base/platform/resilience"
import { installResiliencePersistence } from "@/lib/resilience-state"

installResiliencePersistence()

/** 容灾控制面通道永远放行（否则 READ_ONLY 下管理员无法恢复）。 */
const RESILIENCE_ADMIN_PATH = "/api/admin/resilience"

/**
 * 容灾网关（L6-M3）：在认证之前拦截 /api/* 请求，按全局容灾等级输出
 * 确定性 503/429 降级响应。SOS 与在途履约在任何非 READ_ONLY 等级下免死。
 */
function degradationResponse(request: NextRequest, status: number, errorCode: string, retryAfterSeconds?: number) {
  const headers: Record<string, string> = {
    "x-degradation-level": getGlobalDegradationLevel(),
    "x-degradation-code": errorCode,
    "content-type": "application/json; charset=utf-8",
  }
  if (retryAfterSeconds !== undefined) headers["retry-after"] = String(retryAfterSeconds)
  return new NextResponse(
    JSON.stringify({
      error: "SERVICE_DEGRADED",
      code: errorCode,
      message: DEGRADATION_ERROR_MESSAGES[errorCode] ?? "服务暂不可用，请稍后再试",
      degradedLevel: getGlobalDegradationLevel(),
    }),
    { status, headers },
  )
}

function isProtectedRoute(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/" ||
    pathname === "/m20" ||
    pathname === "/f20" ||
    pathname === "/lab" ||
    pathname.startsWith("/m20/") ||
    pathname.startsWith("/f20/") ||
    pathname.startsWith("/lab/") ||
    pathname.startsWith("/api/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon-512.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/_next/")
  ) {
    return false
  }
  return true
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ---- 容灾网关（L6-M3）：仅拦截 API 流量，静态资源/页面路由放行 ----
  if (pathname.startsWith("/api/") && pathname !== RESILIENCE_ADMIN_PATH) {
    const category = classifyApiPath(pathname, request.method)
    const decision = evaluateDegradationGate(getGlobalDegradationLevel(), category)
    if (!decision.isAllowed) {
      return degradationResponse(
        request,
        decision.httpStatus ?? 503,
        decision.errorCode ?? "SERVICE_DEGRADED",
        decision.retryAfterSeconds,
      )
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (isProtectedRoute(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith("/admin")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile?.role !== "admin") {
        const url = request.nextUrl.clone()
        url.pathname = "/dashboard"
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon-512\\.png|icon-192\\.png).*)",
  ],
}
