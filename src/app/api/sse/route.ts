import { subscribeToEvents } from "@/lib/event-bus"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const session = await auth(req)
    if (!session?.user?.id) {
      return new Response("unauthorized", { status: 401 })
    }

    const url = new URL(req.url)
    const type = url.searchParams.get("type") || "order"
    const id = url.searchParams.get("id")
    if (!id) return new Response("missing id", { status: 400 })

    const stream = new ReadableStream({
      start(c) {
        const handler = () => {
          try { c.enqueue(`data: ${JSON.stringify({ t: Date.now() })}\n\n`) } catch {}
        }
        const filter = (event: { type: string; id: string }) =>
          event.type === type && event.id === id
        const cleanup = subscribeToEvents(filter, handler)

        req.signal.addEventListener("abort", () => {
          cleanup()
        })

        const keepalive = setInterval(() => {
          try { c.enqueue(`: keepalive\n\n`) } catch {}
        }, 30_000)
        req.signal.addEventListener("abort", () => clearInterval(keepalive))
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch {
    return new Response("internal error", { status: 500 })
  }
}
