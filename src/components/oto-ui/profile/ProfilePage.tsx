"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRightLeft,
  BadgeCheck,
  LogIn,
} from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { toAtomicFiveState } from "@/base/ammo/runner";
import type { AtomicFiveState } from "@/types/ammo-schema";
import { useIdentityStore } from "@/store/useIdentityStore";
import { usePrefStore } from "@/store/usePrefStore";
import { PREF_KEYS } from "@/ammo/prefs";
import { fileToAvatarDataUrl } from "@/base/platform/avatar";
import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import DataPortCard from "./DataPortCard";
import CockpitDemoCard from "./CockpitDemoCard";
import WorkerWorkbench from "./WorkerWorkbench";
import PushEnableBar from "@/components/oto-ui/PushEnableBar";
import CapabilityPanel from "@/components/waves/CapabilityPanel";
import MyClaims from "@/components/waves/MyClaims";
import FriendList from "@/components/waves/FriendList";
import { useQuietPrefStore } from "@/store/useQuietPrefStore";
import { useWaveStore } from "@/store/useWaveStore";
import { crisisSms, type CrisisLevel } from "@/base/safe/crisis";
import { mask, type ForgetKind } from "@/base/safe/privacy";
import DynamicFormView, { type FormField, type FormValues } from "@/components/oto-ui/DynamicFormView";
import SeniorModeView from "@/components/oto-ui/SeniorModeView";
import StealthCalculator, { type SilentAlarmPayload } from "@/components/oto-ui/StealthCalculator";
import SafetyKit from "@/components/waves/SafetyKit";
import ProfileDrawer from "./ProfileDrawer";
import WalletStatsCard from "./_components/WalletStatsCard";
import SafetyCenterCard from "./_components/SafetyCenterCard";
import PrivacyCompliancePanel from "./_components/PrivacyCompliancePanel";
import OrderDetail from "./_components/OrderDetailModal";
import ReviewForm from "./_components/ReviewFormModal";
import {
  readAuthAccount,
  openAuthSheet,
  AUTH_CHANGED_EVENT,
  type AuthAccount,
} from "@/components/oto-ui/auth/AuthSheet";

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
  /** 3 大抽屉式二级菜单（信息架构重组：18 层平铺 → 安全中心 / 隐私合规 / 系统设置）。 */
  const [drawer, setDrawer] = useState<null | "safety" | "privacy" | "system">(null);
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
  // P1 第 3 步：我的订单双源聚合数据面（waves 弹药单 + bookings 预订卡）
  const waves = useWaveStore((s) => s.waves);
  const claimsAgg = useWaveStore((s) => s.claims);
  const fulfilment = useWaveStore((s) => s.fulfilment);

  /* ═══ P1 第 3 步：我的订单双源聚合视图（waves 弹药单 + bookings 预订卡） ═══
   * 治理「行程屏有单、个人中心空」的丢单假象：waves 与 bookings 统一结构、
   * createdAt 倒序混排、类型徽标显式区分；WAVE 条目点击直达 Trip 履约座舱。 */
  const FIVE_STATE_LABEL: Record<AtomicFiveState, string> = {
    PUBLISHED: "广播中",
    MATCHED: "已接单",
    IN_SERVICE: "履约中",
    INSPECTED: "待验收",
    SETTLED: "已结算",
  };
  const BOOKING_STATUS_LABEL: Record<Booking["status"], string> = {
    upcoming: "待出行",
    completed: "已完成",
    cancelled: "已取消",
  };
  const unifiedOrders = useMemo(() => {
    const waveItems = waves
      .filter((w) => w.authorId === identity.id && !w.removed)
      .map((w) => {
        let statusDisplay: string;
        if (w.status === "pending") {
          statusDisplay = "待支付";
        } else {
          const acceptedClaim = claimsAgg.find(
            (c) => c.waveId === w.id && (c.status === "accepted" || c.status === "joined"),
          );
          const flags = fulfilment[w.id];
          const five = toAtomicFiveState({
            waveStatus: w.status,
            claimStatus: acceptedClaim?.status,
            fulfilmentStatus: flags?.fulfilmentStatus,
            isSettled: flags?.isSettled,
          });
          statusDisplay = FIVE_STATE_LABEL[five] ?? "进行中";
        }
        return {
          id: w.id,
          title: w.basics.category,
          amountDisplay: `¥${w.budget}`,
          createdAt: w.createdAt,
          sourceType: "WAVE" as const,
          statusDisplay,
        };
      });
    const bookingItems = bookings.map((b) => ({
      id: b.id,
      title: b.title,
      amountDisplay: b.price,
      createdAt: b.createdAt,
      sourceType: "BOOKING" as const,
      statusDisplay: BOOKING_STATUS_LABEL[b.status],
    }));
    return [...waveItems, ...bookingItems].sort((a, b) => b.createdAt - a.createdAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waves, claimsAgg, fulfilment, bookings, identity.id]);
  const setScreen = useAppStore((s) => s.setScreen);
  const myCrisis = crisisRecords.filter(
    (c) => c.userId === identity.id && !c.resolved
  );
  const [crisisLevel, setCrisisLevel] = useState<CrisisLevel>(1);
  const [crisisNote, setCrisisNote] = useState("");
  const [crisisTargets, setCrisisTargets] = useState<string[]>([]);
  const [crisisSmsText, setCrisisSmsText] = useState("");
  const [lastForget, setLastForget] = useState<ForgetKind | null>(null);
  /** W6 总装：长辈模式全屏覆盖 + 应急伪装计算器呼出（5.8.2 / 5.8.3 生产入口）。 */
  const [seniorMode, setSeniorMode] = useState(false);
  const [stealthOpen, setStealthOpen] = useState(false);
  const [stealthAlarmed, setStealthAlarmed] = useState(false);
  /** 紧急联系人（动态表单 schema 驱动，localState 持有）。 */
  const [contactsSaved, setContactsSaved] = useState(false);
  const [contactForm, setContactForm] = useState<FormValues>({ name: "妈妈", relation: "家人", phone: "138-0000-0001" });
  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([{ name: "妈妈", phone: "138-0000-0001" }]);

  // 方案 A：前台内嵌登录抽屉（AuthSheet）—— 登录态即时刷新（oto:auth-changed）
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(null);
  useEffect(() => {
    const syncAuth = async () => {
      await Promise.resolve()
      setAuthAccount(readAuthAccount())
    }
    syncAuth()
    const onAuth = () => setAuthAccount(readAuthAccount());
    window.addEventListener(AUTH_CHANGED_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuth);
  }, []);

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
    <div className="pointer-events-auto flex flex-col gap-3">
      {/* 访客/登录行：数据来源 + 本地模式入口（G-5；登录后提示云端由数据化替换） */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-brandPurple/[0.08] border border-brandPurple/25">
        <span className="text-xs">💠</span>
        <p className="flex-1 min-w-0 text-xs text-white/68">
          {authAccount
            ? `已登录 · ${authAccount.nickname}（${authAccount.role === "employer" ? "需求方" : authAccount.role === "provider" ? "服务者" : "组局主理人"}）· 数据存本机浏览器`
            : `访客 · 本地演示身份「${identity.nickname}」 · 数据存本机浏览器`}
        </p>
        <button
          onClick={() => {
            openAuthSheet();
          }}
          aria-label={authAccount ? "切换账号" : "登录"}
          className="shrink-0 px-2 py-1 rounded-full btn-primary text-xs font-bold inline-flex items-center gap-1"
        >
          <LogIn size={9} />
          {authAccount ? "切换账号" : "登录 · 注册"}
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("oto:env-info"))}
          aria-label="了解数据模式"
          className="shrink-0 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-brandPurple-foreground hover:bg-white/10 transition-colors"
        >
          数据模式
        </button>
        {onGoHome && (
          <button
            onClick={onGoHome}
            className="shrink-0 px-2 py-1 rounded-full btn-primary text-xs font-bold"
          >
            去雷达
          </button>
        )}
      </div>

      {/* 用户主身份卡（头像 / 昵称 / 认证状态 / 会员标识） */}
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
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brandPurple border border-white/30 flex items-center justify-center text-xs shadow-md group-hover:scale-110 transition-transform">
            ✎
          </span>
          <input
            type="file"
            name="avatar-upload"
            accept="image/*"
            className="hidden"
            aria-label="上传本地头像"
            onChange={onPickAvatar}
          />
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* P1 第 3 步：名字动态化（登录态=账号昵称，访客态=本地演示身份昵称），根治 Alex 硬编码 */}
            <span className="text-[15px] font-extrabold">
              {authAccount?.nickname ?? identity.nickname}
            </span>
            <BadgeCheck size={14} className="text-brandCyan" />
          </div>
          <p className="text-xs text-white/68 mt-0.5">
            线下体验玩家 · 已撮合 {bookings.length} 单
          </p>
        </div>
        {/* P1 第 3 步：会员徽标仅登录态展示，访客态换中性「演示体验」徽标（根治虚假钻石会员） */}
        {authAccount ? (
          <span className="text-xs px-2 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 text-brandPurple font-semibold shrink-0">
            钻石会员
          </span>
        ) : (
          <span
            data-testid="guest-demo-badge"
            className="text-xs px-2 py-1 rounded-full bg-white/[0.06] border border-white/15 text-white/60 font-semibold shrink-0"
          >
            [ 演示体验 ]
          </span>
        )}
      </motion.div>

      {/* 资产钱包卡（总订单 / 待出行 / 已评价 + 点账钱包；子组件化搬移，DOM 零漂移） */}
      <WalletStatsCard
        bookingsCount={bookings.length}
        upcoming={upcoming}
        reviewed={reviewed}
        sandbox={!authAccount}
      />

      {/* 服务者工作台入口卡（四大工种资质准入全景看板） */}
      <button
        onClick={() => setView("workbench")}
        className="glass-panel rounded-2xl p-3.5 flex items-center gap-3 text-left hover:border-brandPurple/50 transition-colors active:scale-[0.99]"
      >
        <div className="w-10 h-10 rounded-xl btn-primary flex items-center justify-center shrink-0 glow-purple-strong">
          <ArrowRightLeft size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-bold block">服务者工作台</span>
          <span className="text-xs text-white/68 block mt-0.5 truncate">
            切到服务者视角 · 资质准入 / 接单 / 履约 / 收益
          </span>
        </div>
        <span className="text-white/68 text-lg shrink-0">›</span>
      </button>

      {/* 3 大抽屉式二级菜单入口（安全中心 / 隐私合规 / 系统设置） */}
      <div className="grid grid-cols-3 gap-2" data-testid="drawer-entries">
        {(
          [
            { key: "safety", icon: "🛡️", title: "安全中心", sub: "求助·防护" },
            { key: "privacy", icon: "🔒", title: "隐私合规", sub: "分级·脱敏" },
            { key: "system", icon: "⚙️", title: "系统设置", sub: "偏好·备份" },
          ] as const
        ).map((d) => (
          <button
            key={d.key}
            onClick={() => setDrawer(d.key)}
            data-testid={`drawer-entry-${d.key}`}
            className="min-h-16 glass-panel-interactive rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1 hover:border-brandPurple/50 active:scale-95 transition-[border,transform]"
          >
            <span className="text-base leading-none">{d.icon}</span>
            <span className="text-xs font-extrabold text-white/95">{d.title}</span>
            <span className="text-xs text-white/68">{d.sub}</span>
          </button>
        ))}
      </div>

      {/* 我的订单（P1 第 3 步：waves+bookings 双源聚合 · createdAt 倒序 · 类型徽标） */}
      <div data-testid="my-orders">
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1.5">
          <span className="w-1 h-3.5 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" />
          我的订单
        </h3>
        {unifiedOrders.length === 0 ? (
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-xs text-white/68">
              还没有订单——去 AI 助手说句需求，马上撮合
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {unifiedOrders.map((o) =>
              o.sourceType === "WAVE" ? (
                <button
                  key={o.id}
                  onClick={() => setScreen("trip")}
                  aria-label={`查看方案单 ${o.title} 履约进度`}
                  data-testid="order-item-wave"
                  className="glass-panel rounded-2xl p-3 flex items-center gap-2.5 text-left hover:border-brandPurple/50 active:scale-[0.99] transition-[border,transform]"
                >
                  <span className="text-base shrink-0">🧾</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs font-extrabold text-white/90 block truncate">
                      {o.title} · {o.amountDisplay}
                    </span>
                    <span className="text-[11px] text-white/50 block mt-0.5">
                      [ 方案单 ] · 点击查看履约进度
                    </span>
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brandCyan/15 border border-brandCyan/30 text-brandCyan shrink-0">
                    {o.statusDisplay}
                  </span>
                </button>
              ) : (
                <button
                  key={o.id}
                  onClick={() => setSelectedBooking(o.id)}
                  aria-label={`查看预订卡 ${o.title}`}
                  data-testid="order-item-booking"
                  className="glass-panel rounded-2xl p-3 flex items-center gap-2.5 text-left hover:border-brandPurple/50 active:scale-[0.99] transition-[border,transform]"
                >
                  <span className="text-base shrink-0">🎟️</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs font-extrabold text-white/90 block truncate">
                      {o.title} · {o.amountDisplay}
                    </span>
                    <span className="text-[11px] text-white/50 block mt-0.5">[ 预订卡 ]</span>
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brandPurple/15 border border-brandPurple/30 text-brandPurple shrink-0">
                    {o.statusDisplay}
                  </span>
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* 我的接单（响应者视角） */}
      <MyClaims />

      {/* S3 关系沉淀：好友 + 待确认的转友请求 */}
      <FriendList />

      {/* ═══ 3 大抽屉式二级菜单（信息架构重组：设置类控件全部收纳，主屏高度缩短 70%） ═══ */}

      {/* ⚙️ 系统设置与高级工具抽屉 */}
      <ProfileDrawer
        open={drawer === "system"}
        onClose={() => setDrawer(null)}
        title="系统设置与高级工具"
        subtitle="撮合偏好 · 推送管控 · 数据备份 · 演示座舱"
        icon="⚙️"
        testId="drawer-system"
      >
        {/* 撮合偏好（点击标签循环切换，localStorage 持久化） */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2 flex items-center">
            撮合偏好
            <button
              onClick={() => resetPrefs()}
              className="ml-auto text-xs text-white/68 hover:text-white/88 transition-colors"
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
                className="text-xs px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/88 hover:border-brandPurple/50 hover:text-white/88 active:scale-95 transition-all"
              >
                {prefs[key]}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/68 mt-2 leading-relaxed">
            点击标签切换偏好，将用于撮合匹配排序（本地保存）
          </p>
        </div>

        {/* LAUNCH-GAP E 组：PWA 真推（VAPID 订阅 + 测试发送） */}
        <PushEnableBar />

        {/* ADR-0016 推送免打扰：用户自主静音窗口（不绑付费） */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2 flex items-center gap-1.5">
            推送免打扰
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/68">
              自主设置 · 不绑付费
            </span>
          </h3>
          <label className="flex items-center justify-between gap-2 text-xs text-white/88 cursor-pointer">
            <span>开启免打扰</span>
            <input
              type="checkbox"
              name="quiet-toggle"
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
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      on
                        ? "bg-brandPurple/25 border-brandPurple/50 text-brandPurple-foreground"
                        : "bg-white/[0.06] border-white/10 text-white/88"
                    }`}
                  >
                    {on ? "✓ " : ""}{w.label}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-white/68 mt-2 leading-relaxed">
            静音时段不弹通知；紧急提醒（报价/接单/好友/危机）不受影响
          </p>
        </div>

        {/* 演示座舱：三视角一键切换 */}
        <CockpitDemoCard />

        {/* 本地数据备份 */}
        <DataPortCard />

        {/* 能力声明编辑 */}
        <CapabilityPanel />
      </ProfileDrawer>

      {/* 🔒 隐私与数据合规抽屉（面板内容子组件化搬移，rights-entry 等锚点零漂移） */}
      <ProfileDrawer
        open={drawer === "privacy"}
        onClose={() => setDrawer(null)}
        title="隐私与数据合规"
        subtitle="未成年人分级 · 数据脱敏 · 遗忘权（个保法 §47）"
        icon="🔒"
        testId="drawer-privacy"
      >
        <PrivacyCompliancePanel
          identity={identity}
          birthYearInput={birthYearInput}
          onBirthYearInputChange={setBirthYearInput}
          onAgeSave={() => {
            const by = parseInt(birthYearInput, 10);
            if (!Number.isFinite(by) || by < 1970 || by > new Date().getFullYear()) {
              return;
            }
            setAge(by);
          }}
          onGuardianConsent={(checked) => setAge(identity.birthYear, checked)}
          onRequestForget={(kind) => {
            const out = requestForget(kind);
            setLastForget(out.fresh ? kind : null);
          }}
          forgetRequests={forgetRequests}
          lastForget={lastForget}
        />
      </ProfileDrawer>

      {/* 🛡️ 安全中心与应急防护抽屉 */}
      <ProfileDrawer
        open={drawer === "safety"}
        onClose={() => setDrawer(null)}
        title="安全中心与应急防护"
        subtitle="紧急求助 · 长辈模式 · 应急伪装 · 紧急联系人"
        icon="🛡️"
        testId="drawer-safety"
      >
        {/* 治理与安全四件套总入口（SafetyKit：见面兜底 · 安全面基点 · 平台治理后台） */}
        <SafetyKit />

        {/* ADR-0013 安全中心：SOS 危机干预（N8/N10 接线；子组件化搬移，DOM 零漂移） */}
        <SafetyCenterCard
          crisisLevel={crisisLevel}
          crisisNote={crisisNote}
          myCrisis={myCrisis}
          crisisTargets={crisisTargets}
          crisisSmsText={crisisSmsText}
          onSelectLevel={setCrisisLevel}
          onNoteChange={setCrisisNote}
          onRaise={() => {
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
          onResolve={() => resolveCrisis(myCrisis[0].id)}
        />

        {/* W6 总装：无障碍与隐蔽防护（5.8.2 长辈模式 + 5.8.3 静默伪装计算器生产入口） */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2">
            无障碍与隐蔽防护（WCAG AAA / 极端物理防护）
          </h3>
          <div className="flex gap-1.5">
            <button
              onClick={() => setSeniorMode(true)}
              className="flex-1 px-2 py-2 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold hover:bg-amber-400/25 active:scale-95 transition-all"
            >
              👵 长辈模式
            </button>
            <button
              onClick={() => setStealthOpen(true)}
              className="flex-1 px-2 py-2 rounded-lg bg-purple-400/15 border border-purple-400/40 text-purple-300 text-xs font-extrabold hover:bg-purple-400/25 active:scale-95 transition-all"
            >
              🛡️ 应急伪装
            </button>
          </div>
          {stealthAlarmed && (
            <p className="text-xs text-red-300/80 mt-2">
              ⚠️ 静默报警已触发：录音就绪，红色危机流程已启动（界面无任何异常显示）
            </p>
          )}
        </div>

        {/* 紧急联系人登记（动态表单 N2）：SOS 通知对象，schema 驱动 */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2">
            紧急联系人（SOS 通知对象）
          </h3>
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
            <p className="text-xs text-emerald-300/80 mt-2">
              ✓ 已保存：{contacts[0].name}（{mask("phone", contacts[0].phone)}）
            </p>
          )}
        </div>
      </ProfileDrawer>

      {/* W6 总装：长辈模式全屏覆盖（5.8.2：双主按钮 + 1.4x 字阶 AAA） */}
      {seniorMode && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black">
          <div className="flex justify-end p-3">
            <button
              onClick={() => setSeniorMode(false)}
              aria-label="退出长辈模式"
              className="px-4 py-2 rounded-xl border border-white/40 text-white text-[13px] font-bold bg-white/10"
            >
              退出长辈模式
            </button>
          </div>
          <div className="flex justify-center px-4 pb-10">
            <SeniorModeView
              onVoiceStart={() => {
                setSeniorMode(false);
                onGoHome?.();
              }}
              onCallSupport={() => {
                /* 24h 适老热线：拨号动作由宿主层承载 */
              }}
            />
          </div>
        </div>
      )}

      {/* W6 总装：应急伪装计算器覆盖层（5.8.3：真实运算 + 911=/110= 静默报警 + 双击/长按脱身） */}
      {stealthOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative">
            <button
              onClick={() => setStealthOpen(false)}
              aria-label="退出伪装模式"
              className="absolute -top-8 right-0 text-xs text-white/68"
            >
              ✕ 退出伪装
            </button>
            <StealthCalculator
              onTriggerSilentAlarm={(payload: SilentAlarmPayload) => {
                // 静默触发红色危机流程：界面零视觉闪烁，后台登记危机 + 录音就绪
                setStealthAlarmed(true);
                raiseCrisis({
                  level: 3,
                  note: `静默报警（伪装计算器暗号 ${payload.code}，录音就绪）`,
                  contacts: contacts.map((c) => c.name),
                });
              }}
              onExitPanicMode={() => setStealthOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}



