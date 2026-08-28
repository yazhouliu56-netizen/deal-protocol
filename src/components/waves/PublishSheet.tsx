"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { useDragToDismiss } from "@/adapters/ui/useDragToDismiss";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import NegotiationBox from "./NegotiationBox";
import PaySheet from "./PaySheet";
import DynamicDraftCard, {
  describeFormSchemaFields,
  describePricing,
} from "./DynamicDraftCard";
import {
  getAmmoById,
  getAmmoDefinition,
  resolveAmmoIdForPublish,
  listAmmoPillDescriptors,
  listRegisteredAmmos,
} from "@/ammo/registry";
import { CATEGORY_EMOJI } from "./WaveCard";
import { FREE_PUBLISH_PER_DAY, PUBLISH_FEE } from "@/base/money/pay";
import { ageFromBirthYear, ageGate } from "@/base/safe/ageGate";
import { toast } from "@/base/platform/toast";
import { normalizeCustomIntent } from "@/base/ai/intent-normalizer";
import PublishFormSchemaBridge, {
  defaultParamsOf,
  pricingFloorYuan,
} from "./_components/PublishFormSchemaBridge";
import { sopForCategory } from "@/ammo/sop";
import type { TaskModule } from "@/base/ai/decompose";
import DuoButton from "@/components/ui/DuoButton";

function getFallbackBudget(): string {
  try {
    const ammos = listRegisteredAmmos();
    if (ammos.length > 0) {
      const floor = pricingFloorYuan(ammos[0].pricingModel);
      if (floor > 0) return String(floor);
    }
  } catch {}
  return "";
}

/**
 * 发布需求 = 发出一个信号波。
 * 基本要素先快速填（硬过滤），定制条件可选（软加权 + 递增加价），
 * 磋商对话框"内容即开关"。
 * 多人拼单局（人数 ≥ 2）：C 端互相组队拼位 —— 满员成局，人均 = 预算 ÷ 人数。
 * 复杂任务（一句话需求）：AI 拆解成独立模块 → 发起人确认（可增删/改价）→
 * 接单前自由调整，接单后锁定。
 *
 * P1-5 声明式表单闭环：动态字段 100% 由弹药 D8 formSchema 驱动渲染，
 * 输入值结构化写入 bizParams 随单落库（红线 2：零品类硬编码分支）。
 */
export default function PublishSheet({
  open,
  onClose,
  initialCategory,
}: {
  open: boolean;
  onClose: () => void;
  /** 草稿卡「扣动扳机」带入的弹药品类（胶囊直拨中文品类，发单条缺省空串手动填）。 */
  initialCategory?: string;
}) {
const createPendingWave = useWaveStore((s) => s.createPendingWave);
  const payWave = useWaveStore((s) => s.payWave);
  const identity = useIdentityStore((s) => s.identity);
  const consumePublishQuota = useIdentityStore((s) => s.consumePublishQuota);
  const resetPublishQuotaIfDue = useIdentityStore((s) => s.resetPublishQuotaIfDue);
  const publishQuota = useIdentityStore((s) => s.publishQuota);

  const [category, setCategory] = useState("");
  const [time, setTime] = useState("");
  const [area, setArea] = useState("幸福家园小区");
  const [budget, setBudget] = useState(getFallbackBudget);
  const [customText, setCustomText] = useState("");
  const [customs, setCustoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [deposit, setDeposit] = useState(false);
  const [people, setPeople] = useState(1);
  /** 组织者把关层：多人拼单局开启审批制后，拼位需申请并由发起人批准。 */
  const [needApproval, setNeedApproval] = useState(false);
  const DEFAULT_TTL = 2 * 3600_000;
  const [ttl, setTtl] = useState<number>(DEFAULT_TTL);
  /** 服务开始时间（相对 now 的偏移 ms）— 24h 分级取消的依据。null=未设置（取消不退） */
  const [startsIn, setStartsIn] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<null | { id: string; amount: number; fee: number }>(null);
  /** AI 拆解出的模块草案（发起人确认后随单发布，接单后锁定）。 */
  const [modules, setModules] = useState<TaskModule[] | null>(null);
  const [decomposing, setDecomposing] = useState(false);
  /** P2-6 弹层分组：可选配置（定制/拆解/多人拼单局/爽约保障险/有效期/配额）默认折叠，核心表单常显 */
  const [showMore, setShowMore] = useState(false);
  /** P2：拖拽收起过渡态（下拉 >35% → 平滑下滑离场 → 关闭） */
  const [dismissing, setDismissing] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);
  const sentinelToastFiredRef = useRef(false);
  /** P1-5 声明式表单：动态参数快照（按 ammo.holographic.formSchema 驱动，零硬编码分支） */
  const [bizParams, setBizParams] = useState<Record<string, unknown>>({});

  // P1-5：当前选定弹药的声明式表单字段（纯函数投影，红线 2）
  // 复用 DynamicDraftCard 同链：中文别名（家电维修/修空调）经 resolveAmmoIdForPublish 直达整弹，所见即所发
  const ammoForForm = useMemo(() => {
    const cat = category.trim();
    if (!cat) return null;
    try {
      return getAmmoById(resolveAmmoIdForPublish(cat));
    } catch {
      try {
        return getAmmoDefinition(cat);
      } catch {
        return null;
      }
    }
  }, [category]);

  const formFields = useMemo(() => {
    if (!ammoForForm) return [];
    return describeFormSchemaFields(ammoForForm);
  }, [ammoForForm]);

  // P1-5：弹药切换时按声明式默认值重置 bizParams——React 官方「props 变化调状态」模式：
  // render 期比较上一弹药标识并同步重置（替代 setState-in-effect，消除级联渲染），
  // 同一弹药的中文别名互切不再误清已填参数；首帧 lastAmmoKey=null 强制对齐当前字段默认，
  // 与原 effect 语义逐字一致（SSR 安全）。
  const ammoKey = ammoForForm?.ammoId ?? "";
  const [lastAmmoKey, setLastAmmoKey] = useState<string | null>(null);
  if (ammoKey !== lastAmmoKey) {
    setLastAmmoKey(ammoKey);
    setBizParams(defaultParamsOf(formFields));
  }

  // P2：顶部把手下拉 >35% 平滑关闭（enabled=open 使 open 时重绑到已挂载的把手）
  const { dragRef: sheetDragRef } = useDragToDismiss({
    onDismiss: () => {
      if (dismissing) return;
      setDismissing(true);
      dismissTimerRef.current = window.setTimeout(() => {
        dismissTimerRef.current = null;
        setDismissing(false);
        onClose();
      }, 210);
    },
    enabled: open,
  });

  // 重开抽屉时清除残留过渡态与定时器
  useEffect(() => {
    if (open) {
      sentinelToastFiredRef.current = false;
      const resetAnim = async () => {
        await Promise.resolve()
        setDismissing(false)
      }
      resetAnim()
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    // 草稿卡带入的品类别在关闭后残留串单到下一次发布（如胶囊 → 家政保洁 → 改发其他）
    // P1 第 4 步：扳机入口与快捷胶囊同链装配 —— 品类 + 预算起步底价一次到位
    if (initialCategory) applySopDefaults(initialCategory);
    }
  }, [open, initialCategory]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  const pillHints = [...new Set(listAmmoPillDescriptors().map((p) => p.label))].slice(0, 6);

  /** 选品类 → 应用 SOP 弹药表默认（爽约保障险/有效期/容量 + 预算起步底价，宪法 #3：先配表后写码）。 */
  function applySopDefaults(cat: string) {
    setCategory(cat);
    const s = sopForCategory(cat.trim());
    if (s.depositDefault !== undefined) setDeposit(s.depositDefault);
    if (s.expiresInMs !== undefined) setTtl(s.expiresInMs);
    if (s.capacityDefault !== undefined) setPeople(s.capacityDefault);
    // P1 第 4 步：预算默认值对齐弹药起步底价（D2 SSOT，杜绝同屏多价格口径互殴）
    try {
      const ammo = getAmmoById(resolveAmmoIdForPublish(cat.trim()));
      const floor = pricingFloorYuan(ammo.pricingModel);
      if (floor > 0) setBudget(String(floor));
    } catch {
      // 未命中官方弹药（自定义长尾）→ 保持当前预算值
    }
  }

  function reset() {
    setCategory("");
    setTime("");
    setArea("幸福家园小区");
    setBudget(getFallbackBudget());
    setCustomText("");
    setCustoms([]);
    setNote("");
    setDeposit(false);
    setPeople(1);
    setNeedApproval(false);
    setError("");
    setModules(null);
    setBizParams({});
  }

  /** AI 拆解：一句话需求 → 独立模块清单（含建议价权重）→ 发起人确认。 */
  async function decompose() {
    if (!category.trim()) {
      setError("先填品类，再让 AI 拆解");
      return;
    }
    setDecomposing(true);
    setError("");
    try {
      const res = await fetch("/api/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.trim(),
          time: time.trim() || undefined,
          note: note.trim() || undefined,
          budget: parseInt(budget, 10) || 0,
        }),
      });
      const data = await res.json();
      if (data.modules && data.modules.length >= 2) {
        setModules(data.modules);
      } else {
        setError("AI 拆解失败（已降级）—— 稍后重试，或直接广播按简单任务处理");
      }
    } catch {
      setError("AI 拆解失败（网络）—— 稍后重试，或直接广播按简单任务处理");
    } finally {
      setDecomposing(false);
    }
  }

  /** 模块编辑：删除 / 改权重。 */
  function editModule(i: number, patch: Partial<TaskModule>) {
    if (!modules) return;
    setModules(modules.map((m, j) => (j === i ? { ...m, ...patch } : m)));
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
    // P1-5 声明式表单必填校验（零硬编码，表单即契约）
    for (const f of formFields) {
      if (f.required) {
        const v = bizParams[f.key];
        if (v === undefined || v === null || String(v).trim() === "") {
          setError(`请填写 ${f.label}（必填）`);
          return;
        }
      }
    }
    // ADR-0016 未成年人分级：发布前先过年龄闸（监护人同意 / 资金动作受限）
    const birthYear = identity.birthYear;
    const age = birthYear == null ? null : ageFromBirthYear(birthYear, new Date().getFullYear());
    if (age != null && age < 18) {
      const gate = ageGate({
        age,
        action: "publish",
        guardianConsent: identity.guardianConsent,
      });
      if (gate.blocked) {
        setError(`发布被拒：${gate.reason}`);
        return;
      }
      // 青少年可发免费局，但不能加爽约保障险（资金动作）
      if (deposit) {
        setError(`发布被拒：${ageGate({ age, action: "deposit", guardianConsent: identity.guardianConsent }).reason}`);
        return;
      }
    }
    // 模块化任务：权重必须和为 100%（否则按等分兜底）
    if (modules && modules.length >= 2) {
      const total = modules.reduce((s, m) => s + (Number(m.weight) || 0), 0);
      if (total !== 100) {
        setError(`模块权重之和必须为 100%（当前 ${total}%）—— 请调整或重拆`);
        return;
      }
    }
    // 随单支付：1:1 服务 = 付全款；多人拼单局 = 发起人付自己那份(人均价)。
    const payAmount =
      people >= 2
        ? Math.max(1, Math.round(budgetNum / people))
        : budgetNum;
    // 提交即扣免费发布次数：每日免费 3 次，用完需另付发布费（独立于单子金额）
    // ADR-0016：青少年免费次数内可发；用尽后超发需付发布费（资金动作）→ 未成年拦截
    resetPublishQuotaIfDue();
    const free = consumePublishQuota();
    if (!free && age != null && age < 18) {
      setError(
        `发布被拒：每日免费发布次数已用完（${FREE_PUBLISH_PER_DAY} 次）。未成年人模式不支持付费发布，请明日再来`
      );
      return;
    }
    const publishFee = free ? 0 : PUBLISH_FEE;
    // 阶段4：需求备注（note）非标定制（着装/年龄/性别）经语义驯化中性化后随单固化；
    // 违禁词命中（blockedReason）时仍正常发单（治理闸门 2 按 customs 词表扫描拦截）。
    const customRequirements = note.trim()
      ? normalizeCustomIntent(note)
      : undefined;
    const sanitizedBizParams = Object.keys(bizParams).length > 0 ? { ...bizParams } : undefined;
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
      customRequirements,
      bizParams: sanitizedBizParams,
      deposit,
      needApproval: people >= 2 ? needApproval : undefined,
      capacity: people,
      startsAt: startsIn ? Date.now() + startsIn : undefined,
      modules: modules ?? undefined,
      payAmount,
      publishFee,
      expiresAt: Date.now() + ttl,
      hotness: 2 + Math.floor(Math.random() * 2),
      // W1 总装：弹药标识随单落库（中文品类归一化直挂官方弹药，履约座舱按 ammoId 装载场景插槽）
      ammoId: resolveAmmoIdForPublish(category.trim()),
    });
    if (out === null) {
      setError("发布被拒：账号已被平台限制（限流/封禁），请稍后或申诉");
      return;
    }
    if (out.minorBlocked) {
      setError(
        "发布被拒：未成年人账号需监护人同意后才能发布（《未成年人保护法》§43/§72）"
      );
      return;
    }
    if (out.blocked === "debt") {
      setError("发布被拒：你还有未结清的 no-show 违约，先到「我的」结清欠款再发");
      return;
    }
    if (out.blocked === "roam") {
      const msg = "⚠️ 账号多设备登录异常，发单已暂停，请在安全中心核对设备";
      setError("发布被拒：本设备检测到高危多开（≥3 个身份共用），请到「安全中心」重置漫游风控");
      if (!sentinelToastFiredRef.current) {
        sentinelToastFiredRef.current = true;
        try { toast(msg, "error"); } catch {}
      }
      return;
    }
    if (out.blocked === "sentinel") {
      const msg = "⚠️ 账号多设备登录异常，发单已暂停，请在安全中心核对设备";
      setError("发布被拒：反欺诈探针甄检到高危信号（多开/新号大额/高频低完成），请到「安全中心」查看详情");
      if (!sentinelToastFiredRef.current) {
        sentinelToastFiredRef.current = true;
        try { toast(msg, "error"); } catch {}
      }
      return;
    }
    if (out.removed) {
      // 命中违禁词：内容转入平台审核（不支付、不上线）
      setError("内容命中违禁词，已转入平台审核");
      reset();
      onClose();
      return;
    }
    // 进入模拟收银台：支付成功才激活广播（含发布费则两笔并列展示）
    setPaying({ id: out.id, amount: out.amount, fee: publishFee });
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
            animate={dismissing ? { y: "110%", opacity: 0 } : { y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-x-3 bottom-24 z-50 glass-panel rounded-3xl p-4 max-h-[72vh] overflow-y-auto no-scrollbar"
          >
        {/* P2：拖拽把手（下拉 >35% 平滑收起） */}
        <div
          ref={sheetDragRef as React.Ref<HTMLDivElement>}
          data-testid="publish-drag-handle"
          aria-hidden="true"
          className="w-12 h-1.5 mx-auto mt-0.5 mb-2 rounded-full bg-white/20 shrink-0 cursor-grab touch-none"
        />
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
          {pillHints.map((h) => (
            <button
              key={h}
              onClick={() => applySopDefaults(h)}
              className={`px-2.5 min-h-8 rounded-full text-xs font-bold transition-colors ${
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
          name="wave-category"
          placeholder="品类（如：厨师 · 上门做饭）*"
          aria-label="需求品类"
          className="w-full rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-xs placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors mb-2"
        />
        <div className="flex gap-2 mb-2">
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
            name="wave-time"
            placeholder="时间 *（如：明天 11:00）"
            aria-label="需求时间"
            className="flex-1 min-w-0 rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-xs placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors"
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            name="wave-area"
            placeholder="地点 *"
            aria-label="需求地点"
            className="flex-1 min-w-0 rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-xs placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors"
          />
        </div>
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          name="wave-budget"
          placeholder="基础预算 ¥（如 100）"
          aria-label="基础预算"
          inputMode="numeric"
          className="w-full rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-xs placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors mb-1"
        />
        {/* P1 第 4 步：价格权威单一源 —— 起步口径 100% 取自当前弹药 D2 计价契约，
            旧「建议起价 ¥{minPriceYuan}」scene 残留出清（底座表保留，UI 不再消费） */}
        {category.trim() && ammoForForm && (
          <p className="text-xs text-brandCyan/80 mb-3" data-testid="ammo-floor-price">
            方案起步 {describePricing(ammoForForm.pricingModel)}
          </p>
        )}

        {/* P1-5 声明式表单：100% 由弹药 D8 formSchema 驱动，零品类硬编码分支（渲染桥接子组件化搬移） */}
        <PublishFormSchemaBridge
          fields={formFields}
          ammoId={ammoForForm?.ammoId}
          bizParams={bizParams}
          onBizParamsChange={setBizParams}
        />

        {/* W1 总装：弹药驱动草稿预览卡（ammoId/计价模型/安全徽章自动投影），
            扣动扳机·一键发布 = 真实发射链路（publish → createPendingWave → payWave） */}
        {category.trim() && (
          <div className="mb-3">
            <DynamicDraftCard
              category={category.trim()}
              hideLaunchButton={true}
              onPublish={() => publish()}
              onTweak={(key) => {
                // 草稿卡参数行点击微调：聚焦对应表单（多人拼单局容量 → 展开更多选项）
                if (key === "capacity" || key === "deposit" || key === "rounds") {
                  setShowMore(true);
                }
              }}
            />
          </div>
        )}

        {/* 可选配置折叠开关：核心要素常显，可选件收起 */}
        <button
          onClick={() => setShowMore(!showMore)}
          aria-expanded={showMore}
          className="w-full mb-3 flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-bold text-white/65 hover:text-white transition-colors"
        >
          <span>更多选项（定制 / 磋商留言 / AI 拆解 / 多人拼单局 / 爽约保障险）</span>
          <span className="text-xs text-white/40">{showMore ? "收起 ▴" : "展开 ▾"}</span>
        </button>

        {showMore && (
          <div className="space-y-2">
        {/* 定制条件：可选 + 递增加价提示 */}
        <span className="text-xs font-semibold text-white/40 flex items-center gap-1 mb-1.5">
          <Sparkles size={10} className="text-brandPurple" /> 定制条件（可选，逐个 +15%）
        </span>
        {customs.map((c, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brandPurple/15 border border-brandPurple/40 mb-1.5"
          >
            <span className="text-xs text-brandPurple font-bold flex-1 truncate">{c}</span>
            <span className="text-xs font-bold text-white/50">+{15 * (i + 1)}%</span>
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
            name="custom-text"
            placeholder="如：30 岁左右女性厨师、穿 JK 装"
            aria-label="定制条件"
            className="flex-1 min-w-0 rounded-2xl bg-white/[0.05] border border-white/10 px-3.5 py-2.5 text-xs placeholder:text-white/25 text-white/90 outline-none focus:border-brandPurple/50 transition-colors"
          />
          <button
            onClick={() => {
              const t = customText.trim();
              if (t && !customs.includes(t)) setCustoms([...customs, t]);
              setCustomText("");
            }}
            className="px-3.5 rounded-2xl glass-panel-interactive text-xs font-bold text-brandPurple shrink-0"
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

        {/* AI 拆解：复杂任务 → 独立模块（接单前可增删/改价，接单后锁定） */}
        <div className="mt-3 rounded-2xl bg-white/[0.04] border border-white/10 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-white/85 flex items-center gap-1.5">
              🤖 AI 拆解复杂任务
            </span>
            {modules && modules.length >= 2 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple">
                已拆 {modules.length} 个独立模块
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 mb-2">
            一句话太笼统（如“清理整个房间”）？AI 拆成可单独验收的模块 + 建议价权重，你确认后发布；接单前可增删改，接单后锁定
          </p>
          {!modules || modules.length < 2 ? (
            <button
              onClick={decompose}
              disabled={decomposing}
              className="w-full py-2 rounded-xl bg-brandPurple/15 border border-brandPurple/40 text-xs font-bold text-brandPurple disabled:opacity-50"
            >
              {decomposing ? "拆解中…" : "✨ 一键拆解（含价格权重建议）"}
            </button>
          ) : (
            <div className="space-y-1.5">
              {modules.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-brandPurple/10 border border-brandPurple/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white/85 truncate">
                        {m.name}
                      </span>
                      <input
                        value={m.weight}
                        onChange={(e) =>
                          editModule(i, { weight: parseInt(e.target.value, 10) || 0 })
                        }
                        aria-label={`模块 ${m.name} 权重`}
                        inputMode="numeric"
                        className="w-12 rounded-lg bg-white/[0.06] border border-white/10 px-1.5 py-0.5 text-xs text-brandPurple font-bold text-center outline-none"
                      />
                      <span className="text-xs text-white/35">%</span>
                    </div>
                    <p className="text-xs text-white/40 truncate">{m.acceptance}</p>
                  </div>
                  <button
                    onClick={() => setModules(modules.filter((_, j) => j !== i))}
                    aria-label={`删除模块 ${m.name}`}
                    className="text-white/40 hover:text-white text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => setModules(null)}
                className="w-full py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold text-white/50"
              >
                撤销拆解（按简单任务广播）
              </button>
            </div>
          )}
        </div>

        {/* 多人拼单局：人数 ≥ 2 = 拼位组队（C 端互相找搭子） */}
        <div className="mt-3 rounded-2xl bg-white/[0.04] border border-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/85 flex items-center gap-1.5">
              🎯 多人拼单局 · 拼位组队
            </span>
            {people >= 2 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brandPurple/20 border border-brandPurple/40 text-brandPurple">
                满 {people} 人成局 · 人均约 ¥{Math.max(1, Math.round((parseInt(budget, 10) || 0) / people))}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 mb-2">
            1 人 = 普通服务需求；≥ 2 人 = 多人拼单局，你算第 1 位，拼满成局（如羽毛球约局、拼车、拼饭）
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
              <span className="text-xs text-white/40 ml-1 font-normal">人（含你）</span>
            </span>
            <button
              onClick={() => setPeople(Math.min(8, people + 1))}
              aria-label="增加人数"
              className="w-8 h-8 rounded-xl glass-panel-interactive text-white/70 font-bold text-sm shrink-0"
            >
              ＋
            </button>
          </div>
          {people >= 2 && (
            <label className="mt-2.5 flex items-center gap-2 text-xs text-white/55 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={needApproval}
                onChange={(e) => setNeedApproval(e.target.checked)}
                className="accent-brandPurple"
              />
              需我审批加入（组织者把关，对标 Meetup 成员审批 —— 响应者申请后由你批准才占座）
            </label>
          )}
        </div>

        {/* 爽约保障险：履约保证金 */}
        <button
          onClick={() => setDeposit(!deposit)}
          className="mt-3 w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10"
          aria-label="开启爽约保障险"
        >
          <span className="flex flex-col text-left">
            <span className="text-xs font-bold text-white/85">🕊️ 爽约保障险（双方履约保障）</span>
            <span className="text-xs text-white/40 mt-0.5">
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

        {/* 有效期：首档 SOP 表驱动（ammo/sop expiresInMs），兜底档固定 */}
        <div className="flex gap-1.5 mt-3 mb-3">
          {(() => {
            const sopMs = sopForCategory(category.trim()).expiresInMs ?? DEFAULT_TTL;
            const opts = [
              {
                label: sopMs >= 24 * 3600_000
                  ? `${Math.round(sopMs / 24 / 3600_000)} 天`
                  : `${Math.round(sopMs / 3600_000)} 小时`,
                ms: sopMs,
              },
              { label: "今晚 24 点", ms: 0 },
              { label: "3 天", ms: 3 * 24 * 3600_000 },
            ];
            return opts.map((o) => {
              const active =
                o.ms === 0
                  ? ttl === 0
                  : ttl === o.ms;
              return (
                <button
                  key={o.label}
                  onClick={() => setTtl(o.ms === 0 ? 0 : o.ms)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "btn-primary glow-purple-strong"
                      : "glass-panel text-white/60 hover:text-white"
                  }`}
                >
                  {o.label}
                </button>
              );
            });
          })()}
        </div>

        {/* 服务开始时间：驱动 24h 分级取消（≥24h 全退 / <24h 部分退） */}
        <span className="text-xs font-semibold text-white/40 flex items-center gap-1 mb-1.5">
          ⏰ 服务开始时间（决定取消退款档位）
        </span>
        <div className="flex gap-1.5">
          {[
            { label: "未设置", ms: null },
            { label: "2 小时后", ms: 2 * 3600_000 },
            { label: "明天", ms: 24 * 3600_000 },
            { label: "3 天后", ms: 3 * 24 * 3600_000 },
          ].map((o) => {
            const active = startsIn === o.ms;
            return (
              <button
                key={o.label}
                onClick={() => setStartsIn(o.ms)}
                aria-label={`开始时间 ${o.label}`}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? "bg-brandCyan/25 border border-brandCyan/50 text-brandCyan"
                    : "glass-panel text-white/50 hover:text-white"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {/* 免费发布次数：每日免费 N 次，用完后每次收发布费 */}
        <div className="mb-2 flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-2">
          <span className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
            🎫 免费发布
            <span className="text-white/40 font-normal">
              今日剩 {publishQuota} / {FREE_PUBLISH_PER_DAY} 次
            </span>
          </span>
          {publishQuota <= 0 && (
            <span className="text-xs font-bold text-brandCyan">
              超出将收发布费 ¥{PUBLISH_FEE}/次
            </span>
          )}
        </div>
        </div>
        )}

        {error && <p className="text-xs text-red-400 font-semibold mb-2">{error}</p>}

        <DuoButton
          variant="primary"
          size="lg"
          sound="click"
          fullWidth
          data-testid="publish-broadcast"
          onClick={publish}
          className="rounded-2xl text-xs"
        >
          广播出去 📡
        </DuoButton>
      </motion.div>
        </>
      )}

      {/* 模拟收银台：随单支付，钱到位才激活广播 */}
      <PaySheet
        key={paying ? paying.id : "idle"}
        open={!!paying}
        amount={paying?.amount ?? 0}
        title={people >= 2 ? "支付你的拼位份额" : "支付全款"}
        desc={people >= 2 ? `多人拼单局：你算第 1 位，先付自己那份（人均 ${Math.max(1, Math.round((parseInt(budget, 10) || 0) / people))} 元）` : "服务单：全款托管，验收后放款"}
        fee={paying?.fee ?? 0}
        onCancel={() => setPaying(null)}
        onPaid={() => {
          if (paying) payWave(paying.id);
          setPaying(null);
          reset();
          onClose();
          toast(
            people >= 2 ? `需求已上线 · 已付拼位份额 ¥${paying?.amount ?? 0}` : "需求已上线 · 正在雷达广播",
            "success"
          );
        }}
      />
    </>
  );
}
