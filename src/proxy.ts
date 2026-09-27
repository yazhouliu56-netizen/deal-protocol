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
    pathname === "/landing" ||
    pathname === "/dp/login" ||
    pathname === "/offline" ||
    pathname.startsWith("/m20/") ||
    pathname.startsWith("/f20/") ||
    pathname.startsWith("/lab/") ||
    pathname.startsWith("/api/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/icon-512.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-maskable-512.png" ||
    pathname === "/oto-icon-192.png" ||
    pathname === "/oto-icon-512.png" ||
    pathname.startsWith("/models/") ||
    pathname.startsWith("/mascots/") ||
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

  // 沙盒降级（2026-09-27 CI 血训）：Supabase env 缺席（CI/离线沙盒）时，
  // createServerClient 会同步抛错导致全站 500。本仓其余链路早已是
  // "无 DB 即降级"姿态，网关看齐：无会话按匿名走，保护路由照旧跳登录。
  type SessionUser = { id: string } | null;
  let user: SessionUser = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
      });

      user = (await supabase.auth.getUser()).data.user as SessionUser;

      if (user && isProtectedRoute(pathname) && pathname.startsWith("/admin")) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role !== "admin") {
          const url = request.nextUrl.clone();
          // 存活路由：/dashboard 不存在，非管理员回首页。
          url.pathname = "/";
          return NextResponse.redirect(url);
        }
      }
    } catch {
      // 会话解析失败即按匿名处理（不抛全站 500）。
      user = null;
    }
  }

  if (isProtectedRoute(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon-512\\.png|icon-192\\.png|icon-maskable-512\\.png|oto-icon-192\\.png|oto-icon-512\\.png|models/|mascots/).*)",
  ],
}
