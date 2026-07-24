"use client"

import { useState, useRef, useCallback } from "react"
import { Mic, Square, Loader2, Sparkles, AlertCircle } from "lucide-react"
import toast from "react-hot-toast"

interface VoiceInputProps {
  onProtocolExtracted?: (text: string, protocol: Record<string, unknown>) => void
}

export default function VoiceInput({ onProtocolExtracted }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  if (typeof window !== "undefined" && !recognitionRef.current) {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = "zh-CN"

      recognition.onresult = (event: any) => {
        let finalText = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          finalText += event.results[i][0].transcript
        }
        setTranscript(finalText)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognition.onerror = (event: any) => {
        setIsRecording(false)
        if (event.error === "not-allowed") {
          toast.error("麦克风权限被拒绝")
        } else if (event.error === "no-speech") {
          toast.error("未检测到语音")
        }
      }

      recognitionRef.current = recognition
    } else {
      setIsSupported(false)
    }
  }

  const handleStartRecording = useCallback(async () => {
    if (!recognitionRef.current) {
      toast.error("当前浏览器不支持语音输入")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
    } catch {
      toast.error("麦克风不可用")
      return
    }

    setTranscript("")
    setIsRecording(true)
    try {
      recognitionRef.current.start()
    } catch {
      toast.error("语音识别启动失败")
      setIsRecording(false)
    }
  }, [])

  const handleStopRecording = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const handleProcessTranscript = useCallback(async () => {
    if (!transcript.trim()) return

    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append("rawText", transcript)

      const res = await fetch("/api/ai/asr", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (!data.success) {
        toast.error(data.error || "协议提取失败")
        return
      }

      onProtocolExtracted?.(data.text, data.protocol)
      toast.success("语音协议提取成功")
    } catch {
      toast.error("网络异常，协议提取失败")
    } finally {
      setIsProcessing(false)
    }
  }, [transcript, onProtocolExtracted])

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-950/20 border border-amber-900/30 text-amber-400 text-xs">
        <AlertCircle className="size-4 shrink-0" />
        <span>当前浏览器不支持语音输入（推荐 Chrome）</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
      <div className="flex items-center gap-3">
        {!isRecording ? (
          <button
            type="button"
            onClick={handleStartRecording}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-50"
            disabled={isProcessing}
          >
            <Mic className="size-4" />
            按住说话
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopRecording}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition animate-pulse"
          >
            <Square className="size-4" />
            停止录音
          </button>
        )}

        {transcript && (
          <button
            type="button"
            onClick={handleProcessTranscript}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isProcessing ? "协议提取中..." : "提取协议"}
          </button>
        )}
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          正在录音...
        </div>
      )}

      {transcript && (
        <div className="p-3 rounded-lg bg-zinc-800 border border-zinc-700">
          <p className="text-xs text-zinc-400 mb-1">识别文本：</p>
          <p className="text-sm text-zinc-100">{transcript}</p>
        </div>
      )}
    </div>
  )
}
