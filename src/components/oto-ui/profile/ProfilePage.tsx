"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  Check,
  LogIn,
  MapPin,
  Star,
} from "lucide-react";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { usePrefStore } from "@/store/usePrefStore";
import { PREF_KEYS } from "@/ammo/prefs";
import { fileToAvatarDataUrl } from "@/base/platform/avatar";
import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import DataPortCard from "./DataPortCard";
import CockpitDemoCard from "./CockpitDemoCard";
import WorkerWorkbench from "./WorkerWorkbench";
import WalletView from "@/components/waves/WalletView";
import PushEnableBar from "@/components/oto-ui/PushEnableBar";
import CapabilityPanel from "@/components/waves/CapabilityPanel";
import MyClaims from "@/components/waves/MyClaims";
import FriendList from "@/components/waves/FriendList";
import { ageFromBirthYear, ageGate, modeOfAge } from "@/base/safe/ageGate";
import { useQuietPrefStore } from "@/store/useQuietPrefStore";
import { useWaveStore } from "@/store/useWaveStore";
import { crisisSms, type CrisisLevel } from "@/base/safe/crisis";
import { mask, type ForgetKind, type SensitiveKind } from "@/base/safe/privacy";
import DynamicFormView, { type FormField, type FormValues } from "@/components/oto-ui/DynamicFormView";
import SeniorModeView from "@/components/oto-ui/SeniorModeView";
import StealthCalculator, { type SilentAlarmPayload } from "@/components/oto-ui/StealthCalculator";
import SafetyKit from "@/components/waves/SafetyKit";
import ProfileDrawer from "./ProfileDrawer";
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
          <p className="text-xs text-white/68 mt-0.5">
            线下体验玩家 · 已撮合 {bookings.length} 单
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-brandPurple/15 border border-brandPurple/30 text-brandPurple font-semibold shrink-0">
          钻石会员
        </span>
      </motion.div>

      {/* 资产与钱包卡（总订单 / 待出行 / 已评价 + 点账钱包余额 / 信用等级 / 充值提现） */}
      <div className="glass-panel rounded-3xl p-3.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "总订单", value: bookings.length },
            { label: "待出行", value: upcoming },
            { label: "已评价", value: reviewed },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-white/[0.04] border border-white/10 py-2.5 flex flex-col items-center gap-0.5"
            >
              <span className="text-lg font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
                {s.value}
              </span>
              <span className="text-xs text-white/68">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <WalletView />
        </div>
      </div>

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

      {/* 我的订单（内容区：查看 / 评价 / 取消） */}
      <div>
        <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1.5">
          <span className="w-1 h-3.5 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" />
          我的订单
        </h3>
        {bookings.length === 0 ? (
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-xs text-white/68">
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

      {/* 🔒 隐私与数据合规抽屉 */}
      <ProfileDrawer
        open={drawer === "privacy"}
        onClose={() => setDrawer(null)}
        title="隐私与数据合规"
        subtitle="未成年人分级 · 数据脱敏 · 遗忘权（个保法 §47）"
        icon="🔒"
        testId="drawer-privacy"
      >
        {/* ADR-0016 未成年人分级：出生年 + 监护人同意 */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2 flex items-center">
            未成年人分级
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-brandPurple/15 border border-brandPurple/30 text-brandPurple-foreground">
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
              className="w-36 rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-xs text-white/88 placeholder:text-white/68 focus:outline-none focus:border-brandPurple/50"
            />
            <button
              onClick={() => {
                const by = parseInt(birthYearInput, 10);
                if (!Number.isFinite(by) || by < 1970 || by > new Date().getFullYear()) {
                  return;
                }
                setAge(by);
              }}
              className="px-3 py-1.5 rounded-lg btn-primary text-xs font-bold"
            >
              保存
            </button>
          </div>
          {identity.birthYear != null && (
            <div className="mt-2 text-xs text-white/68 leading-relaxed">
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
                    <p className="font-bold text-white/88">
                      {mode === "adult" ? "✅" : mode === "teen" ? "🛡️" : "🔒"} {label}
                    </p>
                    {age < 18 && (
                      <p className="mt-1 text-white/68">
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
            <label className="mt-2 flex items-center gap-2 text-xs text-white/68 cursor-pointer">
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

        {/* 数据脱敏预览（掩码效果演示） */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2 flex items-center">
            数据脱敏
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/68">
              对外展示即掩码
            </span>
          </h3>
          {(
            [
              { kind: "phone", v: "138-0000-0001" },
              { kind: "name", v: "张三" },
              { kind: "address", v: "幸福家园小区 3 栋" },
              { kind: "email", v: "zhangsan@oto.app" },
              { kind: "id", v: "110101199001011234" },
            ] as const
          ).map((r) => (
            <div key={r.kind} className="flex items-center justify-between text-xs">
              <span className="text-white/68">{r.kind}</span>
              <span className="text-white/68 font-mono">
                {mask(r.kind as SensitiveKind, r.v)}
              </span>
            </div>
          ))}
        </div>

        {/* 遗忘权 */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2 flex items-center gap-1">
            遗忘权（《个保法》§47：删除或匿名化）
          </h3>
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
                className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/88 hover:border-red-400/40 hover:text-red-300 active:scale-95 transition-all"
              >
                {o.label}
              </button>
            ))}
          </div>
          {lastForget && (
            <p className="text-xs text-emerald-300/80 mt-2">
              ✓ 已提交「{lastForget}」域匿名化请求（幂等合并，处理中）
            </p>
          )}
          {forgetRequests.length > 0 && (
            <div className="space-y-1 mt-2">
              {forgetRequests.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-white/68">
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

        {/* ADR-0013 安全中心：SOS 危机干预（N8/N10 接线） */}
        <div className="glass-panel rounded-2xl p-3.5">
          <h3 className="text-xs font-bold text-white/88 mb-2 flex items-center gap-1.5">
            紧急求助
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/68">
              EPA 递增通知
            </span>
          </h3>
          <p className="text-xs font-bold text-white/88 flex items-center gap-1">
            紧急求助（紧急联系人 → 平台值班 → 警方通道）
          </p>
          <div className="flex gap-1.5 mt-2">
            {([
              { lv: 1, label: "轻微不适" },
              { lv: 2, label: "危险信号" },
              { lv: 3, label: "极端紧急" },
            ] as const).map((o) => (
              <button
                key={o.lv}
                onClick={() => setCrisisLevel(o.lv)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  crisisLevel === o.lv
                    ? o.lv === 3
                      ? "bg-red-400/25 border-red-400/60 text-red-300"
                      : o.lv === 2
                        ? "bg-amber-400/20 border-amber-400/50 text-amber-300"
                        : "bg-white/[0.1] border-white/25 text-white/95"
                    : "bg-white/[0.04] border-white/10 text-white/68"
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
            className="mt-2 w-full rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-xs text-white/88 placeholder:text-white/68 focus:outline-none focus:border-red-400/50"
          />
          <div className="flex items-center gap-2 mt-2">
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
              className="flex-1 px-3 py-2 rounded-lg bg-red-400/20 border border-red-400/50 text-red-300 text-xs font-extrabold hover:bg-red-400/30 active:scale-95 transition-all"
            >
              发起求助
            </button>
            {myCrisis.length > 0 && (
              <button
                onClick={() => resolveCrisis(myCrisis[0].id)}
                className="px-3 py-2 rounded-lg bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold hover:bg-emerald-400/25 active:scale-95 transition-all"
              >
                已平安，结束
              </button>
            )}
          </div>
          {crisisTargets.length > 0 && (
            <div className="space-y-1 mt-2">
              <div className="flex flex-wrap gap-1">
                {crisisTargets.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-red-400/15 border border-red-400/40 text-xs font-bold text-red-300"
                  >
                    📢 已通知 {t}
                  </span>
                ))}
              </div>
              {crisisSmsText && (
                <p className="text-xs text-white/68 bg-white/[0.03] rounded-lg px-2 py-1.5 leading-relaxed">
                  {crisisSmsText}
                </p>
              )}
            </div>
          )}
          {myCrisis.length > 0 && (
            <p className="text-xs text-red-300/80 mt-2">
              处置中：{myCrisis[0].note}（登记于{" "}
              {new Date(myCrisis[0].at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              ）
            </p>
          )}
        </div>

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
          <span className="text-[13px] font-bold truncate">
            {booking.providerName}
          </span>
          <span
            className={`text-xs px-1.5 py-px rounded-full font-semibold shrink-0 ${
              booking.status === "upcoming"
                ? "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple"
                : booking.status === "cancelled"
                  ? "bg-white/10 border border-white/20 text-white/68"
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
        <p className="text-xs text-white/68 mt-0.5 truncate">
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
        className="flex items-center gap-1.5 text-[12px] text-white/88 hover:text-white w-fit"
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
            <p className="text-xs text-white/68">{booking.category}</p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ${
              booking.status === "upcoming"
                ? "bg-brandPurple/20 border border-brandPurple/40 text-brandPurple"
                : booking.status === "cancelled"
                  ? "bg-white/10 border border-white/20 text-white/68"
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

        <div className="flex flex-col gap-2 border-t border-white/10 pt-3 text-[13px]">
          {[
            { k: "服务", v: booking.category },
            { k: "对象", v: booking.providerName },
            { k: "时段", v: booking.time },
            { k: "价格", v: booking.price },
            { k: "订单号", v: booking.id.slice(0, 8).toUpperCase() },
          ].map((line) => (
            <div key={line.k} className="flex gap-2">
              <span className="text-white/68 w-12 shrink-0">{line.k}</span>
              <span className="text-white/95">{line.v}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 履约时间线 */}
      {booking.status === "cancelled" ? (
        <div className="glass-panel rounded-2xl p-4">
          <h3 className="text-xs font-bold text-white/88 mb-3">履约进度</h3>
          <div className="flex items-center gap-2 text-[13px] text-white/68">
            <span className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs">✕</span>
            订单已取消，工作台对应待接单已同步撤回
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-4">
        <h3 className="text-xs font-bold text-white/88 mb-3">履约进度</h3>
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
                    : "bg-white/[0.06] border border-white/15 text-white/68"
                }`}
              >
                {step.done ? <Check size={11} /> : <span className="text-xs">{i + 1}</span>}
              </div>
              <span
                className={`text-[13px] ${
                  step.done ? "text-white/95" : "text-white/68"
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
          className="w-full py-2.5 rounded-2xl glass-panel text-xs font-bold text-white/88 hover:text-red-400 hover:border-red-400/40 transition-colors active:scale-[0.99]"
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
        <p className="text-xs text-white/68">
          你的反馈会帮助 AI 撮合更准～ 已记录 {rating} 星
        </p>
        <button
          onClick={onBack}
          className="mt-3 px-5 py-2 rounded-full btn-primary text-xs font-bold glow-purple-strong"
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
        className="flex items-center gap-1.5 text-[12px] text-white/88 hover:text-white w-fit"
      >
        <ArrowLeft size={14} /> 返回订单
      </button>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-3xl p-4"
      >
        <h2 className="text-[14px] font-extrabold">评价 {booking.providerName}</h2>
        <p className="text-xs text-white/68 mt-0.5">{booking.time}</p>

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
          className="w-full px-3.5 py-2.5 rounded-2xl glass-panel outline-none text-[12px] placeholder:text-white/68 resize-none"
        />
        <button
          onClick={submit}
          disabled={rating === 0}
          className="w-full mt-3 py-2.5 rounded-2xl btn-primary text-xs font-bold glow-purple-strong disabled:opacity-40 disabled:pointer-events-none active:scale-[0.99]"
        >
          {rating === 0 ? "先点星星再提交" : "提交评价"}
        </button>
        <p className="text-xs text-white/68 mt-2 text-center flex items-center justify-center gap-1">
          <MapPin size={9} /> AI 会把评价总结进撮合画像
        </p>
      </motion.div>
    </div>
  );
}
