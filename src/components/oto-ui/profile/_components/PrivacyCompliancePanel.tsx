"use client";
import Link from "next/link";
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
            onChange={(e) => onBirthYearInputChange(e.target.value)}
            placeholder="出生年份（如 2008）"
            className="w-36 rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-xs text-white/88 placeholder:text-white/68 focus:outline-none focus:border-brandPurple/50"
          />
          <button
            onClick={onAgeSave}
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
              name="guardian-consent"
              checked={identity.guardianConsent ?? false}
              onChange={(e) => onGuardianConsent(e.target.checked)}
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
                onRequestForget(o.kind);
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

      {/* E2 合规公示入口：消费者权益与平台规则 */}
      <div className="glass-panel rounded-2xl p-3.5">
        <Link
          href="/rights"
          data-testid="rights-entry"
          className="flex items-center justify-between gap-2 min-h-12 px-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-brandPurple/40 hover:bg-white/[0.06] active:scale-[0.98] transition-all"
        >
          <span className="text-xs font-bold text-white/88 flex items-center gap-1.5">
            ⚖️ 消费者权益与平台保障公示
          </span>
          <span className="text-white/40 text-sm">›</span>
        </Link>
        <p className="text-xs text-white/68 mt-1.5 leading-relaxed">
          依据《电子商务法》《消费者权益保护法》法定公示：知情权·申诉权·建议权·信用等级·争议仲裁·隐私保护
        </p>
      </div>
    </>
  );
}
