"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import NegotiationBox from "./NegotiationBox";
import PaySheet from "./PaySheet";
import { CATEGORY_EMOJI } from "./WaveCard";

/**
 * 发布需求 = 发出一个信号波。
 * 基本要素先快速填（硬过滤），定制条件可选（软加权 + 递增加价），
 * 磋商对话框"内容即开关"。
 * 开放局（人数 ≥ 2）：C 端互相组队拼位 —— 满员成局，人均 = 预算 ÷ 人数。
 */
export default function PublishSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
const publishWave = useWaveStore((s) => s.publishWave);
  const createPendingWave = useWaveStore((s) => s.createPendingWave);
  const payWave = useWaveStore((s) => s.payWave);
  const identity = useIdentityStore((s) => s.identity);

  const [category, setCategory] = useState("");
  const [time, setTime] = useState("");
  const [area, setArea] = useState("幸福家园小区");
  const [budget, setBudget] = useState("100");
  const [customText, setCustomText] = useState("");
  const [customs, setCustoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [deposit, setDeposit] = useState(false);
  const [people, setPeople] = useState(1);
  const [ttl, setTtl] = useState<number>(2 * 3600_000);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<null | { id: string; amount: number }>(null);

  const HOT_HINTS = ["厨师 · 上门做饭", "羽毛球约局", "摄影师约拍", "家政保洁", "陪诊陪护", "拼桌桌游"];

  function reset() {
    setCategory("");
    setTime("");
    setArea("幸福家园小区");
    setBudget("100");
    setCustomText("");
    setCustoms([]);
    setNote("");
    setDeposit(false);
    setPeople(1);
    setError("");
  }

  function publish() {
    if (!category.trim() || !time.trim() || !area.trim()) {
      setError("品类、时间、地点为必填（基本要素）");
      return;
    }
    const budgetNum = parseInt(budget, 10);
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
      setError("预算需为有效金额");
      return;
    }
    // 随单支付：1:1 服务 = 付全款；开放局 = 发起人付自己那份(人均价)。
    const payAmount =
      people >= 2
        ? Math.max(1, Math.round(budgetNum / people))
        : budgetNum;
    const out = createPendingWave({
      authorId: identity.id,
      basics: { category: category.trim(), time: time.trim(), area: area.trim(), radiusKm: 5 },
      budget: budgetNum,
      customs: customs.map((text) => ({
        text,
        tags: text.replace(/[，。！？、\s]/g, "").split(/(?<=[男女老人穿用])|(?=[男女老人穿用JK岁])/).filter(Boolean),
      })),
      negotiable: note.trim().length > 0,
      negotiableNote: note.trim() || undefined,
      deposit,
      capacity: people,
      payAmount,
      expiresAt: Date.now() + ttl,
      hotness: 2 + Math.floor(Math.random() * 2),
    });
    if (out === null) {
      setError("发布被拒：账号已被平台限制（限流/封禁），请稍后或申诉");
      return;
    }
    if (out.removed) {
      // 命中违禁词：内容转入平台审核（不支付、不上线）
      setError("内容命中违禁词，已转入平台审核");
      reset();
      onClose();
      return;
    }
    // 进入模拟收银台：支付成功才激活广播
    setPaying({ id: out.id, amount: out.amount });
  }

  return (
    <>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4 max-h-[72vh] overflow-y-auto no-scrollbar"
          >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-extrabold flex items-center gap-1.5">
            <Send size={13} className="text-brandCyan" /> 发出信号波
          </h3>
          <button
            onClick={onClose}
            aria-label="关闭发布"
            className="text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* 品类快捷 */}
        <div className="flex gap-1.5 flex-wrap mb-2">
          {HOT_HINTS.map((h) => (
            <button
              key={h}
              onClick={() => setCategory(h)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                category === h
                  ? "btn-primary glow-purple-strong"
                  : "glass-panel-interactive text-white/60 hover:text-white"
              }`}
            >
              {CATEGORY_EMOJI(h)} {h}
            </button>
          ))}
        </div>

        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="品类（如：厨师 · 上门做饭）*"
          aria-label="需求品类"
          className="w-full rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-[11px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors mb-2"
        />
        <div className="flex gap-2 mb-2">
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="时间 *（如：明天 11:00）"
            aria-label="需求时间"
            className="flex-1 min-w-0 rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-[11px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors"
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="地点 *"
            aria-label="需求地点"
            className="flex-1 min-w-0 rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-[11px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors"
          />
        </div>
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="基础预算 ¥（如 100）"
          aria-label="基础预算"
          inputMode="numeric"
          className="w-full rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-[11px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors mb-3"
        />

        {/* 定制条件：可选 + 递增加价提示 */}
        <span className="text-[10px] font-semibold text-white/40 flex items-center gap-1 mb-1.5">
          <Sparkles size={10} className="text-brandPurple" /> 定制条件（可选，逐个 +15%）
        </span>
        {customs.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brandPurple/15 border border-brandPurple/40 mb-1.5"
          >
            <span className="text-[11px] text-brandPurple font-bold flex-1 truncate">{c}</span>
            <span className="text-[9px] font-bold text-white/50">+{15 * (i + 1)}%</span>
            <button
              onClick={() => setCustoms(customs.filter((_, j) => j !== i))}
              aria-label={`移除定制 ${c}`}
              className="text-white/40 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex gap-2 mb-2">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="如：30 岁左右女性厨师、穿 JK 装"
            aria-label="定制条件"
            className="flex-1 min-w-0 rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-[11px] placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors"
          />
          <button
            onClick={() => {
              const t = customText.trim();
              if (t && !customs.includes(t)) setCustoms([...customs, t]);
              setCustomText("");
            }}
            className="px-3.5 rounded-2xl glass-panel-interactive text-[11px] font-bold text-brandPurple shrink-0"
          >
            ＋
          </button>
        </div>

        {/* 磋商对话框：内容即开关 */}
        <NegotiationBox
          compact
          value={note}
          onChange={setNote}
          label="磋商留言（可留空）"
          placeholder="想告诉响应者什么？填了就开放磋商，留空则直接接单"
        />

        {/* 开放局：人数 ≥ 2 = 拼位组队（C 端互相找搭子） */}
        <div className="mt-3 rounded-2xl bg-white/[0.04] border border-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-white/85 flex items-center gap-1.5">
              🎯 开放局 · 拼位组队
            </span>
            {people >= 2 && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple">
                满 {people} 人成局 · 人均约 ¥{Math.max(1, Math.round((parseInt(budget, 10) || 0) / people))}
              </span>
            )}
          </div>
          <p className="text-[9px] text-white/40 mb-2">
            1 人 = 普通服务需求；≥ 2 人 = 开放局，你算第 1 位，拼满成局（如羽毛球约局、拼车、拼饭）
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeople(Math.max(1, people - 1))}
              aria-label="减少人数"
              className="w-8 h-8 rounded-xl glass-panel-interactive text-white/70 font-bold text-sm shrink-0"
            >
              −
            </button>
            <span className="flex-1 text-center text-[13px] font-extrabold text-white/90">
              {people}
              <span className="text-[9px] text-white/40 ml-1 font-normal">人（含你）</span>
            </span>
            <button
              onClick={() => setPeople(Math.min(8, people + 1))}
              aria-label="增加人数"
              className="w-8 h-8 rounded-xl glass-panel-interactive text-white/70 font-bold text-sm shrink-0"
            >
              ＋
            </button>
          </div>
        </div>

        {/* 鸽子险：履约保证金 */}
        <button
          onClick={() => setDeposit(!deposit)}
          className="mt-3 w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10"
          aria-label="开启鸽子险"
        >
          <span className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-white/85">🕊️ 鸽子险（双方履约保障）</span>
            <span className="text-[9px] text-white/40 mt-0.5">
              响应者接单冻结 ¥5 押金 · 履约解冻退回 / 爽约赔付给你
            </span>
          </span>
          <span
            className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${
              deposit ? "bg-emerald-400/70" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                deposit ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
        </button>

        {/* 有效期 */}
        <div className="flex gap-1.5 mt-3 mb-3">
          {[
            { label: "2 小时", ms: 2 * 3600_000 },
            { label: "今晚 24 点", ms: 0 },
            { label: "3 天", ms: 3 * 24 * 3600_000 },
          ].map((o) => {
            const active =
              o.ms === 0
                ? ttl === 0
                : ttl === o.ms;
            return (
              <button
                key={o.label}
                onClick={() => setTtl(o.ms === 0 ? 0 : o.ms)}
                className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all ${
                  active
                    ? "btn-primary glow-purple-strong"
                    : "glass-panel text-white/60 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {error && <p className="text-[10.5px] text-red-400 font-semibold mb-2">{error}</p>}

        <button
          onClick={publish}
          className="w-full py-3 rounded-2xl btn-primary font-extrabold text-xs glow-purple-strong hover:brightness-110 active:scale-[0.98] transition-[filter,transform]"
        >
          广播出去 📡
        </button>
      </motion.div>
        </>
      )}

      {/* 模拟收银台：随单支付，钱到位才激活广播 */}
      <PaySheet
        open={!!paying}
        amount={paying?.amount ?? 0}
        title={people >= 2 ? "支付你的拼位份额" : "支付全款"}
        desc={people >= 2 ? `开放局：你算第 1 位，先付自己那份（人均 ${Math.max(1, Math.round((parseInt(budget, 10) || 0) / people))} 元）` : "服务单：全款托管，验收后放款"}
        onCancel={() => setPaying(null)}
        onPaid={() => {
          if (paying) payWave(paying.id);
          setPaying(null);
          reset();
          onClose();
        }}
      />
    </>
  );
}