import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  View, Text, FlatList, SafeAreaView, KeyboardAvoidingView, Platform,
  TextInput, TouchableOpacity, Keyboard, Animated,
} from "react-native"
import { useRoute, type RouteProp } from "@react-navigation/native"
import type { RootStackParamList } from "../../App"
import type { ChatMessage, User, OrderItem } from "../types"
import { getMessages, sendMessage, getCurrentUser, getProviderUser, getOrderById } from "../services/api"
import MediaBottomSheet from "../components/MediaBottomSheet"
import SlideToAccept from "../components/SlideToAccept"

type ChatRouteProp = RouteProp<RootStackParamList, "Chat">

const MOCK_ORDER_SUMMARY = {
  fundStatus: "资金已托管" as const,
  statusColor: "text-indigo-600",
  providerName: "李师傅",
}

function ChatSkeleton() {
  return (
    <View className="flex-1 items-center justify-center px-12">
      <View className="items-center gap-3">
        <View className="relative h-12 w-12 items-center justify-center">
          <View className="absolute inset-0 rounded-full bg-indigo-400/20" />
          <View className="h-8 w-8 rounded-xl bg-indigo-100 items-center justify-center">
            <Text className="text-indigo-600 dark:text-indigo-400 text-sm">🤖</Text>
          </View>
        </View>
        <Text className="text-sm text-slate-500 dark:text-zinc-400">加载聊天记录中...</Text>
        <View className="mt-2 w-full gap-3">
          <View className="h-16 animate-pulse rounded-2xl bg-slate-200" />
          <View className="ml-8 h-12 w-3/4 animate-pulse rounded-2xl bg-slate-200" />
          <View className="h-20 animate-pulse rounded-2xl bg-slate-200" />
          <View className="ml-8 h-10 w-2/3 animate-pulse rounded-2xl bg-slate-200" />
        </View>
      </View>
    </View>
  )
}

function CreditStatusBar({
  creditScore, level, fundStatus, statusColor, collapsed, onToggle,
}: {
  creditScore: number
  level: string
  fundStatus: string
  statusColor: string
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 dark:bg-zinc-900 dark:border-zinc-800"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="text-base">👑</Text>
          <Text className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{level}</Text>
          <View className="h-4 w-[1px] bg-slate-300 dark:bg-zinc-600" />
          <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{creditScore}分</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-indigo-500" />
          <Text className={`text-xs font-medium ${statusColor}`}>{fundStatus}</Text>
          <Text className={`text-xs text-slate-400 dark:text-zinc-500 ml-1 ${collapsed ? "" : "rotate-180"}`}>▾</Text>
        </View>
      </View>
      {!collapsed && (
        <View className="mt-2 flex-row gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
          <View className="flex-1 rounded-lg bg-white px-3 py-2 border border-slate-200 dark:border-zinc-700/60 dark:bg-zinc-900">
            <Text className="text-[10px] text-slate-500 dark:text-zinc-400">协约方</Text>
            <Text className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{MOCK_ORDER_SUMMARY.providerName}</Text>
          </View>
          <View className="flex-1 rounded-lg bg-white px-3 py-2 border border-slate-200 dark:border-zinc-700/60 dark:bg-zinc-900">
            <Text className="text-[10px] text-slate-500 dark:text-zinc-400">服务状态</Text>
            <Text className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{fundStatus}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  )
}

function ChatBubble({ message, isMe, isFlagged }: {
  message: ChatMessage
  isMe: boolean
  isFlagged: boolean
}) {
  const timeStr = new Date(message.timestamp).toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <View className={`mb-3 ${isMe ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isFlagged
            ? "bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900/30"
            : isMe
              ? "bg-indigo-600"
              : "bg-white border border-slate-200 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900"
        }`}
      >
        {isFlagged && (
          <View className="flex-row items-center gap-1 mb-1">
            <Text className="text-xs font-medium text-orange-600 dark:text-orange-400">⚠️ 该消息已被标记</Text>
          </View>
        )}
        <Text
          className={`text-sm leading-relaxed ${
            isFlagged ? "text-orange-900 dark:text-orange-300" : isMe ? "text-white" : "text-slate-900 dark:text-zinc-100"
          }`}
        >
          {message.text}
        </Text>
      </View>
      <View className={`flex-row items-center gap-2 mt-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
        <Text className="text-[10px] text-slate-400 dark:text-zinc-500">{timeStr}</Text>
        {isFlagged && (
          <View className="rounded-full bg-orange-100 px-2 py-0.5 dark:bg-orange-950/30">
            <Text className="text-[9px] text-orange-600 dark:text-orange-400">已标记</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export default function ChatScreen() {
  const route = useRoute<ChatRouteProp>()
  const { orderId } = route.params

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [role, setRole] = useState<"customer" | "provider">("customer")
  const [creditBarCollapsed, setCreditBarCollapsed] = useState(false)
  const [showMediaSheet, setShowMediaSheet] = useState(false)
  const [showProtocolCard, setShowProtocolCard] = useState(false)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    const init = async () => {
      const user = await getCurrentUser()
      const provider = await getProviderUser()
      setCurrentUser(user)
      setRole(user.role === "provider" ? "provider" : "customer")

      const msgs = await getMessages(orderId)
      setMessages(msgs)
      setLoading(false)
    }
    init()
  }, [orderId])

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    )
    pulse.start()
    return () => pulse.stop()
  }, [pulseAnim])

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }, [])

  const handleSend = async () => {
    if (!text.trim() || !currentUser) return
    Keyboard.dismiss()
    const msg = await sendMessage(orderId, currentUser.id, text.trim())
    setMessages((prev) => [...prev, msg])
    setText("")
    scrollToEnd()
  }

  const handleMediaPick = useCallback(async (action: "camera" | "gallery") => {
    setShowMediaSheet(false)
    // In a real app, this would launch camera/gallery picker
    const msg = await sendMessage(orderId, currentUser?.id ?? "u1", `[${action === "camera" ? "拍摄" : "上传"}了现场照片]`)
    setMessages((prev) => [...prev, msg])
    scrollToEnd()
  }, [orderId, currentUser, scrollToEnd])

  const handleAccept = useCallback(async () => {
    const msg = await sendMessage(orderId, currentUser?.id ?? "p1", "已接单，即将出发")
    setMessages((prev) => [...prev, msg])
    setShowProtocolCard(false)
    scrollToEnd()
  }, [orderId, currentUser, scrollToEnd])

  const renderFooter = () => {
    if (role !== "provider" || !showProtocolCard) return null
    return (
      <View className="mx-4 mb-4">
        <View className="rounded-2xl border border-indigo-200/60 bg-white p-4 shadow-sm mb-3 dark:border-indigo-900/30 dark:bg-zinc-900">
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">AI 协议预览</Text>
          </View>
          <Text className="text-base font-bold text-slate-900 dark:text-zinc-100 mb-1" numberOfLines={2}>下水道疏通服务</Text>
          <Text className="text-sm text-slate-500 dark:text-zinc-400 mb-3">已生成服务协议，滑动确认接单</Text>
          <View className="flex-row items-center justify-between bg-emerald-50 rounded-xl px-3 py-2 mb-4 dark:bg-emerald-950/20">
            <Text className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">AI 建议价格</Text>
            <Text className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">¥180</Text>
          </View>
          <SlideToAccept onAccept={handleAccept} label="→ 向右滑动接单" completeLabel="✓ 已接单" />
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
        <ChatSkeleton />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* ── Credit Status Bar ── */}
        <CreditStatusBar
          creditScore={currentUser?.creditScore ?? 780}
          level={currentUser && currentUser.creditScore >= 800 ? "信用极佳" : currentUser && currentUser.creditScore >= 650 ? "信用良好" : "信用一般"}
          fundStatus={MOCK_ORDER_SUMMARY.fundStatus}
          statusColor={MOCK_ORDER_SUMMARY.statusColor}
          collapsed={creditBarCollapsed}
          onToggle={() => setCreditBarCollapsed(!creditBarCollapsed)}
        />

        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center min-h-[300px]">
      <View className="h-14 w-14 rounded-2xl bg-slate-100 items-center justify-center dark:bg-zinc-800">
        <Text className="text-2xl">💬</Text>
      </View>
      <Text className="mt-4 text-sm font-medium text-slate-500 dark:text-zinc-400">暂无聊天记录</Text>
      <Text className="mt-1 text-xs text-slate-400 dark:text-zinc-500">发送第一条消息开始沟通</Text>
            </View>
          }
          ListFooterComponent={renderFooter}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              isMe={item.senderId === currentUser?.id}
              isFlagged={false}
            />
          )}
        />

        {/* ── Input Area ── */}
        <View className="flex-row items-end px-4 py-3 border-t border-slate-200 bg-white dark:border-zinc-800/60 dark:bg-zinc-950">
          {/* Media attach button */}
          <TouchableOpacity
            onPress={() => setShowMediaSheet(true)}
            className="h-11 w-11 rounded-xl bg-slate-100 items-center justify-center mr-2 dark:bg-zinc-800"
            activeOpacity={0.7}
          >
            <Text className="text-lg text-slate-500 dark:text-zinc-400">+</Text>
          </TouchableOpacity>

          {/* Text input */}
          <View className="flex-1 mr-2">
            <TextInput
              placeholder="输入消息..."
              value={text}
              onChangeText={setText}
              multiline
              className="max-h-24 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 leading-5 dark:border-zinc-700/60 dark:bg-zinc-900 dark:text-zinc-100"
              placeholderTextColor="#94a3b8"
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
          </View>

          {/* Send button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim()}
            className="h-11 w-11 rounded-xl bg-indigo-600 items-center justify-center disabled:opacity-50"
            activeOpacity={0.7}
          >
            <Text className="text-white text-lg">↑</Text>
          </TouchableOpacity>
        </View>

        {/* ── Media Bottom Sheet ── */}
        <MediaBottomSheet
          visible={showMediaSheet}
          onClose={() => setShowMediaSheet(false)}
          onPick={handleMediaPick}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
