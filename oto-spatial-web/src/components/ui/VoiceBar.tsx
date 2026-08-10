"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { recognizeSpeech } from "@/lib/voice/asrClient";
import { clipMeta, saveClip } from "@/lib/voice/audioStore";
import type { VoiceBarEvent, VoicePhase } from "@/lib/voice/types";

/**
 * VoiceBar：按住说话 → MediaRecorder 录音 → ASR（GLM-ASR → Web Speech）
 * → 识别文本回传（onText）→ 调用方走现有 ChatPage 链路。
 * 录音 blob 按证据链留存（user 侧，含转录文本，本地 IndexedDB）。
 * 降级：无麦克风/拒绝权限 → 直接落 Web Speech 识别。
 */
export default function VoiceBar({
  onEvent,
  disabled,
}: {
  onEvent: (e: VoiceBarEvent) => void;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const holdingRef = useRef(false);
  const startAtRef = useRef(0);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  const stopRecording = () => {
    holdingRef.current = false;
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const startRecording = async () => {
    if (disabled || phase !== "idle") return;
    setPhase("recording");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("no-media-support");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      const startAt = 0;
      startAtRef.current = startAt;
      rec.ondataavailable = (e) => {
        if (startAtRef.current === 0) startAtRef.current = Date.now();
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void handleBlob();
      };
      rec.start();
      recorderRef.current = rec;
    } catch {
      // 无麦克风/拒绝权限：直接落 Web Speech 实时识别。
      setPhase("transcribing");
      try {
        const text = await recognizeSpeech(null, { preferWebSpeech: true });
        onEvent({ type: "text", text });
        setPhase("idle");
        return;
      } catch {
        onEvent({ type: "error", text: "语音不可用：无麦克风且浏览器不支持语音识别" });
        setPhase("idle");
        return;
      }
    }
  };

  const handleBlob = async () => {
    const chunks = chunksRef.current;
    if (holdingRef.current || chunks.length === 0) {
      setPhase("idle");
      return;
    }
    setPhase("transcribing");
    try {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const text = await recognizeSpeech(blob);
      const clip = clipMeta({
        side: "user",
        text,
        ts: startAtRef.current || Date.now(),
        durationMs: Date.now() - startAtRef.current,
      });
      clip.blob = blob;
      await saveClip(clip);
      onEvent({ type: "text", text });
    } catch {
      onEvent({ type: "error", text: "没听清，换个说法再来一次？" });
    } finally {
      setPhase("idle");
    }
  };

  return (
    <button
      type="button"
      aria-label="按住说话"
      disabled={disabled || phase === "transcribing"}
      onPointerDown={() => void startRecording()}
      onPointerUp={() => stopRecording()}
      onPointerLeave={() => stopRecording()}
      onContextMenu={(e) => e.preventDefault()}
      className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-[filter,transform,background] active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
        phase === "recording"
          ? "bg-red-500/90 glow-cyan"
          : phase === "transcribing"
            ? "bg-brandCyan/30"
            : "glass-panel text-brandCyan hover:text-white"
      }`}
    >
      {phase === "recording" ? (
        <Square size={14} className="text-white animate-pulse" />
      ) : phase === "transcribing" ? (
        <MicOff size={14} className="text-white/70 animate-pulse" />
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
}