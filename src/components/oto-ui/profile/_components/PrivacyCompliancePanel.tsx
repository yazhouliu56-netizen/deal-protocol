"use client";
import Link from "next/link";
import DuoCardShell from "@/components/ui/DuoCardShell";
import DuoPill from "@/components/ui/DuoPill";
import type { Identity } from "@/store/useIdentityStore";
import { ageFromBirthYear, ageGate, modeOfAge } from "@/base/safe/ageGate";
import { mask, type ForgetKind, type ForgetRequest, type SensitiveKind } from "@/base/safe/privacy";

interface PrivacyCompliancePanelProps {
  identity: Identity;
  birthYearInput: string;
  onBirthYearInputChange: (v: string) => void;
  onAgeSave: () => void;
  /** 监护人同意勾选（仅 <14 岁显示）。 */
  onGuardianConsent: (checked: boolean) => void;
  onRequestForget: (kind: ForgetKind) => void;
  forgetRequests: ForgetRequest[];
  lastForget: ForgetKind | null;
}

/** 🔒 隐私与数据合规面板（ProfileDrawer children；子组件化搬移，DOM 零漂移）：
    未成年人分级 · 数据脱敏 · 遗忘权（个保法 §47）· E2 合规公示入口。 */
export default function PrivacyCompliancePanel({
  identity,
  birthYearInput,
  onBirthYearInputChange,
  onAgeSave,
  onGuardianConsent,
  onRequestForget,
  forgetRequests,
  lastForget,
}: PrivacyCompliancePanelProps) {
  return (
    <>
      {/* ADR-0016 未成年人分级：出生年 + 监护人同意 */}
      <DuoCardShell className="rounded-2xl p-3.5">
        <h3 className="text-xs font-bold text-[var(--color-duo-eel)] mb-2 flex items-center">
          未成年人分级
          <DuoPill tone="green" className="ml-auto">
            合规
          </DuoPill>
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1970}
            max={new Date().getFullYear()}
            value={birthYearInput}
            onChange={(e) => onBirthYearInputChange(e.target.value)}
            placeholder="出生年份（如 2008）"
            className="w-36 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-2.5 py-2 text-xs text-[var(--color-duo-eel)] placeholder:text-[var(--color-duo-hare)] focus:outline-none focus:border-[var(--color-duo-green)]/30"
          />
          <button
            onClick={onAgeSave}
            className="px-3 py-2 rounded-xl bg-[var(--color-duo-green)] border-b-4 border-[var(--color-duo-green-dark)] text-neutral-900 text-xs font-bold active:translate-y-1 active:border-b-0 transition-[transform]"
          >
            保存
          </button>
        </div>
        {identity.birthYear != null && (
          <div className="mt-2 text-xs text-[var(--color-duo-wolf)] leading-relaxed">
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
                  <p className="font-bold text-[var(--color-duo-eel)]">
                    {mode === "adult" ? "✅" : mode === "teen" ? "🛡️" : "🔒"} {label}
                  </p>
                  {age < 18 && (
                    <p className="mt-1 text-[var(--color-duo-wolf)]">
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
          <label className="mt-2 flex items-center gap-2 text-xs text-[var(--color-duo-eel)] cursor-pointer">
            <input
              type="checkbox"
              name="guardian-consent"
              checked={identity.guardianConsent ?? false}
              onChange={(e) => onGuardianConsent(e.target.checked)}
              className="accent-[var(--color-duo-green)]"
            />
            监护人已同意我使用本平台（《未保法》§72）
          </label>
        )}
      </DuoCardShell>

      {/* 数据脱敏预览（掩码效果演示） */}
      <DuoCardShell className="rounded-2xl p-3.5">
        <h3 className="text-xs font-bold text-[var(--color-duo-eel)] mb-2 flex items-center">
          数据脱敏
          <DuoPill tone="neutral" className="ml-auto">
            对外展示即掩码
          </DuoPill>
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
            <span className="text-[var(--color-duo-wolf)]">{r.kind}</span>
            <span className="text-[var(--color-duo-eel)] font-mono font-bold">
              {mask(r.kind as SensitiveKind, r.v)}
            </span>
          </div>
        ))}
      </DuoCardShell>

      {/* 遗忘权 */}
      <DuoCardShell className="rounded-2xl p-3.5">
        <h3 className="text-xs font-bold text-[var(--color-duo-eel)] mb-2 flex items-center gap-1">
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
                onRequestForget(o.kind);
              }}
              className="px-2.5 py-1 rounded-full bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-xs text-[var(--color-duo-eel)] font-bold hover:border-[var(--color-duo-red)]/30 hover:text-[var(--color-duo-red)] active:scale-95 transition-all"
            >
              {o.label}
            </button>
          ))}
        </div>
        {lastForget && (
          <p className="text-xs text-[var(--color-duo-green)] mt-2 font-bold">
            ✓ 已提交「{lastForget}」域匿名化请求（幂等合并，处理中）
          </p>
        )}
        {forgetRequests.length > 0 && (
          <div className="space-y-1 mt-2">
            {forgetRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-duo-wolf)]">
                  {r.kind} · {new Date(r.requestedAt).toLocaleDateString("zh-CN")}
                </span>
                <DuoPill tone={r.status === "anonymized" ? "green" : "orange"} className={r.status === "anonymized" ? "" : "bg-orange-100"}>
                  {r.status === "anonymized" ? "已匿名化" : "处理中"}
                </DuoPill>
              </div>
            ))}
          </div>
        )}
      </DuoCardShell>

      {/* E2 合规公示入口：消费者权益与平台规则 */}
      <DuoCardShell className="rounded-2xl p-3.5">
        <Link
          href="/rights"
          data-testid="rights-entry"
          className="flex items-center justify-between gap-2 min-h-12 px-3 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] hover:border-[var(--color-duo-green)]/30 hover:bg-white active:translate-y-0.5 transition-all"
        >
          <span className="text-xs font-bold text-[var(--color-duo-eel)] flex items-center gap-1.5">
            ⚖️ 消费者权益与平台保障公示
          </span>
          <span className="text-[var(--color-duo-hare)] text-sm">›</span>
        </Link>
        <p className="text-xs text-[var(--color-duo-wolf)] mt-1.5 leading-relaxed">
          依据《电子商务法》《消费者权益保护法》法定公示：知情权·申诉权·建议权·信用等级·争议仲裁·隐私保护
        </p>
      </DuoCardShell>
    </>
  );
}
