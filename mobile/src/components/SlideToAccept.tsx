import React, { useRef, useCallback } from "react"
import { View, Text, Animated, PanResponder, Dimensions, Platform } from "react-native"
import * as Haptics from "expo-haptics"

const TRACK_HEIGHT = 56
const THUMB_SIZE = 48
const THUMB_MARGIN = (TRACK_HEIGHT - THUMB_SIZE) / 2

interface SlideToAcceptProps {
  onAccept: () => void
  disabled?: boolean
  label?: string
  completeLabel?: string
}

export default function SlideToAccept({
  onAccept,
  disabled = false,
  label = "→ 向右滑动接单",
  completeLabel = "✓ 已接单",
}: SlideToAcceptProps) {
  const slideAnim = useRef(new Animated.Value(0)).current
  const accepted = useRef(false)
  const lastHapticPct = useRef(0)

  const screenWidth = Dimensions.get("window").width
  const containerPadding = 32
  const trackWidth = screenWidth - containerPadding * 2
  const maxSlide = trackWidth - THUMB_SIZE - THUMB_MARGIN * 2

  const triggerHaptic = useCallback((pct: number) => {
    if (Platform.OS === "web") return
    // Light buzz at 30% and 60%
    if (pct >= 0.3 && lastHapticPct.current < 0.3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      lastHapticPct.current = 0.3
    }
    if (pct >= 0.6 && lastHapticPct.current < 0.6) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      lastHapticPct.current = 0.6
    }
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !accepted.current,
      onMoveShouldSetPanResponder: () => !disabled && !accepted.current,
      onPanResponderMove: (_, gesture) => {
        if (accepted.current) return
        const next = Math.max(0, Math.min(gesture.dx, maxSlide))
        slideAnim.setValue(next)

        const pct = next / maxSlide
        triggerHaptic(pct)
      },
      onPanResponderRelease: (_, gesture) => {
        if (accepted.current) return
        if (gesture.dx > maxSlide * 0.65) {
          // Success — double heavy buzz
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            setTimeout(() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            }, 100)
          }
          Animated.spring(slideAnim, {
            toValue: maxSlide,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start(() => {
            accepted.current = true
            onAccept()
          })
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start()
          lastHapticPct.current = 0
        }
      },
    })
  ).current

  const progress = slideAnim.interpolate({
    inputRange: [0, maxSlide],
    outputRange: [0, 1],
  })

  const bgColor = progress.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: ["rgb(79, 70, 229)", "rgb(79, 70, 229)", "rgb(5, 150, 105)"],
  })

  const thumbTranslateX = slideAnim

  if (accepted.current) {
    return (
      <View className="h-14 items-center justify-center rounded-xl bg-emerald-500 shadow-sm">
        <Text className="text-base font-bold text-white">{completeLabel}</Text>
      </View>
    )
  }

  return (
    <View className="relative h-14 justify-center">
      <Animated.View
        className="h-14 justify-center items-center overflow-hidden rounded-xl"
        style={{ backgroundColor: disabled ? "#e2e8f0" : "#eef2ff" }}
      >
        <Text
          className="text-sm font-medium text-center"
          style={{ color: disabled ? "#cbd5e1" : "#6366f1" }}
        >
          {label}
        </Text>
      </Animated.View>
      <Animated.View
        className="absolute top-1 left-1 h-12 w-12 items-center justify-center rounded-full shadow-lg elevation-4"
        style={[
          {
            transform: [{ translateX: thumbTranslateX }],
            backgroundColor: disabled ? "#cbd5e1" : bgColor,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Text className="text-lg text-white">→</Text>
      </Animated.View>
    </View>
  )
}
