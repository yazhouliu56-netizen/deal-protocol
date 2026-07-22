import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { colors, fonts, spacing, borderRadius } from '../theme'

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
  currency = '¥',
}: PriceSliderProps) {
  const inSuggested =
    suggestedMin != null &&
    suggestedMax != null &&
    value >= suggestedMin &&
    value <= suggestedMax

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>服务价格</Text>
        <Text style={[styles.value, inSuggested && styles.valueSuggested]}>
          {currency}{value.toLocaleString()}
        </Text>
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.rangeLabel}>{currency}{min}</Text>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          onValueChange={onChange}
          minimumTrackTintColor={colors.brand[600]}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.foreground}
        />
        <Text style={styles.rangeLabel}>{currency}{max.toLocaleString()}</Text>
      </View>

      {suggestedMin != null && suggestedMax != null && (
        <View style={styles.suggestionRow}>
          <View style={styles.suggestionDot} />
          <Text style={styles.suggestionText}>
            AI 建议区间：{currency}{suggestedMin.toLocaleString()} - {currency}{suggestedMax.toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
  },
  value: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    color: colors.foreground,
  },
  valueSuggested: {
    color: colors.success,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  rangeLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    width: 60,
    textAlign: 'center',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  suggestionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  suggestionText: {
    fontSize: fonts.sizes.xs,
    color: colors.success,
  },
})
