"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  Check,
  MapPin,
  Star,
} from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { usePrefStore } from "@/store/usePrefStore";
import { PREF_KEYS } from "@/ammo/prefs";
import { fileToAvatarDataUrl } from "@/base/platform/avatar";
import IdentityAvatar from "@/components/ui/IdentityAvatar";
import DataPortCard from "./DataPortCard";
import CockpitDemoCard from "./CockpitDemoCard";
import WorkerWorkbench from "./WorkerWorkbench";
import WalletView from "@/components/waves/WalletView";
import CapabilityPanel from "@/components/waves/CapabilityPanel";
import MyClaims from "@/components/waves/MyClaims";
import FriendList from "@/components/waves/FriendList";
import { ageFromBirthYear, ageGate, modeOfAge } from "@/base/safe/ageGate";
import { useQuietPrefStore } from "@/store/useQuietPrefStore";
import { useWaveStore } from "@/store/useWaveStore";
import { crisisSms, type CrisisLevel } from "@/base/safe/crisis";
import { mask, type ForgetKind, type SensitiveKind } from "@/base/safe/privacy";
import DynamicFormView, { type FormField, type FormValues } from "@/components/ui/DynamicFormView";

/** 紧急联系人登记 schema（ADR-0015 动态表单 N2 接线；SOS 发起时读取）。 */
const CONTACT_SCHEMA: FormField[] = [
  { key: "name", label: "姓名", type: "text", required: true, placeholder: "如：妈妈" },
  {
    key: "relation",
    label: "关系",
    type: "select",
    required: true,
    options: [
      { label: "家人", value: "家人" },
      { label: "挚友", value: "挚友" },
      { label: "同事", value: "同事" },
      { label: "邻居", value: "邻居" },
    ],
  },
  {
    key: "phone",
    label: "电话",
    type: "text",
    required: true,
    pattern: "^[0-9-]{7,}$",
    placeholder: "11 位手机号",
    hint: "仅用于紧急求助通知，脱敏存储",
  },
];

const CATEGORY_EMOJI: Record<string, string> = {
  羽毛球约局: "🏸",
  摄影师约拍: "📷",
  家政保洁: "🧹",
};

/**
 * 个人中心（M3）：资料 + 我的订单列表 → 订单详情 → 星级评价。
 * G-5：未登录即访客本地模式 —— 顶部常驻数据来源说明，本地功能全可用。
 */
export default function ProfilePage({
  onGoHome,
}: { onGoHome?: () => void } = {}) {
  const bookings = useAppStore((s) => s.bookings);
  const reviews = useAppStore((s) => s.reviews);
  const selectedBookingId = useAppStore((s) => s.selectedBookingId);
  const setSelectedBooking = useAppStore((s) => s.setSelectedBooking);
  const cancelBooking = useAppStore((s) => s.cancelBooking);
  const identity = useIdentityStore((s) => s.identity);
  const prefs = usePrefStore((s) => s.prefs);
  const cycle = usePrefStore((s) => s.cycle);
  const resetPrefs = usePrefStore((s) => s.resetPrefs);

  const [showReviewFor, setShowReviewFor] = useState<string | null>(null);
  const [view, setView] = useState<"profile" | "workbench">("profile");
  const setAvatar = useIdentityStore((s) => s.setAvatar);
  const setAge = useIdentityStore((s) => s.setAge);
  const quietPref = useQuietPrefStore((s) => s.pref);
  const setQuietEnabled = useQuietPrefStore((s) => s.setEnabled);
  const toggleQuietWindow = useQuietPrefStore((s) => s.toggleWindow);
  const crisisRecords = useWaveStore((s) => s.crisisRecords);
  const forgetRequests = useWaveStore((s) => s.forgetRequests);
  const raiseCrisis = useWaveStore((s) => s.raiseCrisis);
  const resolveCrisis = useWaveStore((s) => s.resolveCrisis);
  const requestForget = useWaveStore((s) => s.requestForget);
  const myCrisis = crisisRecords.filter(
    (c) => c.userId === identity.id && !c.resolved
  );
  const [crisisLevel, setCrisisLevel] = useState<CrisisLevel>(1);
  const [crisisNote, setCrisisNote] = useState("");
  const [crisisTargets, setCrisisTargets] = useState<string[]>([]);
  const [crisisSmsText, setCrisisSmsText] = useState("");
  const [lastForget, setLastForget] = useState<ForgetKind | null>(null);
  /** 紧急联系人（动态表单 schema 驱动，localState 持有）。 */
  const [contactsSaved, setContactsSaved] = useState(false);
  const [contactForm, setContactForm] = useState<FormValues>({ name: "妈妈", relation: "家人", phone: "138-0000-0001" });
  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([{ name: "妈妈", phone: "138-0000-0001" }]);

  /** 出生年本地输入状态（回填现有值）。 */
  const [birthYearInput, setBirthYearInput] = useState<string>(
    identity.birthYear != null ? String(identity.birthYear) : ""
  );

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToAvatarDataUrl(file);
    if (dataUrl) setAvatar(dataUrl);
  };

  const selected = bookings.find((b) => b.id === selectedBookingId) ?? null;

  if (view === "workbench") {
    return <WorkerWorkbench onBack={() => setView("profile")} />;
  }
  if (selected && showReviewFor !== selected.id) {
    return (
      <OrderDetail
        booking={selected}
        onBack={() => setSelectedBooking(null)}
        onReview={() => setShowReviewFor(selected.id)}
        cancelBooking={(id) => cancelBooking(id)}
      />
    );
  }
  if (selected && showReviewFor === selected.id) {
    return (
      <ReviewForm
        booking={selected}
        onBack={() => setShowReviewFor(null)}
      />
    );
  }

  const upcoming = bookings.filter((b) => b.status === "upcoming").length;
  const reviewed = reviews.length;

  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      {/* G-5 访客引导：数据来源 + 本地模式入口（登录后提示云端，由数据化替换） */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-brandPurple/[0.08] border border-brandPurple/25">
        <span className="text-[11px]">💠</span>
        <p className="flex-1 min-w-0 text-[9.5px] text-white/55">
          访客 · 本地演示身份「{identity.nickname}」 · 数据存本机浏览器
        </p>
        <button
          onClick={() => window.dispatchEvent(new Event("oto:env-info"))}
          aria-label="了解数据模式"
          className="shrink-0 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-brandPurple-foreground hover:bg-white/10 transition-colors"
        >
          数据模式
        </button>
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="shrink-0 px-2 py-1 rounded-full btn-primary text-[9px] font-bold"
          >
            去雷达
          </button>
        )}
      </div>

      {/* 资料卡 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel rounded-3xl p-4 flex items-center gap-3"
      >
        <label
          className="relative cursor-pointer group"
          title="点击上传本地头像（自动压缩为 96×96）"
        >
          <IdentityAvatar size="lg" />
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brandPurple border border-white/30 flex items-center justify-center text-[9px] shadow-md group-hover:scale-110 transition-transform">
            ✎
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="上传本地头像"
            onChange={onPickAvatar}
          />
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-extrabold">Alex</span>
            <BadgeCheck size={14} className="text-brandCyan" />
          </div>
          <p className="text-[10px] text-white/50 mt-0.5">
            线下体验玩家 · 已撮合 {bookings.length} 单
          </p>
        </div>
        <span className="text-[9px] px-2 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 text-brandPurple font-semibold shrink-0">
          钻石会员
        </span>
      </motion.div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "总订单", value: bookings.length },
          { label: "待出行", value: upcoming },
          { label: "已评价", value: reviewed },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-panel rounded-2xl py-3 flex flex-col items-center gap-0.5"
          >
            <span className="text-lg font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
              {s.value}
            </span>
            <span className="text-[10px] text-white/50">{s.label}</span>
          </div>
        ))}
      </div>

      {/* 服务者工作台入口 */}
      <button
        onClick={() => setView("workbench")}
        className="glass-panel rounded-2xl p-3.5 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"
      >
        <div className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center shrink-0 glow-purple-strong">
          <ArrowRightLeft size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[12.5px] font-bold block">服务者工作台</span>
          <span className="text-[10px] text-white/50 block mt-0.5 truncate">
            切到服务者视角 · 接单 / 履约 / 收益
          </span>
        </div>
        <span className="text-white/30 text-lg shrink-0">›</span>
      </button>

      {/* P2P 钱包与信用前台 */}
      <WalletView />

      {/* 演示座舱：三视角一键切换 */}
      <CockpitDemoCard />

      {/* 本地数据备份 */}
      <DataPortCard />

      {/* 能力声明编辑 */}
      <CapabilityPanel />

      {/* 我的接单（响应者视角） */}
      <MyClaims />

      {/* S3 关系沉淀：好友 + 待确认的转友请求 */}
      <FriendList />

      {/* 我的订单 */}
      <div>
        <h3 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
          <span className="w-1 h-3.5 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" />
          我的订单
        </h3>
        {bookings.length === 0 ? (
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-[11px] text-white/40">
              还没有订单——去 AI 助手说句需求，马上撮合
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onClick={() => setSelectedBooking(b.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 撮合偏好（点击标签循环切换，localStorage 持久化） */}
      <div className="glass-panel rounded-2xl p-3.5">
        <h3 className="text-[11px] font-bold text-white/70 mb-2 flex items-center">
          撮合偏好
          <button
            onClick={() => resetPrefs()}
            className="ml-auto text-[9px] text-white/30 hover:text-white/70 transition-colors"
          >
            重置
          </button>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {PREF_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => cycle(key)}
              title="点击切换"
              className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/60 hover:border-brandPurple/50 hover:text-white/80 active:scale-95 transition-all"
            >
              {prefs[key]}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-white/25 mt-2">
          点击标签切换偏好，将用于撮合匹配排序（本地保存）
        </p>
      </div>

      {/* ADR-0016 未成年人分级：出生年 + 监护人同意 */}
      <div className="glass-panel rounded-2xl p-3.5">
        <h3 className="text-[11px] font-bold text-white/70 mb-2 flex items-center">
          未成年人分级
          <span className="ml-auto text-[8.5px] px-1.5 py-0.5 rounded-full bg-brandPurple/15 border border-brandPurple/30 text-brandPurple-foreground">
            合规
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1970}
            max={new Date().getFullYear()}
            value={birthYearInput}
            onChange={(e) => setBirthYearInput(e.target.value)}
            placeholder="出生年份（如 2008）"
            className="w-36 rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-[11px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-brandPurple/50"
          />
          <button
            onClick={() => {
              const by = parseInt(birthYearInput, 10);
              if (!Number.isFinite(by) || by < 1970 || by > new Date().getFullYear()) {
                return;
              }
              setAge(by);
            }}
            className="px-3 py-1.5 rounded-lg btn-primary text-[10px] font-bold"
          >
            保存
          </button>
        </div>
        {identity.birthYear != null && (
          <div className="mt-2 text-[9.5px] text-white/45 leading-relaxed">
            {(() => {
              const age = ageFromBirthYear(identity.birthYear, new Date().getFullYear());
              const mode = modeOfAge(age);
              const label =
                mode === "adult"
                  ? "成年用户，完整功能"
                  : mode === "teen"
                    ? "青少年模式（14-17）：可发免费局/响应，涉资金功能受限"
                    : "儿童模式（<14）：须监护人同意，仅浏览";
              const moneyCheck = ageGate({ age, action: "publish-fee" });
              return (
                <>
                  <p className="font-bold text-white/70">
                    {mode === "adult" ? "✅" : mode === "teen" ? "🛡️" : "🔒"} {label}
                  </p>
                  {age < 18 && (
                    <p className="mt-1 text-white/40">
                      资金功能（发布费/押金/竞价/保险）已被 {moneyCheck.blocked ? "拦截" : "禁用"}
                      —— 依据《未成年人网络保护条例》§31/§43 与《未保法》§72/§76
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        )}
        {ageFromBirthYear(
          identity.birthYear ?? new Date().getFullYear(),
          new Date().getFullYear()
        ) < 14 && (
          <label className="mt-2 flex items-center gap-2 text-[10px] text-white/55 cursor-pointer">
            <input
              type="checkbox"
              checked={identity.guardianConsent ?? false}
              onChange={(e) => setAge(identity.birthYear, e.target.checked)}
              className="accent-brandPurple"
            />
            监护人已同意我使用本平台（《未保法》§72）
          </label>
        )}
      </div>

      {/* ADR-0016 推送免打扰：用户自主静音窗口（不绑付费） */}
      <div className="glass-panel rounded-2xl p-3.5">
        <h3 className="text-[11px] font-bold text-white/70 mb-2 flex items-center gap-1.5">
          推送免打扰
          <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/40">
            自主设置 · 不绑付费
          </span>
        </h3>
        <label className="flex items-center justify-between gap-2 text-[10.5px] text-white/70 cursor-pointer">
          <span>开启免打扰</span>
          <input
            type="checkbox"
            checked={quietPref.enabled}
            onChange={(e) => setQuietEnabled(e.target.checked)}
            className="accent-brandPurple"
          />
        </label>
        {quietPref.enabled && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "00:00–06:00", start: 0, end: 360 },
              { label: "22:00–07:00", start: 1320, end: 420 },
            ].map((w) => {
              const on = quietPref.windows.some((x) => x.start === w.start && x.end === w.end);
              return (
                <button
                  key={w.label}
                  onClick={() => toggleQuietWindow(w.start, w.end)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                    on
                      ? "bg-brandPurple/25 border-brandPurple/50 text-brandPurple-foreground"
                      : "bg-white/[0.06] border-white/10 text-white/60"
                  }`}
                >
                  {on ? "✓ " : ""}{w.label}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[9px] text-white/25 mt-2">
          静音时段不弹通知；紧急提醒（报价/接单/好友/危机）不受影响
        </p>
      </div>

      {/* ADR-0013 安全中心：SOS 危机干预 + 数据脱敏/遗忘权（N8/N10 接线） */}
      <div className="glass-panel rounded-2xl p-3.5">
        <h3 className="text-[11px] font-bold text-white/70 mb-2 flex items-center gap-1.5">
          安全中心
          <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/40">
            危机干预 · 数据主权
          </span>
        </h3>
        {/* SOS 危机干预 */}
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 space-y-2">
          <p className="text-[9.5px] font-bold text-white/60 flex items-center gap-1">
            紧急求助（EPA 递增通知：紧急联系人 → 平台值班 → 警方通道）
          </p>
          <div className="flex gap-1.5">
            {([
              { lv: 1, label: "轻微不适" },
              { lv: 2, label: "危险信号" },
              { lv: 3, label: "极端紧急" },
            ] as const).map((o) => (
              <button
                key={o.lv}
                onClick={() => setCrisisLevel(o.lv)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[9.5px] font-bold border transition-all ${
                  crisisLevel === o.lv
                    ? o.lv === 3
                      ? "bg-red-400/25 border-red-400/60 text-red-300"
                      : o.lv === 2
                        ? "bg-amber-400/20 border-amber-400/50 text-amber-300"
                        : "bg-white/[0.1] border-white/25 text-white/85"
                    : "bg-white/[0.04] border-white/10 text-white/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input
            value={crisisNote}
            onChange={(e) => setCrisisNote(e.target.value)}
            placeholder="备注（如：山野迷路，沿步道 2 号点等待）"
            className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-[10px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-red-400/50"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const out = raiseCrisis({
                  level: crisisLevel,
                  note: crisisNote.trim() || "求助（无备注）",
                  contacts: contacts.map((c) => c.name),
                });
                setCrisisTargets(out.targets);
                if (out.record) {
                  setCrisisSmsText(crisisSms(out.record, contacts[0]?.name ?? "联系人"));
                }
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-red-400/20 border border-red-400/50 text-red-300 text-[10px] font-extrabold hover:bg-red-400/30 active:scale-95 transition-all"
            >
              发起求助
            </button>
            {myCrisis.length > 0 && (
              <button
                onClick={() => resolveCrisis(myCrisis[0].id)}
                className="px-3 py-2 rounded-lg bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold hover:bg-emerald-400/25 active:scale-95 transition-all"
              >
                已平安，结束
              </button>
            )}
          </div>
          {crisisTargets.length > 0 && (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-1">
                {crisisTargets.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-red-400/15 border border-red-400/40 text-[8.5px] font-bold text-red-300"
                  >
                    📢 已通知 {t}
                  </span>
                ))}
              </div>
              {crisisSmsText && (
                <p className="text-[8.5px] text-white/45 bg-white/[0.03] rounded-lg px-2 py-1.5 leading-relaxed">
                  {crisisSmsText}
                </p>
              )}
            </div>
          )}
          {myCrisis.length > 0 && (
            <p className="text-[8.5px] text-red-300/80">
              处置中：{myCrisis[0].note}（登记于{" "}
              {new Date(myCrisis[0].at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              ）
            </p>
          )}
        </div>
        {/* 紧急联系人登记（动态表单 N2）：SOS 通知对象，schema 驱动 */}
        <div className="mt-2 rounded-xl bg-white/[0.03] border border-white/10 p-2.5 space-y-2">
          <p className="text-[9.5px] font-bold text-white/60">
            紧急联系人（SOS 通知对象）
          </p>
          <DynamicFormView
            fields={CONTACT_SCHEMA}
            values={contactForm}
            onChange={setContactForm}
            submitLabel="保存联系人"
            onSubmit={(v) => {
              setContacts([{ name: String(v.name), phone: String(v.phone) }]);
              setContactsSaved(true);
            }}
          />
          {contactsSaved && (
            <p className="text-[8.5px] text-emerald-300/80">
              ✓ 已保存：{contacts[0].name}（{mask("phone", contacts[0].phone)}）
            </p>
          )}
        </div>
        {/* 数据脱敏预览（掩码效果演示） */}
        <div className="mt-2 rounded-xl bg-white/[0.03] border border-white/10 p-2.5 space-y-1">
          <p className="text-[9.5px] font-bold text-white/60">
            数据脱敏（对外展示即掩码）
          </p>
          {(
            [
              { kind: "phone", v: "138-0000-0001" },
              { kind: "name", v: "张三" },
              { kind: "address", v: "幸福家园小区 3 栋" },
              { kind: "email", v: "zhangsan@oto.app" },
              { kind: "id", v: "110101199001011234" },
            ] as const
          ).map((r) => (
            <div key={r.kind} className="flex items-center justify-between text-[9px]">
              <span className="text-white/35">{r.kind}</span>
              <span className="text-white/50 font-mono">
                {mask(r.kind as SensitiveKind, r.v)}
              </span>
            </div>
          ))}
        </div>
        {/* 遗忘权 */}
        <div className="mt-2 rounded-xl bg-white/[0.03] border border-white/10 p-2.5 space-y-2">
          <p className="text-[9.5px] font-bold text-white/60 flex items-center gap-1">
            遗忘权（《个保法》§47：删除或匿名化）
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { kind: "profile", label: "资料" },
                { kind: "wallet", label: "钱包" },
                { kind: "waves", label: "需求/接单" },
                { kind: "reviews", label: "评价" },
                { kind: "all", label: "全部" },
              ] as const
            ).map((o) => (
              <button
                key={o.kind}
                onClick={() => {
                  const out = requestForget(o.kind);
                  setLastForget(out.fresh ? o.kind : null);
                }}
                className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[9.5px] text-white/60 hover:border-red-400/40 hover:text-red-300 active:scale-95 transition-all"
              >
                {o.label}
              </button>
            ))}
          </div>
          {lastForget && (
            <p className="text-[8.5px] text-emerald-300/80">
              ✓ 已提交「{lastForget}」域匿名化请求（幂等合并，处理中）
            </p>
          )}
          {forgetRequests.length > 0 && (
            <div className="space-y-1">
              {forgetRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-[8.5px]">
                  <span className="text-white/45">
                    {r.kind} · {new Date(r.requestedAt).toLocaleDateString("zh-CN")}
                  </span>
                  <span
                    className={`px-1.5 py-px rounded-full font-bold ${
                      r.status === "anonymized"
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-amber-400/15 text-amber-300"
                    }`}
                  >
                    {r.status === "anonymized" ? "已匿名化" : "处理中"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingRow({
  booking,
  onClick,
}: {
  booking: Booking;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full glass-panel rounded-2xl p-3 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"
    >
      <div className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center text-lg shrink-0">
        {CATEGORY_EMOJI[booking.category] ?? "🎟️"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold truncate">
            {booking.providerName}
          </span>
          <span
            className={`text-[9px] px-1.5 py-px rounded-full font-semibold shrink-0 ${
              booking.status === "upcoming"
                ? "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple"
                : booking.status === "cancelled"
                  ? "bg-white/10 border border-white/20 text-white/50"
                  : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
            }`}
          >
            {booking.status === "upcoming"
              ? "待出行"
              : booking.status === "cancelled"
                ? "已取消"
                : "已完成"}
          </span>
        </div>
        <p className="text-[10px] text-white/50 mt-0.5 truncate">
          {booking.time} · {booking.category}
        </p>
      </div>
      <span className="text-[12px] font-extrabold text-brandCyan shrink-0">
        {booking.price}
      </span>
    </button>
  );
}

function OrderDetail({
  booking,
  onBack,
  onReview,
  cancelBooking,
}: {
  booking: Booking;
  onBack: () => void;
  onReview: () => void;
  cancelBooking: (id: string) => void;
}) {
  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white w-fit"
      >
        <ArrowLeft size={14} /> 返回订单列表
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl glass-panel flex items-center justify-center text-xl">
            {CATEGORY_EMOJI[booking.category] ?? "🎟️"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-extrabold truncate">
              {booking.providerName}
            </h2>
            <p className="text-[10px] text-white/50">{booking.category}</p>
          </div>
          <span
            className={`text-[10px] px-2 py-1 rounded-full font-semibold shrink-0 ${
              booking.status === "upcoming"
                ? "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple"
                : booking.status === "cancelled"
                  ? "bg-white/10 border border-white/20 text-white/50"
                  : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
            }`}
          >
            {booking.status === "upcoming"
              ? "已预订"
              : booking.status === "cancelled"
                ? "已取消"
                : "已完成"}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-3 text-[11.5px]">
          {[
            { k: "服务", v: booking.category },
            { k: "对象", v: booking.providerName },
            { k: "时段", v: booking.time },
            { k: "价格", v: booking.price },
            { k: "订单号", v: booking.id.slice(0, 8).toUpperCase() },
          ].map((line) => (
            <div key={line.k} className="flex gap-2">
              <span className="text-white/40 w-12 shrink-0">{line.k}</span>
              <span className="text-white/85">{line.v}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 履约时间线 */}
      {booking.status === "cancelled" ? (
        <div className="glass-panel rounded-2xl p-4">
          <h3 className="text-[11px] font-bold text-white/70 mb-3">履约进度</h3>
          <div className="flex items-center gap-2 text-[11.5px] text-white/45">
            <span className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[9px]">✕</span>
            订单已取消，工作台对应待接单已同步撤回
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-[11px] font-bold text-white/70 mb-3">履约进度</h3>
        <div className="flex flex-col gap-3">
          {[
            { label: "AI 撮合完成", done: true },
            { label: "已预订", done: true },
            { label: "线下履约", done: booking.status === "completed" },
            { label: "完成并评价", done: booking.status === "completed" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center gap-2.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  step.done
                    ? "bg-emerald-400/15 border border-emerald-400/50 text-emerald-400"
                    : "bg-white/[0.06] border border-white/15 text-white/30"
                }`}
              >
                {step.done ? <Check size={11} /> : <span className="text-[9px]">{i + 1}</span>}
              </div>
              <span
                className={`text-[11.5px] ${
                  step.done ? "text-white/85" : "text-white/35"
                }`}
              >
                {step.label}
              </span>
              {i < 3 && (
                <div
                  className={`flex-1 h-px ${
                    [true, true, booking.status === "completed", false][i + 1]
                      ? "bg-emerald-400/40"
                      : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {booking.status === "upcoming" && (
        <button
          onClick={onReview}
          className="w-full py-2.5 rounded-2xl btn-primary text-xs font-bold glow-purple-strong active:scale-[0.99]"
        >
          评价这次服务
        </button>
      )}
      {booking.status === "upcoming" && (
        <button
          onClick={() => {
            cancelBooking(booking.id);
          }}
          className="w-full py-2.5 rounded-2xl glass-panel text-xs font-bold text-white/60 hover:text-red-400 hover:border-red-400/40 transition-colors active:scale-[0.99]"
        >
          取消订单
        </button>
      )}
    </div>
  );
}

function ReviewForm({ booking, onBack }: { booking: Booking; onBack: () => void }) {
  const addReview = useAppStore((s) => s.addReview);
  const updateBookingStatus = useAppStore((s) => s.updateBookingStatus);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (rating === 0) return;
    addReview({
      bookingId: booking.id,
      rating,
      comment: comment.trim(),
      createdAt: Date.now(),
    });
    updateBookingStatus(booking.id, "completed");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pointer-events-auto glass-panel rounded-3xl p-6 text-center flex flex-col items-center gap-2"
      >
        <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/40 flex items-center justify-center">
          <Check size={22} className="text-emerald-400" />
        </div>
        <h2 className="text-[15px] font-extrabold">感谢评价！</h2>
        <p className="text-[11px] text-white/50">
          你的反馈会帮助 AI 撮合更准～ 已记录 {rating} 星
        </p>
        <button
          onClick={onBack}
          className="mt-3 px-5 py-2 rounded-full btn-primary text-[11px] font-bold glow-purple-strong"
        >
          完成
        </button>
      </motion.div>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white w-fit"
      >
        <ArrowLeft size={14} /> 返回订单
      </button>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-4"
      >
        <h2 className="text-[14px] font-extrabold">评价 {booking.providerName}</h2>
        <p className="text-[10px] text-white/50 mt-0.5">{booking.time}</p>

        <div className="flex items-center justify-center gap-2 my-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} 星`}
              className="active:scale-90 transition-transform"
            >
              <Star
                size={30}
                className={
                  n <= rating
                    ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]"
                    : "text-white/20"
                }
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="说两句吧，比如：场地新、球友很会带节奏……"
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-2xl glass-panel outline-none text-[12px] placeholder:text-white/30 resize-none"
        />
        <button
          onClick={submit}
          disabled={rating === 0}
          className="w-full mt-3 py-2.5 rounded-2xl btn-primary text-xs font-bold glow-purple-strong disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
        >
          {rating === 0 ? "先点星星再提交" : "提交评价"}
        </button>
        <p className="text-[9px] text-white/35 mt-2 text-center flex items-center justify-center gap-1">
          <MapPin size={9} /> AI 会把评价总结进撮合画像
        </p>
      </motion.div>
    </div>
  );
}
