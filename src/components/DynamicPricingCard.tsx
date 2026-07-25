'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PricingEstimationResult } from '@/modules/m03-category-config/pricing-engine'

interface DynamicPricingCardProps {
  result: PricingEstimationResult
  onAcceptSuggestion?: (price: number) => void
  className?: string
}

const statusConfig = {
  AUTO_RECOMMENDED: {
    label: 'AI 智能评估',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    barColor: 'bg-indigo-500',
  },
  UNDERPRICED: {
    label: '偏低预警',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    barColor: 'bg-amber-500',
  },
  FAIR: {
    label: '合理区间',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    barColor: 'bg-emerald-500',
  },
  PREMIUM: {
    label: '优质出价',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    barColor: 'bg-rose-500',
  },
}

export function DynamicPricingCard({
  result,
  onAcceptSuggestion,
  className,
}: DynamicPricingCardProps) {
  const cfg = statusConfig[result.priceStatus]
  const isAuto = result.priceStatus === 'AUTO_RECOMMENDED'

  const handleAccept = useCallback(() => {
    onAcceptSuggestion?.(result.suggestedOptimalPrice)
  }, [onAcceptSuggestion, result.suggestedOptimalPrice])

  return (
    <Card
      className={cn(
        'w-full overflow-hidden transition-shadow hover:shadow-md',
        isAuto && 'ring-2 ring-indigo-400/40',
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>定价评估</CardTitle>
          <Badge className={cn('text-xs font-semibold', cfg.badgeClass)}>
            {cfg.label}
          </Badge>
        </div>
        <CardDescription>
          复杂度系数 {result.complexityFactor.toFixed(2)}
          {result.categorySlug !== 'general' && ` · ${result.categorySlug}`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isAuto ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-indigo-50 p-4 text-center dark:bg-indigo-950/30">
              <p className="text-xs text-muted-foreground">🤖 AI 智能评估建议出价</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                ¥{result.suggestedOptimalPrice.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                指导区间 ¥{result.recommendedMinPrice} ~ ¥{result.recommendedMaxPrice}
              </p>
            </div>

            {onAcceptSuggestion && (
              <Button
                className="w-full gap-2"
                variant="default"
                onClick={handleAccept}
              >
                一键采纳 AI 推荐预算
              </Button>
            )}
          </div>
        ) : (
          <>
            {onAcceptSuggestion && (
              <Button
                className="w-full gap-2 mb-4"
                variant="outline"
                onClick={handleAccept}
              >
                应用指导价 ¥{result.suggestedOptimalPrice.toLocaleString()}
              </Button>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">成交概率</span>
                <span className="font-semibold tabular-nums">
                  {result.estimatedMatchProbability}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', cfg.barColor)}
                  style={{ width: `${result.estimatedMatchProbability}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center text-sm">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">市场低价</p>
                <p className="font-semibold tabular-nums">
                  ¥{result.recommendedMinPrice.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">市场高价</p>
                <p className="font-semibold tabular-nums">
                  ¥{result.recommendedMaxPrice.toLocaleString()}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.marketAdvice}
        </p>
      </CardFooter>
    </Card>
  )
}
