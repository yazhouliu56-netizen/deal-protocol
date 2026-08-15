"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CircleDollarSign, Clock3, Inbox, Power, ShieldAlert, Star } from "lucide-react";
import {
  useAppStore,
  WORKER_PROFILES,
  type WorkerOrder,
} from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { housekeepingAmmo } from "@/ammo/housekeeping.ammo";
import type { IWorkerRequirement } from "@/types/ammo-schema";

function priceToNumber(price: string): number {
  const m = price.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * 服务者资质档案（S1 R_AUTH 准入判定数据源；本地演示画像，
 * 生产接入 provider_qualifications 表后由服务端下发）。
 */
const WORKER_QUALIFICATIONS: Record<
  string,
  { identityLevel: "BASIC" | "REAL_NAME" | "POLICE_VERIFIED"; safetyScore: number; certificates: string[] }
> = {
  kail: { identityLevel: "REAL_NAME", safetyScore: 82, certificates: [] },
  wang: { identityLevel: "REAL_NAME", safetyScore: 91, certificates: ["HEALTH_CERT"] },
};

/**
 * S1 R_AUTH 供给端准入判定（确定性纯函数，红线 1）：
 * 服务者资质是否满足目标弹药 workerRequirement。
 * 返回缺项清单（空数组 = 达标可接单）。
 */
export function evaluateWorkerQualification(
  profileId: string,
  requirement?: IWorkerRequirement,
): string[] {
  if (!requirement) return [];
  const q = WORKER_QUALIFICATIONS[profileId];
  if (!q) return ["资质档案缺失"];
  const missing: string[] = [];
  if (requirement.requiredIdentityLevel && q.identityLevel !== requirement.requiredIdentityLevel) {
    missing.push(`需实名等级 ${requirement.requiredIdentityLevel}（当前 ${q.identityLevel}）`);
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
  const qualificationMissing = evaluateWorkerQualification(
    providerId,
    housekeepingAmmo.workerRequirement,
  );
  const qualified = qualificationMissing.length === 0;

  return (
    <div className="pointer-events-auto flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white w-fit"
      >
        <ArrowLeft size={14} /> 返回个人中心
      </button>

      {/* 身份切换 */}
      <div className="flex gap-2">
        {WORKER_PROFILES.map((p) => (
          <button
            key={p.id}
            onClick={() => setProviderId(p.id)}
            aria-pressed={providerId === p.id}
            className={`flex-1 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[10.5px] font-bold transition-all ${
              providerId === p.id
                ? "btn-primary glow-purple-strong"
                : "glass-panel text-white/55 hover:text-white"
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
        className="glass-panel rounded-3xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl glass-panel flex items-center justify-center text-lg shrink-0">
            {profile.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-extrabold">{profile.name}</span>
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-yellow-400">
                <Star size={10} className="fill-yellow-400" /> {profile.rating}
              </span>
            </div>
            <p className="text-[10px] text-white/50 mt-0.5">{profile.desc}</p>
          </div>
          <button
            onClick={() => setWorkerOnline(!workerOnline)}
            aria-label="在线接单开关"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors ${
              workerOnline
                ? "bg-emerald-400/15 border border-emerald-400/40 text-emerald-400"
                : "bg-white/[0.06] border border-white/15 text-white/40"
            }`}
          >
            <Power size={11} className={workerOnline ? "fill-emerald-400" : ""} />
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
              className="rounded-xl bg-white/[0.04] border border-white/10 py-2 flex flex-col items-center gap-0.5"
            >
              <span className="text-[13px] font-extrabold bg-clip-text text-transparent bg-linear-to-r from-brandCyan to-brandPurple">
                {s.value}
              </span>
              <span className="text-[9px] text-white/45">{s.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* S1 R_AUTH 供给端准入拦截（动态资质校验） */}
      {!qualified && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3"
          data-auth-gate="blocked"
        >
          <div className="flex items-center gap-2 text-[11px] font-bold text-red-300">
            <ShieldAlert size={13} /> 需补齐资质认证后方可承接家政上门订单
          </div>
          <ul className="mt-1.5 flex flex-col gap-1 text-[10px] text-white/55">
            {qualificationMissing.map((m) => (
              <li key={m}>· {m}</li>
            ))}
          </ul>
        </motion.div>
      )}
      {qualified && (
        <div
          className="rounded-2xl border border-emerald-400/25 bg-emerald-400/8 px-4 py-2.5 text-[10.5px] text-emerald-300 flex items-center gap-2"
          data-auth-gate="passed"
        >
          <Check size={12} /> 资质已达标（实名 + 安全背调 + 健康证），可承接家政上门订单
        </div>
      )}

      {/* 待接单 */}
      <section>
        <SectionTitle icon={<Inbox size={12} className="text-brandCyan" />} title="新订单请求" />
        {!workerOnline && (
          <div className="glass-panel rounded-2xl px-4 py-3 text-[11px] text-white/45 flex items-center gap-2">
            <Power size={12} /> 已暂停接单，AI 撮合会把你推荐给别的服务者
          </div>
        )}
        {pending.length === 0 ? (
          <div className="glass-panel rounded-2xl px-4 py-3 text-[11px] text-white/40">
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
              />
            ))}
          </div>
        )}
      </section>

      {/* 进行中 */}
      {active.length > 0 && (
        <section>
          <SectionTitle icon={<Clock3 size={12} className="text-brandCyan" />} title="进行中" />
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
          <SectionTitle icon={<CircleDollarSign size={12} className="text-emerald-400" />} title="已完成" />
          <div className="flex flex-col gap-2">
            {completed.map((o) => (
              <WorkerOrderRow key={o.id} order={o} done />
            ))}
          </div>
          <p className="text-[10px] text-emerald-400/80 mt-2 flex items-center gap-1">
            <Check size={11} /> 累计入账 ¥{income} · 评价已同步到你的撮合画像
          </p>
        </section>
      )}

      <p className="text-[9px] text-white/30 text-center pb-1">
        本轮演示 · 收益为虚拟结算 · 累计流水 ¥{incoming}
      </p>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="text-[12px] font-bold mb-2 flex items-center gap-1.5">
      <span className="w-1 h-3.5 rounded-full bg-linear-to-b from-brandCyan to-brandPurple" />
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
}: {
  order: WorkerOrder;
  onAction?: () => void;
  actionLabel?: string;
  done?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`glass-panel rounded-2xl p-3 flex items-center gap-3 ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <div className="w-9 h-9 rounded-xl glass-panel flex items-center justify-center text-base shrink-0">
        {order.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-white/90 truncate">
            {order.service}
          </span>
          {done && (
            <span className="text-[9px] px-1.5 py-px rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 font-semibold shrink-0">
              已入账
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/50 mt-0.5 truncate">
          {order.client} · {order.time}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[12px] font-extrabold text-brandCyan">
          {order.price}
        </span>
        {onAction && (
          <button
            onClick={onAction}
            disabled={dimmed}
            className="px-3 py-1 rounded-full btn-primary text-[10px] font-bold glow-purple-strong disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-[filter,transform]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
