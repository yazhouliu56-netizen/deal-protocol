/** 语音闭环类型定义（L1 语音输入/输出 + L2 意图层 + 留证元数据）。 */

/** 语音来源角色。 */
export type VoiceSide = "user" | "assistant";

/**
 * 语音留证元数据（IndexedDB 存储，纯本地）。
 * audioStore 只存 Clip（blob 引用）；文本转录 + 关联信息由调用方写入。
 */
export interface VoiceClip {
  /** uuid（同 chat message id 可关联，但独立生成）。 */
  id: string;
  side: VoiceSide;
  /** ASR 转录文本（assistant 侧为播报文本本身）。 */
  text: string;
  /** 触发时刻（epoch ms）。 */
  ts: number;
  /** 关联的 chat message id（可空 —— 引导/播报不留证）。 */
  msgId?: string;
  /** 关联的 wave id（纠纷取证时挂到凭证区）。 */
  waveId?: string;
  /** 录音时长（ms，assistant 侧为合成音频时长）。 */
  durationMs?: number;
  /** 录音 blob（WebM/MP4）—— 浏览器音频格式，node 环境不可用。 */
  blob?: Blob;
}

/** 语音意图（L2）：LLM 结构化输出 → 本地校验的动作表。 */
export type VoiceIntent =
  | { kind: "publish-wave"; wave: PublishWaveIntent }
  | { kind: "query-waves" }
  | { kind: "chat" };

/** 语音发布局的字段（与 CreateWaveInput.basics 对齐）。 */
export interface PublishWaveIntent {
  category: string;
  time: string;
  area: string;
  budget: number;
  capacity: number;
}

/** 客户端语音链路状态。 */
export type VoicePhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "speaking"
  | "error";

/** VoiceBar 事件（供 ChatPage 消费）。 */
export interface VoiceBarEvent {
  type: "text" | "tts" | "error";
  /** type=text：识别结果文本；type=tts：要播报的文本；type=error：错误提示。 */
  text?: string;
}