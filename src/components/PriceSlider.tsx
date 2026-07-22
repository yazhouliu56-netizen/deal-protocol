"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface PriceSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suggestedMin?: number
  suggestedMax?: number
  currency?: string
}

export function PriceSlider({
  value,
  onChange,
  min = 0,
  max = 1000,
  step = 10,
  suggestedMin,
  suggestedMax,
  currency = "¥",
}: PriceSliderProps) {
  const [dragging, setDragging] = useState(false)
  const pct = ((value - min) / (max - min)) * 100

  const suggestedStart = suggestedMin != null ? ((suggestedMin - min) / (max - min)) * 100 : 0
  const suggestedEnd = suggestedMax != null ? ((suggestedMax - min) / (max - min)) * 100 : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{currency}{min}</span>
        <span className={cn(
          "text-lg font-bold tabular-nums transition-colors",
          dragging ? "text-indigo-600" : "text-foreground",
        )}>
          {currency}{value.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">{currency}{max.toLocaleString()}</span>
      </div>

      <div className="relative h-7 flex items-center">
        {/* Track background */}
        <div className="absolute left-0 right-0 h-1.5 rounded-full bg-muted" />

        {/* AI suggested range */}
        {suggestedMin != null && suggestedMax != null && (
          <div
            className="absolute h-1.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/40"
            style={{ left: `${suggestedStart}%`, width: `${suggestedEnd - suggestedStart}%` }}
          />
        )}

        {/* Filled track */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-indigo-500"
          style={{ width: `${pct}%` }}
        />

        {/* Range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => setDragging(false)}
          onTouchStart={() => setDragging(true)}
          onTouchEnd={() => setDragging(false)}
          className="absolute left-0 right-0 h-7 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-indigo-500
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            [&::-webkit-slider-thumb]:active:scale-95
            [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-indigo-500
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:shadow-md"
        />
      </div>

      {/* AI price suggestion label */}
      {suggestedMin != null && suggestedMax != null && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          AI 建议区间：{currency}{suggestedMin.toLocaleString()} - {currency}{suggestedMax.toLocaleString()}
        </p>
      )}
    </div>
  )
}
