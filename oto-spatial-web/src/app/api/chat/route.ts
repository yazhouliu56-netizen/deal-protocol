import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const API_KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/**
 * Server-side proxy for the Gemini OpenAI-compatible chat completions API.
 * Keeps the API key out of the client bundle and streams SSE back.
 * Fails fast (non-200) so the client can fall back to MockEngine.
 */
export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

  let body: { messages?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const upstream = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: body.messages,
      temperature: 0.4,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${text.slice(0, 300)}` },
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "no stream body" }, { status: 502 });
  }

  // Pipe the SSE stream straight through (text/event-stream).
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}