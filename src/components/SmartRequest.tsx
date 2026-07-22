"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles } from "lucide-react"

export default function SmartRequest() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/llm-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
      router.push("/demands/new")
    } catch {
      router.push("/demands/new")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative">
        <Textarea
          placeholder="描述您的需求，例如：马桶堵了、空调不制冷、腰疼想按摩..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[80px] resize-none pr-32 text-base"
          rows={2}
        />
        <div className="absolute bottom-3 right-3">
          <Button type="submit" disabled={loading || !text.trim()}>
            {loading ? "匹配中..." : "立即匹配"}
          </Button>
        </div>
      </div>
    </form>
  )
}
