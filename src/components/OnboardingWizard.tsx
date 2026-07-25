'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, Sparkles, DollarSign, Upload, Tags, ShieldCheck, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'

type WizardRole = 'demander' | 'provider'

interface OnboardingWizardProps {
  role: WizardRole
  userId: string
  onComplete?: () => void
}

const DEMANDER_STEPS = [
  {
    title: '口语/语音描述诉求',
    description: '用说话代替打字 — 描述您需要的服务，AI 会自动理解并生成服务协议雏形。',
    icon: Mic,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
  },
  {
    title: 'AI 动态提取协议与指导价',
    description: '基于品类大数据和信用模型，AI 自动生成协议条款框架并给出 ¥0-¥9999 智能指导价区间。',
    icon: Sparkles,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
  },
  {
    title: '支付宝一键资金托管',
    description: '确认协议后，通过支付宝托管资金到平台。服务完成满意后自动释放，全程担保。',
    icon: DollarSign,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
]

const PROVIDER_STEPS = [
  {
    title: '上传资质证书',
    description: '上传身份证、从业资格证等资质文件，平台 AI 自动审核认证。认证通过后即可接单。',
    icon: Upload,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    title: '选择服务品类标签',
    description: '选择您擅长的一级和二级服务品类，设置技能标签，提高匹配精准度。',
    icon: Tags,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    title: '质押 ¥500 保证金',
    description: '存入 ¥500 质押金即可解锁 1.2x 优先派单勋章，获得更多优质订单推荐。',
    icon: ShieldCheck,
    color: 'text-rose-500',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
  },
]

export function OnboardingWizard({ role, userId, onComplete }: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [completing, setCompleting] = useState(false)

  const steps = role === 'demander' ? DEMANDER_STEPS : PROVIDER_STEPS

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const supabase = getBrowserSupabase()
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId)
      onComplete?.()
    } catch (err) {
      console.error('Onboarding complete error:', err)
    } finally {
      setCompleting(false)
    }
  }

  const handleProviderStake = () => {
    router.push('/wallet/stake')
  }

  const current = steps[step]
  const Icon = current.icon

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                i <= step
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}
            >
              {i < step ? <CheckCircle2 className="size-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 rounded-full transition-all ${
                  i < step ? 'bg-indigo-600' : 'bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step card */}
      <Card className={`overflow-hidden border-0 shadow-lg ${current.bgColor}`}>
        <CardContent className="p-8 text-center">
          <div
            className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md dark:bg-zinc-800 ${current.color}`}
          >
            <Icon className="size-10" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {current.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {current.description}
          </p>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="gap-1.5 text-sm"
        >
          <ChevronLeft className="size-4" /> 上一步
        </Button>

        <span className="text-xs text-muted-foreground">
          {step + 1} / {steps.length}
        </span>

        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} className="gap-1.5 text-sm">
            下一步 <ChevronRight className="size-4" />
          </Button>
        ) : role === 'provider' ? (
          <Button onClick={handleProviderStake} className="gap-1.5 text-sm bg-rose-600 hover:bg-rose-700">
            <ShieldCheck className="size-4" /> 一键去质押
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={completing}
            className="gap-1.5 text-sm"
          >
            {completing ? '处理中...' : '知道了，开始发布'}
          </Button>
        )}
      </div>
    </div>
  )
}
