import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function getRoleFromCookie(cookieValue: string): string | null {
  try {
    const raw = decodeURIComponent(cookieValue)
    const b64 = raw.replace(/^base64-/, '')
    const json = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')))
    const token = json.access_token as string
    if (!token) return null
    const payload = decodeJwtPayload(token)
    return (payload?.user_metadata as Record<string, unknown> | undefined)?.role as string ?? null
  } catch {
    return null
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url)

  if (pathname === '/login' || pathname === '/register' || pathname === '/' || pathname.startsWith('/api/') || pathname === '/sw.js' || pathname === '/manifest.webmanifest' || pathname === '/icon-512.png') {
    return NextResponse.next()
  }

  const authCookie = request.cookies.get('sb-eixqnwaxcnwtxiizmdfs-auth-token')
  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Admin route guard: verify role server-side
  if (pathname.startsWith('/admin')) {
    const role = getRoleFromCookie(authCookie.value)
    if (role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon-512\\.png).*)'],
}
