"use client";
import { useEffect } from "react";
import { toast } from "@/base/platform/toast";
import type { ResponderCapability } from "@/base/dispatch/broadcast";
import { BOT_RESPONSE_DELAY_MS, scheduleBotResponse } from "@/base/platform/sandbox-bot";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";

const SANDBOX_BOT_ENABLED = true;

export default function SandboxBotHost() {
  const waves = useWaveStore((s) => s.waves);
  const claims = useWaveStore((s) => s.claims);
  const me = useIdentityStore((s) => s.identity.id);
  useEffect(() => {
    if (!SANDBOX_BOT_ENABLED) return;
    try { if (window.localStorage.getItem("oto-sandbox-bot") === "off") return; } catch {}
    const botActions = {
      getLatestWave: (id: string) => useWaveStore.getState().waves.find((x) => x.id === id),
      hasClaimForWave: (id: string) => useWaveStore.getState().claims.some((c) => c.waveId === id),
      registerResponder: (cap: ResponderCapability) => useWaveStore.getState().registerResponder(cap),
      openClaim: (p: { waveId: string; responderId: string; price: number; note?: string }) => useWaveStore.getState().openClaim(p),
      acceptClaim: (claimId: string) => useWaveStore.getState().acceptClaim(claimId),
      joinSeat: (p: { waveId: string; responderId: string }) => useWaveStore.getState().joinSeat(p),
    };
    for (const w of waves) {
      if (w.authorId !== me || w.status !== "active" || w.removed) continue;
      if (claims.some((c) => c.waveId === w.id)) continue;
      scheduleBotResponse(w.id, botActions, BOT_RESPONSE_DELAY_MS, (res) => { if (res.success && res.personaName) toast(`🤖 ${res.personaName}已接单 · 到行程查看进度`, "success"); });
    }
  }, [waves, claims, me]);
  return null;
}
