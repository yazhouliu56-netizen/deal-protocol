import React, { useState, useEffect, useCallback } from "react"
import {
  View, Text, FlatList, SafeAreaView, TouchableOpacity, RefreshControl, Animated,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../App"
import type { OrderItem, User } from "../types"
import { getMyOrders, getCurrentUser } from "../services/api"

type NavProp = NativeStackNavigationProp<RootStackParamList, "MyOrders">

const TABS = [
  { key: "in_progress", label: "进行中" },
  { key: "pending", label: "待接单" },
  { key: "completed", label: "已完成" },
] as const

type TabKey = (typeof TABS)[number]["key"]

const STATUS_FUND_INFO: Record<string, { label: string; icon: string }> = {
  in_progress: { label: "平台已托管担保，完工后解冻", icon: "💠" },
  grabbed: { label: "资金托管中，服务进行中", icon: "💠" },
  pending: { label: "待服务方接单确认", icon: "⏳" },
  completed: { label: "订单已完成，感谢使用", icon: "✅" },
  cancelled: { label: "订单已取消", icon: "📄" },
}

function OrderListSkeleton() {
  return (
    <View className="px-4 pt-6">
      {[1, 2, 3].map((i) => (
        <View key={i} className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <View className="flex-row justify-between items-center mb-3">
            <View className="h-5 w-40 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <View className="h-6 w-16 animate-pulse rounded-lg bg-slate-200 dark:bg-zinc-700" />
          </View>
          <View className="flex-row items-center gap-2 mb-3">
            <View className="h-4 w-4 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
            <View className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
          </View>
          <View className="h-10 animate-pulse rounded-xl bg-slate-200 dark:bg-zinc-700" />
        </View>
      ))}
    </View>
  )
}

function SegmentedTabs({
  active, onSelect,
}: {
  active: TabKey
  onSelect: (key: TabKey) => void
}) {
  return (
    <View className="mx-4 mb-4 mt-2">
      <View className="flex-row rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
        {TABS.map((tab) => {
          const isActive = tab.key === active
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onSelect(tab.key)}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                isActive ? "bg-white shadow-sm dark:bg-zinc-900" : ""
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-zinc-500"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

function StatusFundBar({ status }: { status: string }) {
  const info = STATUS_FUND_INFO[status]
  if (!info) return null
  const isComplete = status === "completed"
  const isCancelled = status === "cancelled"
  const bgClass = isComplete
    ? "bg-emerald-50"
    : isCancelled
      ? "bg-slate-100"
      : "bg-emerald-50/60"
  const textClass = isComplete
    ? "text-emerald-600"
    : isCancelled
      ? "text-slate-500"
      : "text-emerald-600"

  return (
    <View className={`${bgClass} flex-row items-center rounded-xl px-3 py-2.5`}>
      <Text className="mr-1.5 text-sm">{info.icon}</Text>
      <Text className={`text-xs font-medium ${textClass}`}>{info.label}</Text>
    </View>
  )
}

function OrderCard({
  order, user, onPress, onSOS, onContact,
}: {
  order: OrderItem
  user: User | null
  onPress: () => void
  onSOS: () => void
  onContact: () => void
}) {
  const statusLabelMap: Record<string, string> = {
    pending: "待接单",
    grabbed: "已接单",
    in_progress: "进行中",
    completed: "已完成",
    cancelled: "已取消",
  }
  const statusColorMap: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    grabbed: "bg-indigo-50 text-indigo-700",
    in_progress: "bg-indigo-50 text-indigo-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
  }
  const statusLabel = statusLabelMap[order.status] ?? order.status
  const statusColor = statusColorMap[order.status] ?? "bg-slate-100 text-slate-600"
  const creditScore = user?.creditScore ?? 780
  const creditLevel = creditScore >= 800 ? "信用极佳" : creditScore >= 650 ? "信用良好" : "信用一般"

  const createdDate = new Date(order.createdAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mb-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Header: title + price */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-base font-bold text-slate-900 dark:text-zinc-100 leading-5" numberOfLines={2}>
            {order.title}
          </Text>
          {order.description ? (
            <Text className="text-xs text-slate-500 mt-0.5 leading-4" numberOfLines={2}>
              {order.description}
            </Text>
          ) : null}
        </View>
        <View className="items-end shrink-0">
          <Text className="text-lg font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
            ¥{order.price?.toLocaleString() ?? "—"}
          </Text>
          <View className={`mt-1 rounded-full px-2.5 py-0.5 ${statusColor.split(" ")[0]}`}>
            <Text className={`text-[10px] font-medium ${statusColor.split(" ")[1]}`}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {/* Trust badge */}
      <View className="flex-row items-center gap-2 mb-3">
        <View className="flex-row items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/30">
          <Text className="text-xs">👑</Text>
          <Text className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{creditLevel}</Text>
          <View className="mx-1 h-3 w-[1px] bg-emerald-300 dark:bg-emerald-700" />
          <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{creditScore}分</Text>
        </View>
        <Text className="text-xs text-slate-400 dark:text-zinc-500">|</Text>
        <Text className="text-xs text-slate-500 dark:text-zinc-400">{createdDate}</Text>
      </View>

      {/* Fund status bar */}
      <StatusFundBar status={order.status} />

      {/* Actions row */}
      {(order.status === "in_progress" || order.status === "grabbed") && (
        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
          <TouchableOpacity
            onPress={onContact}
            className="flex-1 rounded-xl bg-indigo-50 py-2.5 items-center mr-2 dark:bg-indigo-950/30"
            activeOpacity={0.7}
          >
            <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">联系对方</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSOS}
            className="rounded-xl bg-amber-50 px-4 py-2.5 flex-row items-center dark:bg-amber-950/30"
            activeOpacity={0.7}
          >
            <Text className="mr-1 text-sm">🚨</Text>
            <Text className="text-sm font-medium text-amber-600 dark:text-amber-400">SOS纠纷/求助</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

export default function MyOrdersScreen() {
  const navigation = useNavigation<NavProp>()
  const [activeTab, setActiveTab] = useState<TabKey>("in_progress")
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      const allOrders = await getMyOrders(currentUser.id)
      setOrders(allOrders)
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

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "completed") return o.status === "completed" || o.status === "cancelled"
    return o.status === activeTab
  })

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const handlePressOrder = (order: OrderItem) => {
    navigation.navigate("OrderDetail", { orderId: order.id })
  }

  const handleSOS = (order: OrderItem) => {
    navigation.navigate("SOS", { orderId: order.id })
  }

  const handleContact = (order: OrderItem) => {
    navigation.navigate("Chat", { orderId: order.id })
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
        <OrderListSkeleton />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      {/* Segmented Tabs */}
      <SegmentedTabs active={activeTab} onSelect={setActiveTab} />

      {/* Order List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366f1"
            colors={["#6366f1"]}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center pt-20">
            <View className="h-16 w-16 rounded-2xl bg-slate-100 items-center justify-center dark:bg-zinc-800">
              <Text className="text-2xl">📋</Text>
            </View>
            <Text className="mt-4 text-sm font-medium text-slate-500 dark:text-zinc-400">暂无{activeTab === "in_progress" ? "进行中" : activeTab === "pending" ? "待接单" : "已完成"}订单</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-zinc-500">
              {activeTab === "pending" ? "新的需求发布后，会出现在这里" : "快去下单吧"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            user={user}
            onPress={() => handlePressOrder(item)}
            onSOS={() => handleSOS(item)}
            onContact={() => handleContact(item)}
          />
        )}
      />
    </SafeAreaView>
  )
}
