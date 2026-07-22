"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, MicOff } from "lucide-react"
import toast from "react-hot-toast"

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void
  onListeningStateChange?: (isListening: boolean) => void
}

export default function VoiceMicButton({
  onTranscript,
  onListeningStateChange,
}: VoiceMicButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        setIsSupported(false)
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "zh-CN"

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript
        if (resultText) {
          onTranscript(resultText)
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        onListeningStateChange?.(false)
      }

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error, event.message ?? "")
        setIsListening(false)
        onListeningStateChange?.(false)
        if (event.error === "not-allowed") {
          toast.error("麦克风权限被拒绝，请在浏览器设置中允许麦克风访问")
        } else if (event.error === "no-speech") {
          toast.error("未检测到语音，请重试")
        } else {
          toast.error("语音转文字不可用，请手动输入")
        }
      }

      recognitionRef.current = recognition
    }
  }, [onTranscript, onListeningStateChange])

  const toggleListening = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    if (!isSupported || !recognitionRef.current) {
      toast.error("当前浏览器不支持语音输入")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      toast.error("麦克风不可用，请检查权限设置后重试")
      return
    }

    try {
      recognitionRef.current.start()
      setIsListening(true)
      onListeningStateChange?.(true)
    } catch {
      toast.error("语音识别启动失败，请重试")
    }
  }

  if (!isSupported) {
    return (
      <button
        type="button"
        title="当前浏览器不支持语音输入"
        className="p-2 text-gray-300 cursor-not-allowed"
        disabled
      >
        <MicOff className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="relative flex items-center justify-center">
      {isListening && (
        <>
          <span className="absolute inline-flex h-10 w-10 rounded-full opacity-35 animate-ping bg-indigo-400" />
          <span className="absolute inline-flex h-8 w-8 rounded-full opacity-25 animate-pulse bg-indigo-300" />
        </>
      )}

      <button
        type="button"
        onClick={toggleListening}
        className={`relative z-10 p-2 rounded-full transition-all duration-300 focus:outline-none ${
          isListening
            ? "bg-indigo-100 text-indigo-600 scale-110 shadow-lg"
            : "text-gray-400 hover:text-indigo-500 hover:bg-gray-50 active:scale-95"
        }`}
        title={isListening ? "正在倾听，点击可停止" : "语音输入需求"}
      >
        <Mic className={`w-5 h-5 ${isListening ? "stroke-[2.5px]" : "stroke-[1.8px]"}`} />
      </button>
    </div>
  )
}
