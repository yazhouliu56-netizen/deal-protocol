import React, { useState, useCallback, useRef, useEffect } from "react"
import {
  View, Text, SafeAreaView, ScrollView, StatusBar, TouchableOpacity, Animated,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../App"
import SlideToAccept from "../components/SlideToAccept"

type NavProp = NativeStackNavigationProp<RootStackParamList, "Grab">

const ORDER = {
  title: "空调加氟",
  description: "空调不制冷了，需要师傅上门检修并加氟，机型为格力1.5匹挂机",
  category: "家电维修",
  price: 120,
  budgetMin: 80,
  budgetMax: 200,
  urgency: "high",
  address: "朝阳区建国路88号",
  distance: "1.2km",
  customerName: "王先生",
  customerCredit: 790,
}

function CountdownBar({ expiresIn }: { expiresIn: number }) {
  const [remaining, setRemaining] = useState(expiresIn)
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    )
    breathing.start()
    return () => breathing.stop()
  }, [pulseAnim])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  const isUrgent = remaining <= 60

  return (
    <Animated.View
      className={`flex-row items-center justify-center px-4 py-3 ${isUrgent ? "bg-rose-50 dark:bg-rose-950/20" : "bg-amber-50 dark:bg-amber-950/20"}`}
      style={{ opacity: pulseAnim }}
    >
      <Text className={`text-sm font-bold tabular-nums font-mono ${isUrgent ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`}>
        🚨 抢单倒计时: {timeStr}
      </Text>
    </Animated.View>
  )
}

function MapPlaceholder() {
  return (
    <View className="h-32 rounded-2xl border border-slate-200/60 bg-slate-100 items-center justify-center dark:border-zinc-800/60 dark:bg-zinc-800">
      <View className="flex-row items-center gap-1">
        <Text className="text-lg">📍</Text>
        <Text className="text-xs text-slate-500 dark:text-zinc-400">地图加载中...</Text>
      </View>
    </View>
  )
}

export default function GrabScreen() {
  const navigation = useNavigation<NavProp>()
  const [step, setStep] = useState<"detail" | "accepted">("detail")
  const fadeAnim = useRef(new Animated.Value(0)).current

  const handleAccept = useCallback(() => {
    setStep("accepted")
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()
  }, [fadeAnim])

  if (step === "accepted") {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
        <Animated.View className="flex-1 items-center justify-center px-6" style={{ opacity: fadeAnim }}>
          <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
            <Text className="text-3xl">✓</Text>
          </View>
          <Text className="text-xl font-bold text-slate-900 dark:text-zinc-100">已接单成功</Text>
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-zinc-400">
            请在「我的订单」中查看详情，联系客户确认上门时间。
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-8 rounded-xl border border-slate-200/60 bg-white px-8 py-3 dark:border-zinc-800/60 dark:bg-zinc-900"
            activeOpacity={0.7}
          >
            <Text className="text-sm font-medium text-slate-700 dark:text-zinc-300">返回</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* ═══ Countdown Bar ═══ */}
      <CountdownBar expiresIn={165} />

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ═══ Order Hero ═══ */}
        <View className="items-center pt-5 pb-4">
          <View className="mb-2 h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600">
            <Text className="text-2xl">❄</Text>
          </View>
          <Text className="text-lg font-bold text-slate-900 dark:text-zinc-100">{ORDER.title}</Text>
          <View className="mt-2 flex-row items-center gap-2">
            <View className="rounded-full bg-emerald-50 px-2.5 py-0.5 dark:bg-emerald-950/30">
              <Text className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">👑 {ORDER.customerCredit}</Text>
            </View>
            <Text className="text-xs text-slate-500 dark:text-zinc-400">{ORDER.customerName}</Text>
            <Text className="text-xs text-slate-400 dark:text-zinc-500">·</Text>
            <Text className="text-xs text-slate-500 dark:text-zinc-400">{ORDER.distance}</Text>
          </View>
          <Text className="mt-3 text-3xl font-black text-indigo-600 tabular-nums dark:text-indigo-400">
            ¥{ORDER.price}
          </Text>
          <Text className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
            预算 ¥{ORDER.budgetMin} - ¥{ORDER.budgetMax}
          </Text>
        </View>

        {/* ═══ Description ═══ */}
        <View className="mb-4 rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">需求详情</Text>
          <Text className="text-sm text-slate-700 dark:text-zinc-300 leading-5">{ORDER.description}</Text>
        </View>

        {/* ═══ Map Placeholder ═══ */}
        <View className="mb-4">
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">服务位置</Text>
          <MapPlaceholder />
          <Text className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5">{ORDER.address}</Text>
        </View>

        {/* ═══ Category + Urgency meta ═══ */}
        <View className="mb-4 rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">订单信息</Text>
          <View className="gap-2">
            {[
              { label: "品类", value: ORDER.category, color: "text-slate-700 dark:text-zinc-300" },
              { label: "紧急度", value: "紧急", color: "text-rose-600 dark:text-rose-400" },
              { label: "距离", value: ORDER.distance, color: "text-slate-700 dark:text-zinc-300" },
            ].map((row) => (
              <View key={row.label} className="flex-row justify-between items-center">
                <Text className="text-xs text-slate-500 dark:text-zinc-400">{row.label}</Text>
                <Text className={`text-xs font-semibold ${row.color}`}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ═══ Fixed Bottom: SlideToAccept ═══ */}
      <View className="border-t border-slate-200 bg-white px-6 pb-8 pt-3 dark:border-zinc-800 dark:bg-zinc-900">
        <SlideToAccept onAccept={handleAccept} label="→ 向右滑动抢单" />
      </View>
    </SafeAreaView>
  )
}
