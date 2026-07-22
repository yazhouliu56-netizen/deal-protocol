import React from "react"
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity } from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../App"

type NavProp = NativeStackNavigationProp<RootStackParamList, "Profile">

const VERIFICATION_ITEMS = [
  { label: "身份核验", done: true },
  { label: "人脸识别", done: true },
  { label: "钱包绑定", done: true },
]

const BILLING_HISTORY = [
  { id: "1", label: "空调维修服务", amount: 120, status: "settled", date: "07-08" },
  { id: "2", label: "厨房水池疏通", amount: 200, status: "held", date: "07-07" },
  { id: "3", label: "马桶疏通", amount: 80, status: "settled", date: "07-06" },
  { id: "4", label: "电路检修更换开关", amount: 150, status: "held", date: "07-05" },
]

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>()

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ═══ Credit Score Hero ═══ */}
        <View className="items-center pt-8 pb-6">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 mb-4">
            <Text className="text-3xl">👑</Text>
          </View>
          <View className="flex-row items-baseline gap-1.5">
            <Text className="text-4xl font-black text-slate-900 tabular-nums dark:text-zinc-100">780</Text>
            <Text className="text-base text-slate-400 dark:text-zinc-500">/ 300</Text>
          </View>
          <View className="flex-row items-center gap-2 mt-3">
            <View className="rounded-full bg-emerald-50 px-3 py-1 dark:bg-emerald-950/30">
              <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">👑 优秀</Text>
            </View>
            <Text className="text-xs text-slate-500 dark:text-zinc-400">违约风险：极低</Text>
          </View>
          <View className="mt-4 h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
            <View className="h-full w-[78%] rounded-full bg-indigo-600" />
          </View>
        </View>

        {/* ═══ Asset Cards ═══ */}
        <View className="flex-row gap-3 px-4 mb-6">
          <View className="flex-1 rounded-2xl border border-slate-200/60 bg-white p-4 dark:border-zinc-800/60 dark:bg-zinc-900">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">在途托管资金</Text>
            <Text className="mt-1 text-xl font-black text-slate-900 tabular-nums dark:text-zinc-100">¥650</Text>
            <View className="flex-row items-center gap-1.5 mt-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              <Text className="text-[10px] text-indigo-600 dark:text-indigo-400">等待服务完成</Text>
            </View>
          </View>
          <View className="flex-1 rounded-2xl border border-slate-200/60 bg-white p-4 dark:border-zinc-800/60 dark:bg-zinc-900">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">已提现金额</Text>
            <Text className="mt-1 text-xl font-black text-slate-900 tabular-nums dark:text-zinc-100">¥2,840</Text>
            <View className="flex-row items-center gap-1.5 mt-1.5">
              <View className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <Text className="text-[10px] text-emerald-600 dark:text-emerald-400">可继续提现</Text>
            </View>
          </View>
        </View>

        {/* ═══ Verification Status ═══ */}
        <View className="px-4 mb-6">
          <View className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
            <Text className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1">认证状态</Text>
            <Text className="text-xs text-slate-500 dark:text-zinc-400 mb-4">全部认证已完成，享受最高信用额度</Text>
            <View className="gap-2">
              {VERIFICATION_ITEMS.map((item) => (
                <View
                  key={item.label}
                  className="flex-row items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/30 px-4 py-3 dark:border-emerald-900/30 dark:bg-emerald-950/10"
                >
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
                    <Text className="text-sm">✓</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-slate-900 dark:text-zinc-100">{item.label}</Text>
                    <Text className="text-xs text-emerald-600 dark:text-emerald-400">已认证</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ═══ Billing History ═══ */}
        <View className="px-4 mb-6">
          <View className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
            <Text className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-1">资金流水</Text>
            <Text className="text-xs text-slate-500 dark:text-zinc-400 mb-4">最近 4 笔交易记录</Text>
            {BILLING_HISTORY.map((bill, i) => (
              <View key={bill.id}>
                {i > 0 && <View className="my-1.5 border-t border-slate-100 dark:border-zinc-800" />}
                <View className="flex-row items-center justify-between py-1">
                  <View className="flex-1 mr-3">
                    <Text className="text-sm font-medium text-slate-900 dark:text-zinc-100" numberOfLines={1}>{bill.label}</Text>
                    <Text className="text-xs text-slate-400 dark:text-zinc-500">{bill.date}</Text>
                  </View>
                  <View className="flex-row items-center gap-2 shrink-0">
                    <Text className="text-sm font-semibold text-slate-900 tabular-nums dark:text-zinc-100">¥{bill.amount}</Text>
                    <View className={`h-1.5 w-1.5 rounded-full ${bill.status === "settled" ? "bg-emerald-500" : "bg-indigo-500"}`} />
                    <Text className="text-xs text-slate-500 dark:text-zinc-400">{bill.status === "settled" ? "已结算" : "托管中"}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ═══ Profile Info ═══ */}
        <View className="px-4">
          <View className="rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
            <Text className="text-sm font-bold text-slate-900 dark:text-zinc-100 mb-4">账户信息</Text>
            {[
              { label: "姓名", value: "王小明" },
              { label: "身份", value: "客户" },
              { label: "账户余额", value: "¥268.50" },
              { label: "注册时间", value: "2026年3月" },
              { label: "总订单", value: "12 单" },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View className="my-2 border-t border-slate-100 dark:border-zinc-800" />}
                <View className="flex-row justify-between items-center">
                  <Text className="text-sm text-slate-500 dark:text-zinc-400">{item.label}</Text>
                  <Text className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
