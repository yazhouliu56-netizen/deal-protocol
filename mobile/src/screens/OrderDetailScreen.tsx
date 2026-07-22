import React, { useRef, useEffect } from "react"
import {
  View, Text, SafeAreaView, ScrollView, TouchableOpacity, Animated, StatusBar,
} from "react-native"
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../App"

type RoutePropType = RouteProp<RootStackParamList, "OrderDetail">
type NavProp = NativeStackNavigationProp<RootStackParamList, "OrderDetail">

const STEPS = [
  { label: "资金托管", icon: "💠" },
  { label: "施工中", icon: "🛠" },
  { label: "验收中", icon: "🔍" },
  { label: "已结算", icon: "💰" },
]

function StepNode({ step, index, currentStep }: { step: typeof STEPS[number]; index: number; currentStep: number }) {
  const stepNum = index + 1
  const isDone = currentStep > stepNum
  const isCurrent = currentStep === stepNum
  const isFuture = currentStep < stepNum
  const scaleAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isCurrent) {
      // Ripple in on mount
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      ]).start()
    }
  }, [isCurrent, scaleAnim])

  return (
    <View className="items-center">
      <Animated.View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          isDone ? "bg-emerald-500" :
          isCurrent ? "bg-indigo-600" :
          "bg-slate-100 dark:bg-zinc-800"
        }`}
        style={isCurrent ? { transform: [{ scale: scaleAnim }] } : undefined}
      >
        <Text className={`text-sm ${isDone ? "text-white" : isCurrent ? "text-white" : "text-slate-400 dark:text-zinc-500"}`}>
          {isDone ? "✓" : step.icon}
        </Text>
      </Animated.View>
      {isCurrent && (
        <Animated.View
          className="absolute h-12 w-12 rounded-full border-2 border-indigo-300"
          style={{
            opacity: scaleAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: scaleAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.8, 1.4] }) }],
          }}
        />
      )}
      <Text className={`text-[9px] font-medium mt-1.5 ${currentStep >= stepNum ? "text-slate-700 dark:text-zinc-300" : "text-slate-400 dark:text-zinc-600"}`}>
        {step.label}
      </Text>
    </View>
  )
}

export default function OrderDetailScreen() {
  const route = useRoute<RoutePropType>()
  const navigation = useNavigation<NavProp>()
  const currentStep = 2
  const amount = 120
  const orderTitle = "空调加氟"
  const providerName = "张师傅"
  const providerCredit = 790
  const customerName = "王先生"

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="px-4">
        {/* ═══ Smart Stepper ═══ */}
        <View className="mt-4 mb-6 rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
          <View className="flex-row items-center justify-between">
            {STEPS.map((step, i) => (
              <StepNode key={step.label} step={step} index={i} currentStep={currentStep} />
            ))}
          </View>
          {/* Progress track */}
          <View className="relative mt-2 mx-1 h-0.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${Math.max(0, ((currentStep - 1) / 3) * 100)}%` }}
            />
          </View>
        </View>

        {/* ═══ Protocol Card ═══ */}
        <View className="mb-4 rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
          <Text className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">协议内容</Text>
          <View className="flex-row justify-between items-start">
            <View className="flex-1 mr-4">
              <Text className="text-base font-bold text-slate-900 dark:text-zinc-100" numberOfLines={2}>{orderTitle}</Text>
            </View>
            <Text className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">¥{amount}</Text>
          </View>
          <View className="mt-3 flex-row items-center gap-1">
            <Text className="text-[10px] text-slate-500 dark:text-zinc-400">📍 朝阳区建国路88号</Text>
            <Text className="text-[10px] text-slate-400">·</Text>
            <Text className="text-[10px] text-slate-500 dark:text-zinc-400">今日 14:00</Text>
          </View>
        </View>

        {/* ═══ Participants ═══ */}
        <View className="mb-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-slate-200/60 bg-white p-4 dark:border-zinc-800/60 dark:bg-zinc-900">
            <Text className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">客户</Text>
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/30">
                <Text className="text-xs font-bold text-indigo-700 dark:text-indigo-400">{customerName[0]}</Text>
              </View>
              <Text className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{customerName}</Text>
            </View>
          </View>
          <View className="flex-1 rounded-2xl border border-slate-200/60 bg-white p-4 dark:border-zinc-800/60 dark:bg-zinc-900">
            <Text className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">服务商</Text>
            <View className="flex-row items-center gap-2.5">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/30">
                <Text className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{providerName[0]}</Text>
              </View>
              <View>
                <Text className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{providerName}</Text>
                <View className="rounded-full bg-emerald-50 px-1.5 py-0.5 mt-0.5 dark:bg-emerald-950/30">
                  <Text className="text-[8px] font-semibold text-emerald-600 dark:text-emerald-400">👑 顶级工匠 | {providerCredit}分</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ═══ Action Buttons ═══ */}
        <View className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
          <TouchableOpacity className="rounded-xl bg-emerald-600 py-4 items-center mb-3 shadow-sm" activeOpacity={0.7}>
            <Text className="text-base font-bold text-white">验证无误，释放托管资金</Text>
          </TouchableOpacity>
          <TouchableOpacity className="rounded-xl border border-slate-200/60 py-3 items-center dark:border-zinc-800/60" activeOpacity={0.7}>
            <Text className="text-sm font-semibold text-amber-600 dark:text-amber-400">🚨 申请官方介入 / SOS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export { StepNode }
