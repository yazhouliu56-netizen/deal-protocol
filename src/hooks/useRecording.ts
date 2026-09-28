"use client";

/**
 * 一键录音会话钩子（R-0928-08 B 档自保；A 档自动触发由后端节点流驱动，另路）。
 * MediaRecorder 本地采集 → 停止即 POST /api/guard/recording 落盘＋存证锚。
 * 麦克风拒绝/无设备 → 错误态（调用方降级文字＋拍照，宪法 #10）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { decideStop, type RecordingTier } from "@/base/safe/recording";

export type RecordingPhase = "idle" | "recording" | "uploading" | "sealed" | "error";

export interface UseRecordingOptions {
  tier?: RecordingTier;
  demandId?: string | null;
}

function pickMime(): string | null {
  try {
    const MR = window.MediaRecorder;
    if (!MR) return null;
    if (typeof MR.isTypeSupported === "function") {
      if (MR.isTypeSupported("audio/webm")) return "audio/webm";
      if (MR.isTypeSupported("audio/mp4")) return "audio/mp4";
    }
    return "audio/webm";
  } catch {
    return null;
  }
}

export function useRecording(opts: UseRecordingOptions = {}) {
  const tier = opts.tier ?? "B";
  const demandId = opts.demandId ?? null;
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
    recRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    if (tier === "C") {
      setError("C 档禁音：只留 GPS 与文字");
      setPhase("error");
      return false;
    }
    setError(null);
    setLocked(false);
    const mime = pickMime();
    if (!mime) {
      setError("设备不支持录音，已降级");
      setPhase("error");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start(1000);
      recRef.current = rec;
      startedAtRef.current = Date.now();
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
      return true;
    } catch {
      setError("麦克风被拒绝，已降级为文字＋拍照自保");
      setPhase("error");
      return false;
    }
  }, [tier]);

  const stop = useCallback(async (): Promise<boolean> => {
    const verdict = decideStop({ tier, state: phase === "recording" ? "RECORDING" : "IDLE", manual: true });
    if (verdict.action === "deny") {
      // A 档授权后不可逆：拒绝＋锁定态（tamper 留痕由后端节点流记，另路）。
      setLocked(true);
      setError("录音保护中（完工自动关）");
      return false;
    }
    if (verdict.action === "noop") return false;
    const rec = recRef.current;
    setPhase("uploading");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const blob: Blob = await new Promise((resolve) => {
      if (!rec || rec.state === "inactive") {
        resolve(new Blob(chunksRef.current));
        return;
      }
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || undefined }));
      try {
        rec.stop();
      } catch {
        resolve(new Blob(chunksRef.current));
      }
    });
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
    recRef.current = null;
    try {
      const fd = new FormData();
      fd.append("file", blob, `guard-${Date.now()}.webm`);
      fd.append("tier", tier);
      if (demandId) fd.append("demandId", demandId);
      fd.append("startedAtMs", String(startedAtRef.current));
      const res = await fetch("/api/guard/recording", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      setPhase("sealed");
      return true;
    } catch {
      setError("录音上传失败，请重试");
      setPhase("error");
      return false;
    }
  }, [tier, phase, demandId]);

  return { phase, seconds, error, locked, start, stop };
}
