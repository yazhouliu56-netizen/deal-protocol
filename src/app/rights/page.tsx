"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const rightsData = [
  {
    icon: "📊",
    title: "知情权",
    subtitle: "数据可查，透明公开",
    description:
      "您有权查看自己的完整交易记录、信用评分变动历史、每笔订单的资金流向明细。平台提供数据导出功能，您可以随时下载自己的交易数据进行核验。",
    details: [
      "交易记录完整可追溯，保留至少 3 年",
      "信用评分变动实时通知并附原因说明",
      "资金托管状态随时可查，每笔变动均有记录",
      "平台规则更新提前公示，征求用户意见",
    ],
  },
  {
    icon: "⚖️",
    title: "申诉权",
    subtitle: "处罚前通知，给予申辩机会",
    description:
      "平台在对用户做出信用扣分、账户限制、服务下架等处罚前，将提前通知用户并说明原因。用户有权在规定期限内提交申诉材料和申辩意见。",
    details: [
      "处罚措施执行前至少提前 24 小时通知",
      "明确告知处罚依据和对应规则条款",
      "用户可在 48 小时内提交申诉材料",
      "平台在收到申诉后 24 小时内给予回应",
    ],
  },
  {
    icon: "💡",
    title: "建议权",
    subtitle: "您的意见，我们倾听",
    description:
      "我们欢迎用户对平台规则、服务质量、用户体验等方面提出建议。每一条建议都会被认真记录和评估，优质建议将获得信用分奖励。",
    details: [
      "可通过平台反馈渠道提交建议",
      "建议处理进度实时可查",
      "每季度评选最佳建议并给予奖励",
      "规则修订时优先考虑合理建议",
    ],
  },
  {
    icon: "🏆",
    title: "信用等级说明",
    subtitle: "信用体系透明可预期",
    description:
      "平台采用多维度的信用评分体系，综合评估用户的履约能力、服务质量、交易诚信等方面。信用等级直接影响服务权限和资金托管条件。",
    details: [
      "初始信用分 100 分，最高 300 分",
      "优秀（≥200 分）：可享优先推荐、低押金",
      "良好（150-199 分）：标准服务权限",
      "一般（100-149 分）：需缴纳标准押金",
      "待提升（&lt;100 分）：交易额度受限",
    ],
    badge: (
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          优秀 ≥200
        </span>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
          良好 150-199
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          一般 100-149
        </span>
        <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
          待提升 &lt;100
        </span>
      </div>
    ),
  },
  {
    icon: "🏛️",
    title: "争议仲裁原则",
    subtitle: "公开、公平、公正",
    description:
      "平台争议仲裁遵循「三公」原则，确保每一起纠纷得到公正处理。仲裁过程全程留痕，裁决结果附详细理由说明，双方均可查阅。",
    details: [
      "公开：仲裁规则和流程对双方透明",
      "公平：双方平等陈述，证据同等采信",
      "公正：裁决依据事实、合同条款和平台规则",
      "所有仲裁记录存档备查，保留不少于 1 年",
      "对裁决不满可申请复议，复议由更高级别仲裁员处理",
    ],
  },
  {
    icon: "🔒",
    title: "隐私保护",
    subtitle: "数据安全，信息保密",
    description:
      "平台严格保护用户个人信息和交易数据，未经用户授权不会向第三方披露。采用行业标准加密技术保障数据传输和存储安全。",
    details: [
      "个人信息加密存储，分级权限访问",
      "未经授权不向第三方提供用户数据",
      "交易数据仅用于平台运营和信用评估",
      "用户可申请注销账户并删除个人数据",
    ],
  },
];

export default function RightsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="text-center">
<h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
           用户权利与平台规则
        </h1>
        <p className="mt-3 text-lg text-slate-500 dark:text-zinc-500">
           了解您作为平台用户的权利义务和信用体系规则
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {rightsData.map((right) => (
          <a
            key={right.title}
            href={`#${right.title}`}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400"
          >
            {right.icon} {right.title}
          </a>
        ))}
      </div>

      {/* Rights cards */}
      <div className="mt-10 grid gap-8">
        {rightsData.map((right) => (
          <Card key={right.title} id={right.title} className="scroll-mt-20 rounded-2xl border-slate-200/60 dark:border-zinc-800/60 dark:bg-zinc-900">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-2xl dark:bg-indigo-950/30">
                  {right.icon}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl text-slate-900 dark:text-zinc-100">{right.title}</CardTitle>
                  <CardDescription className="mt-1 text-base text-slate-500 dark:text-zinc-500">
                    {right.subtitle}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-700 dark:text-zinc-300">
                {right.description}
              </p>

              {/* Badge section (credit level) */}
              {(right as typeof right & { badge?: React.ReactNode }).badge && (
                <div>{(right as any).badge}</div>
              )}

              <ul className="space-y-2">
                {right.details.map((detail) => (
                  <li
                    key={detail}
                    className="flex items-start gap-2 text-sm text-slate-500 dark:text-zinc-500"
                  >
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    {detail}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <p className="text-slate-500 dark:text-zinc-500">
          如有任何疑问，请随时联系平台客服
        </p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <Link href="/">
            <Button variant="outline">返回首页</Button>
          </Link>
          <Link href="/dashboard">
            <Button>进入控制面板</Button>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
