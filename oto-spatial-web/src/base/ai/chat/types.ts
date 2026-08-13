/** ChatEngine contract — pluggable: MockEngine (local rules) now, LLMEngine later. */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Generated UI cards embedded in the conversation (M2). */
  cards?: GenCard[];
}

export interface TimeslotSlot {
  id: string;
  label: string;
  sub?: string;
  /** Demand density 0-100: >=75 热门 / <=30 空闲. */
  density?: number;
}

export interface ProviderItem {
  id: string;
  name: string;
  emoji: string;
  meta: string;
  rating: number;
  price: string;
  tag?: string;
  /** Numeric price used by the matching algorithm. */
  basePrice?: number;
  /** Skill tier for badminton matching (球友 only). */
  level?: "newbie" | "amateur" | "advanced";
  /** Photography style for 约拍 matching. */
  styleTag?: string;
  /** Venues are level-agnostic (always matchable). */
  kind?: "venue";
  /** Distance to the user (km) for distance matching. */
  distanceKm?: number;
  /** Slot ids this provider is available for; absent = all slots. */
  freeSlots?: string[];
}

/** Matchmaking result attached to a provider card (M6). */
export interface MatchResult {
  score: number;
  badge: "极高匹配" | "高匹配" | "中等" | "待考虑";
}

export interface ConfirmLine {
  k: string;
  v: string;
}

/** Generated UI cards rendered inline inside the chat stream. */
export type GenCard =
  | {
      type: "timeslot";
      id: string;
      title: string;
      slots: TimeslotSlot[];
    }
  | {
      type: "provider";
      id: string;
      title: string;
      providers: ProviderItem[];
      note?: string;
    }
  | {
      type: "confirm";
      id: string;
      title: string;
      lines: ConfirmLine[];
      price: string;
    }
  | {
      type: "success";
      id: string;
      title: string;
      lines: ConfirmLine[];
      price: string;
    };

export type ChatEvent =
  | { type: "typing" }
  | { type: "text"; delta: string }
  | { type: "card"; card: GenCard }
  | { type: "done" };

export interface ChatEngine {
  send(userMessage: string): AsyncIterable<ChatEvent>;
  /** Card-driven interaction (M2): user tapped a generated card. */
  select(cardId: string): AsyncIterable<ChatEvent>;
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
