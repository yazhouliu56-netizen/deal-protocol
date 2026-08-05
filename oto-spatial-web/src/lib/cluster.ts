/**
 * LLM 聚类推送 — cluster a fresh demand against responder capabilities and
 * deliver a radar push to the best-fit responders.
 *
 *   LLM step (server /api/cluster): extracts semantic tags from the demand
 *   text (category + customs + negotiation note), e.g. "上门做饭"/"30岁生日".
 *   Without a live LLM the mock extractor below is deterministic.
 *
 *   Cluster step (pure, here): the LLM tags enrich the wave's custom tags,
 *   then the injected matcher (broadcastMatches from the caller — keeps this
 *   file free of runtime relative imports) hard-filters and scores responders
 *   (distance 30 / custom 25 / credit 30) → PushItems.
 *
 * Pure + unit-testable.
 */

import type {
  BroadcastHit,
  ResponderCapability,
  WaveLike,
} from "./broadcast";

export type MatchFn = (
  responders: ResponderCapability[],
  wave: WaveLike
) => BroadcastHit[];

export interface PushItem {
  id: string;
  waveId: string;
  /** Recipient responder identity. */
  toId: string;
  score: number;
  customHits: number;
  customTotal: number;
  reason: string;
  /** The semantic tag this responder actually hit (first match). */
  tag?: string;
  at: number;
  read: boolean;
}

const NOTE_TAGS: Array<[RegExp, string]> = [
  [/生日|寿宴|生辰|庆生/i, "生日"],
  [/上门|到点|按时/i, "上门服务"],
  [/急|加急|马上|尽快/i, "加急"],
  [/便宜|划算|优惠|砍价/i, "高性价比"],
  [/今晚|今天|马上/i, "即时"],
  [/周末|周六|周日/i, "周末"],
  [/专业|有经验|老手/i, "专业"],
  [/耐心|细致|温柔/i, "细心"],
];

/** Deterministic tag extraction (mock path; server may replace with LLM). */
export function mockClusterTags(wave: {
  category: string;
  customs?: Array<{ text: string; tags?: string[] }>;
  negotiableNote?: string;
}): string[] {
  const tags = new Set<string>();
  const cat = wave.category.replace(/.*?[·|、]/g, "").trim();
  if (cat && cat.length <= 6) tags.add(cat);
  for (const c of wave.customs ?? []) {
    for (const t of c.tags ?? []) {
      if (t && t.length <= 6) tags.add(t);
    }
    const m = c.text.match(/[\u4e00-\u9fa5]{2,6}/g);
    for (const w of m ?? []) {
      if (/岁|生日|宴|上门|小时|一次/.test(w)) tags.add(w);
    }
  }
  const note = wave.negotiableNote ?? "";
  for (const [re, tag] of NOTE_TAGS) {
    if (re.test(note)) tags.add(tag);
  }
  return [...tags].slice(0, 8);
}

/** Enrich the wave's custom tags with LLM-extracted semantics (dedup). */
export function enrichWaveTags(wave: WaveLike, llmTags: string[]): WaveLike {
  if (llmTags.length === 0) return wave;
  const customs = (wave.customs ?? []).map((c) => ({
    ...c,
    tags: [...new Set([...(c.tags ?? []), ...llmTags])],
  }));
  return {
    ...wave,
    customs:
      customs.length > 0
        ? customs
        : [{ text: llmTags.join("、"), tags: llmTags }],
  };
}

/** Cluster a wave against responders → radar push items (best-fit only). */
export function buildPushes(
  wave: WaveLike & { id: string; authorId?: string },
  responders: ResponderCapability[],
  llmTags: string[],
  matches: MatchFn,
  at = Date.now()
): PushItem[] {
  const enriched = enrichWaveTags(wave, llmTags);
  const hits = matches(responders, enriched);
  const customTags = new Set(enriched.customs?.flatMap((c) => c.tags ?? []) ?? []);
  return hits
    .filter((h) => h.id !== wave.authorId)
    .sort((a, b) => b.score - a.score)
    .map((h, i) => {
      const resp = responders.find((r) => r.id === h.id);
      const respTags = new Set(resp?.tags ?? []);
      const hitTag =
        llmTags.find((t) => respTags.has(t)) ??
        [...customTags].find((t) => respTags.has(t)) ??
        llmTags[0];
      return {
        id: `push-${wave.id}-${h.id}`,
        waveId: wave.id,
        toId: h.id,
        score: h.score,
        customHits: h.customHits,
        customTotal: h.customTotal,
        reason: pushReason(h, hitTag),
        tag: hitTag,
        at: at + i, // stable order in the inbox
        read: false,
      };
    });
}

/** Human reason line for the radar card. */
export function pushReason(hit: BroadcastHit, tag?: string): string {
  const parts: string[] = [];
  if (hit.customHits > 0) {
    const label = tag ?? "定制条件";
    parts.push(`命中标签「${label}」×${hit.customHits}`);
  }
  parts.push(
    hit.distanceKm != null ? `距离 ${hit.distanceKm} 公里内` : "距离合适"
  );
  parts.push(`信用 Lv.${hit.creditLevel ?? 3}`);
  return parts.join(" · ");
}
