"use client";
import type { Dispatch, RefObject } from "react";
import { motion } from "framer-motion";
import { Mic, Send } from "lucide-react";
import VoiceBar from "@/components/oto-ui/VoiceBar";

interface ChatInputBarProps {
  /** 首页融合座舱模式（间距 mt-2.5；独立屏 mt-3）。 */
  compact?: boolean;
  input: string;
  onInputChange: Dispatch<React.SetStateAction<string>>;
  /** IME composing 守卫 ref（中文输入法选字回车不触发发送）。 */
  composingRef: RefObject<boolean>;
  streaming: boolean;
  onSubmitText: (text: string) => void;
  onVoiceEvent: (e: { type: "text" | "tts" | "error"; text?: string }) => void;
  showVoiceHint: boolean;
  onVoiceHintSeen: () => void;
}

/**
 * 底部语音输入条：文本输入（IME composing 守卫）+ 发送 + 按住说话 VoiceBar +
 * P2-4 首次语音提示气泡。（ChatPage 内嵌渲染段子组件化搬移，selector/DOM 零漂移。）
 */
export default function ChatInputBar({
  compact = false,
  input,
  onInputChange: setInput,
  composingRef,
  streaming,
  onSubmitText: handleSend,
  onVoiceEvent,
  showVoiceHint,
  onVoiceHintSeen: markVoiceSeen,
}: ChatInputBarProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // 中文输入法选字回车（IME composing）不触发发送
        if (composingRef.current) return;
        handleSend(input);
      }}
      className={`flex items-center gap-2 relative ${compact ? "mt-2.5" : "mt-3"}`}
    >
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onCompositionStart={() => (composingRef.current = true)}
        onCompositionEnd={() => (composingRef.current = false)}
        name="ai-demand-input"
        placeholder="描述你的需求，比如：周六下午 2 人羽毛球"
        className="flex-1 min-w-0 px-4 py-3 rounded-2xl glass-panel outline-none text-xs placeholder:text-white/35"
        enterKeyHint="send"
      />
      <button
        type="submit"
        disabled={streaming || !input.trim()}
        aria-label="发送"
        className="w-11 h-11 shrink-0 rounded-2xl btn-primary glow-purple-strong flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-[filter,transform]"
      >
        <Send size={16} />
      </button>
      <VoiceBar onEvent={onVoiceEvent} disabled={streaming} />
      {/* P2-4 首次语音提示气泡 */}
      {showVoiceHint && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute right-0 -top-10 z-10 px-2.5 py-1.5 rounded-xl bg-brandPurple/30 border border-brandPurple/50 text-xs font-bold text-white/90 flex items-center gap-1.5 whitespace-nowrap pointer-events-none"
        >
          <Mic size={10} className="text-brandCyan" />
          按住说话 · 自动发布/查局
          <button
            onClick={markVoiceSeen}
            className="ml-1 px-2 py-1 min-h-8 pointer-events-auto text-white/50 hover:text-white underline underline-offset-2"
          >
            知道了
          </button>
        </motion.div>
      )}
    </form>
  );
}
