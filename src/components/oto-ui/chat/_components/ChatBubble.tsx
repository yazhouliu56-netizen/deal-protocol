"use client";
import { motion } from "framer-motion";
import { Bot, Volume2 } from "lucide-react";
import type { ChatMessage } from "@/base/ai/chat/types";
import { speak } from "@/adapters/ai/voice/ttsClient";
import { GenCardView } from "./ChatMessageCards";

/**
 * 消息流气泡区：单条对话气泡（用户/AI 双形态 + 流式 typing 光标 + 重播语音 +
 * 生成卡片挂载）。（ChatPage 内嵌渲染段子组件化搬移，selector/DOM 零漂移。）
 */
export function ChatBubble({
  message,
  isLatest = false,
  onCardSelect,
  onBook,
  onConvertToWave,
}: {
  message: ChatMessage;
  isLatest?: boolean;
  onCardSelect: (cardId: string) => void;
  onBook: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
  onConvertToWave: (msgId: string, lines: { k: string; v: string }[], price: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
    >
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        {!isUser && (
          <div className="w-7 h-7 mr-2 mt-0.5 rounded-xl glass-panel flex items-center justify-center shrink-0">
            <Bot size={13} className="text-brandPurple" />
          </div>
        )}
        {message.content && (
          <div
            className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed whitespace-pre-wrap break-words ${
              isUser
                ? "btn-primary text-white shadow-lg"
                : "glass-panel text-white/90"
            }`}
          >
            {message.content}
            {!isUser && isLatest && <span className="typing-caret" />}
          </div>
        )}
      </div>
      {!isUser && message.content && !isLatest && (
        <button
          onClick={() => void speak(message.content ?? "")}
          aria-label="重播语音"
          className="ml-9 mt-1 rounded-full px-2 py-0.5 glass-panel text-xs text-brandCyan hover:text-white flex items-center gap-1 transition-colors"
        >
          <Volume2 size={9} /> 重播
        </button>
      )}
      {message.cards?.map((card) => (
        <GenCardView
          key={card.id}
          card={card}
          msgId={message.id}
          onCardSelect={onCardSelect}
          onBook={onBook}
          onConvertToWave={onConvertToWave}
        />
      ))}
    </motion.div>
  );
}

/** AI 思考中指示气泡（三点弹跳）。 */
export function ThinkingDot() {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 mr-2 mt-0.5 rounded-xl glass-panel flex items-center justify-center shrink-0">
        <Bot size={13} className="text-brandPurple" />
      </div>
      <div className="px-4 py-3 rounded-2xl glass-panel flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brandPurple animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
