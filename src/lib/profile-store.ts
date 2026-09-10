/**
 * 画像 IO（补丁 C1）：localStorage 持久化，base/memory/profile 只留纯函数
 * （底座纯度门禁：存储禁直用，IO 落 lib）。
 * SSR/隐私模式安全，失败静默。
 */
import { PROFILE_KEY, type UserProfile } from "@/base/memory/profile";

export function loadProfile(): UserProfile | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as UserProfile;
    if (!p || typeof p.updatedAt !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(p: UserProfile): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {}
}

export function forgetProfileKey(key: "timePref" | "priceSense" | "noteHabit"): void {
  const p = loadProfile();
  if (!p) return;
  const next = { ...p, updatedAt: Date.now() };
  delete next[key];
  saveProfile(next);
}
