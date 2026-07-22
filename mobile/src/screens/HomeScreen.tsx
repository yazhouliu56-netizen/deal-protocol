import React, { useState, useEffect } from "react"
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, StatusBar,
} from "react-native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RootStackParamList } from "../../App"
import { OrderCategory, GeoLocation } from "../types"
import { getCategories, diagnoseOrder } from "../services/api"
import { getCurrentLocation } from "../utils/location"

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">
}

const QUICK_CATEGORIES = [
  { id: "c1", icon: "🛠", label: "管道疏通" },
  { id: "c2", icon: "⚡", label: "电路维修" },
  { id: "c3", icon: "🔑", label: "门窗解锁" },
  { id: "c4", icon: "❄", label: "家电维修" },
  { id: "c5", icon: "🧹", label: "清洁服务" },
  { id: "c6", icon: "📦", label: "搬运输送" },
]

export default function HomeScreen({ navigation }: Props) {
  const [text, setText] = useState("")
  const [categories, setCategories] = useState<OrderCategory[]>([])
  const [location] = useState<GeoLocation | undefined>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getCategories().then(setCategories)
  }, [])

  const handleSubmit = async () => {
    if (!text.trim()) { Alert.alert("提示", "请输入需求描述"); return }
    setLoading(true)
    try {
      const diagnosis = await diagnoseOrder(text)
      navigation.navigate("Diagnosis", { text, diagnosis, location })
    } catch {
      Alert.alert("错误", "诊断失败，请重试")
    }
    setLoading(false)
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Brand + Credit overview */}
        <View className="flex-row items-center justify-between px-6 pt-6 mb-2">
          <View className="flex-row items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
              <Text className="text-[10px] font-bold text-white">dp</Text>
            </View>
            <Text className="text-base font-bold text-slate-900 dark:text-zinc-100">
              deal<Text className="text-indigo-600">-protocol</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Profile")}
            className="flex-row items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 dark:bg-indigo-950/30"
            activeOpacity={0.7}
          >
            <Text className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">👑 780</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View className="px-6 pt-6 pb-5">
          <Text className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100 leading-10">
            描述需求，秒配服务
          </Text>
          <Text className="mt-2 text-sm text-slate-500 dark:text-zinc-400 leading-6">
            AI 智能诊断，分钟级匹配最合适的服务商
          </Text>
        </View>

        {/* Input card */}
        <View className="mx-6 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
          <TextInput
            placeholder="描述您的需求..."
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
            className="min-h-[90px] text-sm text-slate-900 dark:text-zinc-100"
            placeholderTextColor="#94a3b8"
            style={{ textAlignVertical: "top" }}
          />
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="mt-3 items-center rounded-xl bg-indigo-600 py-3.5 shadow-sm"
            activeOpacity={0.7}
          >
            <Text className="text-sm font-bold text-white">
              {loading ? "🔍 AI 诊断中..." : "🔍 AI 诊断需求"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick categories */}
        <View className="mt-6 px-6">
          <Text className="mb-3 text-sm font-bold text-slate-900 dark:text-zinc-100">快捷分类</Text>
          <View className="flex-row flex-wrap gap-2.5">
            {QUICK_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 items-center min-w-[72px] dark:border-zinc-800/60 dark:bg-zinc-900"
                activeOpacity={0.7}
                onPress={() => setText(`${cat.icon} ${cat.label}`)}
              >
                <Text className="text-xl">{cat.icon}</Text>
                <Text className="text-[10px] font-medium text-slate-600 dark:text-zinc-400 mt-1">{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nav links */}
        <View className="mt-6 mx-6 rounded-2xl border border-slate-200/60 bg-white p-1 flex-row dark:border-zinc-800/60 dark:bg-zinc-900">
          {[
            { label: "个人中心", onPress: () => navigation.navigate("Profile") },
            { label: "我的订单", onPress: () => navigation.navigate("MyOrders") },
            { label: "服务者", onPress: () => navigation.navigate("ProviderHome") },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.label}
              className="flex-1 items-center rounded-xl py-3"
              onPress={btn.onPress}
              activeOpacity={0.7}
            >
              <Text className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SOS */}
        <TouchableOpacity
          className="mx-6 mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-rose-600 py-4 shadow-lg"
          onPress={() => navigation.navigate("SOS", { orderId: "" })}
          activeOpacity={0.7}
        >
          <Text className="text-base font-bold text-white">紧急求助 SOS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
