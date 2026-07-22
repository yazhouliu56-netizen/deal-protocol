import React, { useState, useEffect, useCallback, useRef } from "react"
import {
  View, Text, FlatList, SafeAreaView, TouchableOpacity, RefreshControl, Animated, ScrollView,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../App"
import type { OrderItem, User, Provider } from "../types"
import { getProviderUser, getOrders, getProviders } from "../services/api"

type NavProp = NativeStackNavigationProp<RootStackParamList, "ProviderHome">

const CATEGORY_ICONS: Record<string, string> = {
  c1: "🔧",
  c2: "🔨",
  c3: "⚡",
  c4: "🧹",
  c5: "📦",
}

const CATEGORY_NAMES: Record<string, string> = {
  c1: "家电维修",
  c2: "水管疏通",
  c3: "电工服务",
  c4: "清洁服务",
  c5: "搬运输送",
  c6: "其他",
}

function ProviderSkeleton() {
  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <View className="mx-4 mt-4 rounded-3xl bg-slate-200 p-6 dark:bg-zinc-800">
        <View className="h-8 w-24 animate-pulse rounded-lg bg-slate-300 dark:bg-zinc-700" />
        <View className="mt-2 h-5 w-36 animate-pulse rounded bg-slate-300 dark:bg-zinc-700" />
        <View className="mt-4 h-5 w-44 animate-pulse rounded bg-slate-300 dark:bg-zinc-700" />
      </View>
      <View className="mx-4 mt-6 mb-3">
        <View className="h-5 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
      </View>
      {[1, 2].map((i) => (
        <View key={i} className="mx-4 mb-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <View className="flex-row justify-between mb-3">
            <View className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <View className="h-6 w-16 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-700" />
          </View>
          <View className="flex-row gap-4 mb-3">
            <View className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <View className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <View className="h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
          </View>
          <View className="h-11 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-700" />
        </View>
      ))}
    </ScrollView>
  )
}

function RevenueCard({
  provider, user,
}: {
  provider: Provider | null
  user: User | null
}) {
  const todayEarnings = 840
  const monthlyLocked = 3600
  const creditScore = user?.creditScore ?? 790
  const creditLevel = creditScore >= 800 ? "顶级工匠" : creditScore >= 650 ? "熟练技师" : "初级技师"

  return (
    <View className="mx-4 mt-4 rounded-3xl bg-indigo-600 p-6 shadow-md shadow-indigo-600/10 dark:bg-indigo-950">
      {/* Revenue */}
      <Text className="text-xs font-medium tracking-wider text-indigo-200/80 uppercase">今日预期收入</Text>
      <View className="flex-row items-baseline gap-1 mt-1.5">
        <Text className="text-3xl font-black text-white tabular-nums">¥{todayEarnings}</Text>
        <Text className="text-sm text-indigo-200/70">+8%</Text>
      </View>
      <Text className="mt-1 text-xs text-indigo-200/60">
        本月累计托管中资金 ¥{monthlyLocked.toLocaleString()}
      </Text>

      {/* Divider */}
      <View className="my-4 h-px bg-indigo-500/40" />

      {/* Credit badge */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-amber-400/30">
            <Text className="text-base">👑</Text>
          </View>
          <View>
            <View className="flex-row items-center gap-1.5">
              <Text className="text-sm font-bold text-white">平台认可度</Text>
              <Text className="text-xs text-indigo-200/60">|</Text>
              <Text className="text-sm text-emerald-300 font-semibold">{creditLevel}</Text>
            </View>
            <Text className="text-xs text-indigo-200/60">
              {provider?.completedOrders ?? 0}单完成 · 评分{provider?.rating ?? 4.9}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-2xl font-black text-white tabular-nums">{creditScore}</Text>
          <Text className="text-[10px] text-indigo-200/50">/1000</Text>
        </View>
      </View>
    </View>
  )
}

function JobCard({
  order, providerCount, onPress,
}: {
  order: OrderItem
  providerCount: number
  onPress: () => void
}) {
  const highPriority = order.status === "pending" && (order.price ?? 0) >= 150
  const createdAt = new Date(order.createdAt)
  const timeAgo = Math.floor((Date.now() - createdAt.getTime()) / 60000)
  const timeLabel = timeAgo < 1 ? "刚刚" : timeAgo < 60 ? `${timeAgo}分钟前` : `${Math.floor(timeAgo / 60)}小时前`
  const icon = CATEGORY_ICONS[order.categoryId] ?? "📋"
  const catName = CATEGORY_NAMES[order.categoryId] ?? "其他"

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mb-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <View className="flex-row">
        {/* Priority indicator */}
        {highPriority && (
          <View className="mr-3 w-1 rounded-r-full bg-emerald-500" />
        )}

        <View className="flex-1">
          {/* Header: icon + title + price + competition */}
          <View className="flex-row justify-between items-start mb-2">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
                <Text className="text-sm">{icon}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-900 dark:text-zinc-100" numberOfLines={2}>
                  {order.title}
                </Text>
                <Text className="text-xs text-slate-400 dark:text-zinc-500">{catName}</Text>
              </View>
            </View>
            <View className="items-end shrink-0">
              <Text className="text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                ¥{order.price?.toLocaleString() ?? "—"}
              </Text>
              {highPriority && (
                <View className="mt-0.5 rounded-full bg-amber-50 px-2 py-0.5 dark:bg-amber-950/30">
                  <Text className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">急单</Text>
                </View>
              )}
            </View>
          </View>

          {/* Meta row: distance, time, competition */}
          <View className="flex-row items-center gap-4 mb-3">
            <Text className="text-xs text-slate-500 dark:text-zinc-400">
              📍 {Math.floor(Math.random() * 5) + 1}.{Math.floor(Math.random() * 9)}km
            </Text>
            <Text className="text-xs text-slate-400 dark:text-zinc-500">·</Text>
            <Text className="text-xs text-slate-500 dark:text-zinc-400">⏱ {timeLabel}</Text>
            <Text className="text-xs text-slate-400 dark:text-zinc-500">·</Text>
            <Text className="text-xs text-slate-500 dark:text-zinc-400">
              👥 {providerCount}人竞争
            </Text>
          </View>

          {/* CTA
          <View className="rounded-xl bg-indigo-50 py-3 items-center dark:bg-indigo-950/30">
            <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">查看详情并抢单</Text>
          </View>
          */}
          <TouchableOpacity
            onPress={onPress}
            className="rounded-xl bg-indigo-50 py-3 items-center dark:bg-indigo-950/30"
            activeOpacity={0.7}
          >
            <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">查看详情并抢单</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function ProviderHomeScreen() {
  const navigation = useNavigation<NavProp>()
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  const fetchData = useCallback(async () => {
    try {
      const [pUser, allOrders, providers] = await Promise.all([
        getProviderUser(),
        getOrders(),
        getProviders(),
      ])
      setUser(pUser)
      setOrders(allOrders.filter((o) => o.status === "pending"))
      setProvider(providers.find((p) => p.id === pUser.id) ?? null)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()
    }
  }, [loading, fadeAnim])

  const handlePressJob = (order: OrderItem) => {
    navigation.navigate("Grab", { orderId: order.id })
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
        <ProviderSkeleton />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <Animated.View style={{ opacity: fadeAnim }} className="flex-1">
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#6366f1"
              colors={["#6366f1"]}
            />
          }
          ListHeaderComponent={
            <>
              {/* Revenue card */}
              <RevenueCard provider={provider} user={user} />

              {/* Section title */}
              <View className="mx-4 mt-6 mb-3 flex-row items-center justify-between">
                <Text className="text-base font-bold text-slate-900 dark:text-zinc-100">待接单池</Text>
                <Text className="text-xs text-slate-400 dark:text-zinc-500">
                  {orders.length}个需求
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <View className="items-center justify-center pt-16">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
                <Text className="text-2xl">🛋</Text>
              </View>
              <Text className="mt-4 text-sm font-medium text-slate-500 dark:text-zinc-400">暂无待接订单</Text>
              <Text className="mt-1 text-xs text-slate-400 dark:text-zinc-500">新需求发布后会自动推送</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View className="px-4">
              <JobCard
                order={item}
                providerCount={1 + Math.floor(Math.random() * 5)}
                onPress={() => handlePressJob(item)}
              />
            </View>
          )}
        />
      </Animated.View>
    </SafeAreaView>
  )
}
