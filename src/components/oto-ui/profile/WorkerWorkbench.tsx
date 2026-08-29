"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BadgeCheck, Check, CircleDollarSign, Clock3, Inbox, Power, Star } from "lucide-react";
import {
  useAppStore,
  WORKER_PROFILES,
  type WorkerOrder,
} from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import {
  listRegisteredAmmos,
  listAmmoPillDescriptors,
  resolveAmmoRequirementForText,
} from "@/ammo/registry";
import type { IWorkerRequirement, ICustomRequirements } from "@/types/ammo-schema";

function priceToNumber(price: string): number {
  const m = price.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * 服务者资质档案（S1 R_AUTH 准入判定数据源；本地演示画像，
 * 生产接入 provider_qualifications 表后由服务端下发）。
 * age：实龄（阶段3 定制年龄硬门禁数据源）。
 */
const WORKER_QUALIFICATIONS: Record<
  string,
  {
    identityLevel: "BASIC" | "REAL_NAME" | "POLICE_VERIFIED";
    safetyScore: number;
    certificates: string[];
    age: number;
    isPoliceVerified: boolean;
  }
> = {
  kail: { identityLevel: "REAL_NAME", safetyScore: 82, certificates: [], age: 25, isPoliceVerified: false },
  wang: { identityLevel: "REAL_NAME", safetyScore: 91, certificates: ["HEALTH_CERT"], age: 45, isPoliceVerified: true },
};

/** 演示需求方定制声明：期望服务者年龄 20-30 岁（语义驯化产物演示位）。 */
const DEMO_AGE_GATE: ICustomRequirements = { ageRange: [20, 30] };

/**
 * S1 R_AUTH 供给端准入判定（确定性纯函数，红线 1）：
 * 服务者资质是否满足目标弹药 workerRequirement + 需求方定制要求。
 * 返回缺项清单（空数组 = 达标可接单）。
 */
export function evaluateWorkerQualification(
  profileId: string,
  requirement?: IWorkerRequirement,
  custom?: ICustomRequirements,
): string[] {
  if (!requirement) return [];
  const q = WORKER_QUALIFICATIONS[profileId];
  if (!q) return ["资质档案缺失"];
  const missing: string[] = [];
  const IDENTITY_RANK: Record<string, number> = {
    BASIC: 0,
    REAL_NAME: 1,
    POLICE_VERIFIED: 2,
  };
  if (
    requirement.requiredIdentityLevel &&
    (IDENTITY_RANK[q.identityLevel] ?? -1) < IDENTITY_RANK[requirement.requiredIdentityLevel]
  ) {
    missing.push(`需实名等级 ${requirement.requiredIdentityLevel}（当前 ${q.identityLevel}）`);
  }
  if (requirement.isPoliceVerified && !q.isPoliceVerified) {
    missing.push("需公安核验通过（扫脸比对公安底库）");
  }
  if (
    requirement.minSafetyScore !== undefined &&
    q.safetyScore < requirement.minSafetyScore
  ) {
    missing.push(`需安全背调分 ≥${requirement.minSafetyScore}（当前 ${q.safetyScore}）`);
  }
  for (const cert of requirement.requiredCertificates ?? []) {
    if (!q.certificates.includes(cert)) missing.push(`需资格证书 ${cert}`);
  }
  // 阶段3 定制年龄硬门禁：需求方声明 ageRange 且实龄不匹配 → 明确拦截提示
  if (custom?.ageRange) {
    const [lo, hi] = custom.ageRange;
    if (q.age < lo || q.age > hi) {
      missing.push(`年龄条件不匹配（需 ${lo}-${hi} 岁，当前 ${q.age} 岁）`);
    }
  }
  return missing;
}

/**
 * 服务者端工作台（M5+）：服务者视角管理撮合订单，多身份切换。
 * 待接单 → 进行中 → 已完成（收益入账）。在线开关控制接单。
 */
export default function WorkerWorkbench({ onBack }: { onBack: () => void }) {
  const workerOrders = useAppStore((s) => s.workerOrders);
  const workerOnline = useAppStore((s) => s.workerOnline);
  const setWorkerOnline = useAppStore((s) => s.setWorkerOnline);
  const acceptWorkerOrder = useAppStore((s) => s.acceptWorkerOrder);
  const completeWorkerOrder = useAppStore((s) => s.completeWorkerOrder);
  const [providerId, setProviderId] = useState<string>("kail");
  const profile =
    WORKER_PROFILES.find((p) => p.id === providerId) ?? WORKER_PROFILES[0];

  const mine = workerOrders.filter((o) => (o.providerId ?? "kail") === providerId);
  const pending = mine.filter((o) => o.status === "pending");
  const active = mine.filter((o) => o.status === "active");
  const completed = mine.filter((o) => o.status === "completed");
  const income = completed.reduce((sum, o) => sum + priceToNumber(o.price), 0);
  const incoming = workerOrders.reduce((sum, o) => sum + priceToNumber(o.price), 0);

  /** 资质看板判定（登记表驱动）：housekeeping 卡叠加演示年龄定制（既有语义保留）。 */
  const ammoQualification = (ammo: (typeof registeredAmmos)[number]) => {
    const custom = ammo.ammoId === "housekeeping-v1" ? DEMO_AGE_GATE : undefined;
    const missing = evaluateWorkerQualification(providerId, ammo.workerRequirement, custom);
    return { missing, qualified: missing.length === 0 };
  };

  /** 全弹药注册表（单一真理源）：工作台资质看板 + 订单门槛匹配均由此驱动。
   *  每渲染直读注册表（保留动态弹药热注入实时性，React Compiler 不保序手工 memo）。 */
  const registeredAmmos = listRegisteredAmmos();
  const ammoPills = new Map(listAmmoPillDescriptors().map((p) => [p.ammoId, p]));

  /** 订单服务文本 → 弹药准入门槛（注册表中文别名/官方映射只读匹配，零手写业务词）。 */
  const requirementFor = (order: WorkerOrder) =>
    resolveAmmoRequirementForText(order.service);

  /** 订单级准入缺项：无门槛弹药 → 达标；家政单 → 对照资质档案与年龄定制。 */
  const missingFor = (order: WorkerOrder) =>
    evaluateWorkerQualification(
      providerId,
      requirementFor(order),
      requirementFor(order) ? DEMO_AGE_GATE : undefined,
    );

  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-[#777777] hover:text-[#4b4b4b] w-fit font-bold"
      >
        <ArrowLeft size={14} /> 返回个人中心
      </button>

      {/* Microkernel 4.4 批次 2 · 服务者连胜火焰（诚实派生：连胜单数 = 真实已完成单数，零臆造） */}
      <div
        data-testid="streak-flame-card"
        className="duo-3d-card rounded-3xl border-2 border-b-[6px] border-[#ffb020]/30 bg-gradient-to-br from-[#ff9500] via-[#ff6b00] to-[#ff4d00] p-4 shadow-sm text-white"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xl leading-none" aria-hidden="true">🔥</span>
            <span className="text-[14px] font-extrabold tabular-nums">
              连胜 {completed.length} 单
            </span>
            <span className="text-xs font-bold text-white/85 shrink-0">· 守约率 100%</span>
          </div>
          <span
            data-testid="streak-freeze-badge"
            className="text-xs font-bold px-2 py-1 rounded-full bg-white/20 border-2 border-white/30 shrink-0 whitespace-nowrap"
          >
            ❄️ 连胜冻结卡 × 1 保护中
          </span>
        </div>
        <p className="text-xs font-bold text-white/90 mt-1.5">
          解锁周末优先派单权 · 1.2x 流量加权
        </p>
      </div>

      {/* 身份切换 */}
      <div className="flex gap-2">
        {WORKER_PROFILES.map((p) => (
          <button
            key={p.id}
            onClick={() => setProviderId(p.id)}
            aria-pressed={providerId === p.id}
            className={`flex-1 flex items-center gap-1.5 px-3 py-3 rounded-2xl text-xs font-bold transition-all border-b-4 border-x border-t min-h-12 ${
              providerId === p.id
                ? "bg-[#58cc02] border-[#46a302] text-white shadow-sm"
                : "bg-white border-[#e5e5e5] text-[#afafaf] hover:text-[#4b4b4b] hover:border-[#58cc02]/30 shadow-sm"
            }`}
          >
            <span className="text-sm">{p.emoji}</span>
            <span className="truncate">{p.name.split(" · ")[0]}</span>
          </button>
        ))}
      </div>

      {/* 身份卡 + 在线开关 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-3xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#f7f7f7] border-2 border-[#e5e5e5] flex items-center justify-center text-lg shrink-0">
            {profile.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-extrabold text-[#4b4b4b]">{profile.name}</span>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-[#ffc800]">
                <Star size={10} className="fill-[#ffc800]" /> {profile.rating}
              </span>
            </div>
            <p className="text-xs text-[#777777] mt-0.5">{profile.desc}</p>
          </div>
          <button
            onClick={() => setWorkerOnline(!workerOnline)}
            aria-label="在线接单开关"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 border-b-4 text-xs font-bold transition-[transform] min-h-10 active:translate-y-1 active:border-b-2 ${
              workerOnline
                ? "bg-[#d7ffb8] border-[#58cc02]/30 text-[#58cc02] shadow-sm"
                : "bg-[#f7f7f7] border-[#e5e5e5] text-[#afafaf] shadow-sm"
            }`}
          >
            <Power size={11} className={workerOnline ? "fill-[#58cc02] text-[#58cc02]" : ""} />
            {workerOnline ? "接单中" : "已暂停"}
          </button>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          {[
            { label: "今日收益", value: `¥${income}` },
            { label: "进行中", value: active.length },
            { label: "待接单", value: pending.length },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] py-2.5 flex flex-col items-center gap-0.5 shadow-sm"
            >
              <span className="text-[13px] font-extrabold text-[#1cb0f6]">
                {s.value}
              </span>
              <span className="text-xs text-[#777777] font-bold">{s.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* S1 R_AUTH 全方案资质准入看板（注册表单一真理源：每个当前注册弹药
          的 workerRequirement 均跑一遍资质审查，工厂热注新弹药自动长出卡片） */}
      <section data-testid="ammo-qualification-board">
        <SectionTitle icon={<BadgeCheck size={12} className="text-[#1cb0f6]" />} title={`全方案资质准入（${registeredAmmos.length}）`} />
        <div className="grid grid-cols-2 gap-2">
          {registeredAmmos.map((ammo) => {
            const pill = ammoPills.get(ammo.ammoId);
            const { missing, qualified } = ammoQualification(ammo);
            return (
              <motion.div
                key={ammo.ammoId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                data-ammo={ammo.ammoId}
                data-qualified={qualified}
                className={`rounded-2xl border-2 p-2.5 flex flex-col gap-1.5 shadow-sm ${
                  qualified
                    ? "border-[#58cc02]/30 bg-[#d7ffb8]/50 border-b-4"
                    : "border-[#ff4b4b]/20 bg-[#ffdfe0]/40 border-b-4"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm leading-none shrink-0">{pill?.icon ?? "⚡"}</span>
                  <span className="text-xs font-extrabold text-[#4b4b4b] truncate flex-1">
                    {pill?.label ?? ammo.category}
                  </span>
                  <span
                    className={`text-xs font-bold shrink-0 px-1.5 py-px rounded-full border-2 ${
                      qualified
                        ? "text-[#58cc02] border-[#58cc02]/30 bg-white"
                        : "text-[#ff4b4b] border-[#ff4b4b]/20 bg-white"
                    }`}
                  >
                    {qualified ? "已达标" : "未达标"}
                  </span>
                </div>
                <p className="text-xs text-[#afafaf] truncate">{ammo.ammoId}</p>
                {!ammo.workerRequirement ? (
                  <p className="text-xs text-[#777777] font-bold">无门槛 · 通用可接单</p>
                ) : missing.length > 0 ? (
                  <ul className="flex flex-col gap-0.5">
                    {missing.slice(0, 3).map((m) => (
                      <li key={m} className="text-xs text-[#4b4b4b] leading-tight">
                        · {m}
                      </li>
                    ))}
                    {missing.length > 3 && (
                      <li className="text-xs text-[#afafaf]">+{missing.length - 3} 项待补齐</li>
                    )}
                  </ul>
                ) : (
                  <p className="text-xs text-[#58cc02] font-bold">✅ 资质已达标 · 可接单</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* 待接单 */}
      <section>
        <SectionTitle icon={<Inbox size={12} className="text-[#1cb0f6]" />} title="新订单请求" />
        {!workerOnline && (
          <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] border-b-4 shadow-sm px-4 py-3 text-xs text-[#afafaf] font-bold flex items-center gap-2">
            <Power size={12} /> 已暂停接单，AI 撮合会把你推荐给别的服务者
          </div>
        )}
        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-[#e5e5e5] border-b-4 shadow-sm px-4 py-3 text-xs text-[#afafaf] font-bold">
            {workerOnline ? "没有待接单，AI 撮合正在为你找单～" : "开启接单后会收到新请求"}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((o) => (
              <WorkerOrderRow
                key={o.id}
                order={o}
                actionLabel="接受订单"
                onAction={() => acceptWorkerOrder(o.id)}
                dimmed={!workerOnline}
                blocked={missingFor(o).length > 0}
                blockedLabel={
                  missingFor(o).some((m) => m.includes("年龄条件不匹配"))
                    ? "年龄条件不匹配"
                    : "需补齐资质后方可接单"
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* 进行中 */}
      {active.length > 0 && (
        <section>
          <SectionTitle icon={<Clock3 size={12} className="text-[#1cb0f6]" />} title="进行中" />
          <div className="flex flex-col gap-2">
            {active.map((o) => (
              <WorkerOrderRow
                key={o.id}
                order={o}
                actionLabel="完成服务"
                onAction={() => {
                  completeWorkerOrder(o.id);
                  // 响应方商业化：完成后收益入钱包（虚拟结算）
                  useIdentityStore
                    .getState()
                    .book("income", priceToNumber(o.price), `服务收益 · ${o.service}（${o.client}）`);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* 已完成 */}
      {completed.length > 0 && (
        <section>
          <SectionTitle icon={<CircleDollarSign size={12} className="text-[#58cc02]" />} title="已完成" />
          <div className="flex flex-col gap-2">
            {completed.map((o) => (
              <WorkerOrderRow key={o.id} order={o} done />
            ))}
          </div>
          <p className="text-xs text-[#58cc02] mt-2 flex items-center gap-1 font-bold">
            <Check size={11} /> 累计入账 ¥{income} · 评价已同步到你的撮合画像
          </p>
        </section>
      )}

      <p className="text-xs text-[#afafaf] text-center pb-1 font-bold">
        本轮演示 · 收益为虚拟结算 · 累计流水 ¥{incoming}
      </p>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1.5 text-[#4b4b4b]">
      <span className="w-1 h-3.5 rounded-full bg-[#58cc02]" />
      {icon}
      {title}
    </h3>
  );
}

function WorkerOrderRow({
  order,
  onAction,
  actionLabel,
  done,
  dimmed,
  blocked,
  blockedLabel,
}: {
  order: WorkerOrder;
  onAction?: () => void;
  actionLabel?: string;
  done?: boolean;
  dimmed?: boolean;
  blocked?: boolean;
  blockedLabel?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border-2 border-[#e5e5e5] border-b-[6px] shadow-sm p-3 flex items-center gap-3 ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <div className="w-9 h-9 rounded-xl bg-[#f7f7f7] border-2 border-[#e5e5e5] flex items-center justify-center text-base shrink-0">
        {order.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-[#4b4b4b] truncate">
            {order.service}
          </span>
          {done && (
            <span className="text-xs px-1.5 py-px rounded-full bg-[#d7ffb8] border-2 border-[#58cc02]/20 text-[#58cc02] font-bold shrink-0">
              已入账
            </span>
          )}
        </div>
        <p className="text-xs text-[#777777] mt-0.5 truncate">
          {order.client} · {order.time}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[12px] font-extrabold text-[#58cc02]">
          {order.price}
        </span>
        {blocked ? (
          <span className="px-3 py-2 rounded-full bg-[#ff4b4b]/10 border-2 border-[#ff4b4b]/20 text-[#ff4b4b] text-xs font-bold shrink-0">
            {blockedLabel ?? "不满足接单条件"}
          </span>
        ) : (
          onAction && (
            <button
              onClick={onAction}
              disabled={dimmed}
              className="px-4 py-2.5 rounded-xl bg-[#58cc02] border-b-4 border-[#46a302] text-white text-xs font-extrabold shadow-sm disabled:opacity-40 disabled:pointer-events-none active:translate-y-1 active:border-b-0 transition-[transform] min-h-12"
            >
              {actionLabel}
            </button>
          )
        )}
      </div>
    </div>
  );
}
