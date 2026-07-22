import React, { useState, useRef, useEffect, useCallback } from "react"
import {
  View, Text, SafeAreaView, ScrollView, TextInput, TouchableOpacity, Animated,
} from "react-native"
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import type { RootStackParamList } from "../../App"
import MediaBottomSheet, { type MediaPickAction } from "../components/MediaBottomSheet"

type DiagRouteProp = RouteProp<RootStackParamList, "Diagnosis">
type NavProp = NativeStackNavigationProp<RootStackParamList, "Diagnosis">

const CATEGORIES = [
  { id: "c1", icon: "🛠", label: "管道疏通" },
  { id: "c2", icon: "⚡", label: "电路维修" },
  { id: "c3", icon: "🔑", label: "门窗解锁" },
  { id: "c4", icon: "🧹", label: "清洁服务" },
  { id: "c5", icon: "📦", label: "搬运输送" },
  { id: "c6", icon: "❄", label: "家电维修" },
]

const SEVERITY_LEVELS = [
  { value: 1, label: "轻微", textColor: "text-emerald-600", bar: "bg-emerald-500" },
  { value: 2, label: "一般", textColor: "text-amber-600", bar: "bg-amber-500" },
  { value: 3, label: "紧急", textColor: "text-orange-600", bar: "bg-orange-500" },
  { value: 4, label: "灾难性", textColor: "text-rose-600", bar: "bg-rose-500" },
]

const PLACEHOLDER_TEXTS = [
  "例如：我家厨房洗菜池反水，有异味...",
  "例如：空调不制冷了，需要加氟",
  "例如：晚上回家发现门锁坏了",
]

function SkeletonUpload() {
  return (
    <View className="h-24 w-24 rounded-xl border-2 border-dashed border-slate-200 items-center justify-center dark:border-zinc-700">
      <Text className="text-2xl text-slate-300 dark:text-zinc-600">📷</Text>
    </View>
  )
}

export default function DiagnosisScreen() {
  const route = useRoute<DiagRouteProp>()
  const navigation = useNavigation<NavProp>()
  const { text: initialText, diagnosis } = route.params

  const [text, setText] = useState(initialText ?? "")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [severity, setSeverity] = useState(2)
  const [mediaFiles, setMediaFiles] = useState<Array<{ id: string; progress: number }>>([])
  const [sheetVisible, setSheetVisible] = useState(false)
  const [showResult, setShowResult] = useState(!!diagnosis)
  const [processing, setProcessing] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_TEXTS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (showResult) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()
    }
  }, [showResult, fadeAnim])

  const handleDiagnose = useCallback(async () => {
    if (!text.trim()) return
    setProcessing(true)
    await new Promise((r) => setTimeout(r, 1500))
    setProcessing(false)
    setShowResult(true)
  }, [text])

  const handleMediaPick = useCallback((action: MediaPickAction) => {
    setSheetVisible(false)
    const id = `media_${Date.now()}`
    setMediaFiles((prev) => [...prev, { id, progress: 0 }])
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 25) + 5
      if (progress >= 100) {
        clearInterval(interval)
        setMediaFiles((prev) => prev.map((m) => (m.id === id ? { ...m, progress: 100 } : m)))
      } else {
        setMediaFiles((prev) => prev.map((m) => (m.id === id ? { ...m, progress } : m)))
      }
    }, 300)
  }, [])

  const handleMatch = () => {
    navigation.navigate("Match", { orderId: "new" })
  }

  const severityColor = SEVERITY_LEVELS[severity - 1]?.textColor ?? "text-emerald-600"

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* ═══ Hero Title ═══ */}
        <View className="items-center pt-6 pb-4 px-4">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 mb-3">
            <Text className="text-2xl">🔬</Text>
          </View>
          <Text className="text-xl font-bold text-slate-900 dark:text-zinc-100">智能诊断舱</Text>
          <Text className="text-xs text-slate-500 dark:text-zinc-400 mt-1">描述故障，AI 自动诊断</Text>
        </View>

        {/* ═══ AI Input Area ═══ */}
        <View className="mx-4 mb-5 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={PLACEHOLDER_TEXTS[placeholderIdx]}
            placeholderTextColor="#94a3b8"
            multiline
            className="min-h-[80px] text-sm text-slate-900 leading-5 dark:text-zinc-100"
            editable={!showResult}
          />
          <View className="flex-row items-center justify-between mt-3">
            <View className="flex-row items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 dark:bg-indigo-950/30">
              <Text className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                {processing ? "✨ AI 诊断中..." : "✨ AI 就绪"}
              </Text>
            </View>
            <Text className="text-[10px] text-slate-400 dark:text-zinc-500">{text.length} 字</Text>
          </View>
        </View>

        {/* ═══ Category Cards ═══ */}
        <View className="px-4 mb-5">
          <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">选择故障分类</Text>
          <View className="flex-row flex-wrap gap-2.5">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  className={`rounded-xl border px-4 py-3 items-center min-w-[75px] ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                      : "border-slate-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900"
                  }`}
                  activeOpacity={0.7}
                >
                  <Text className="text-xl">{cat.icon}</Text>
                  <Text className={`text-xs font-semibold mt-1 ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-zinc-300"}`}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ═══ Severity Slider ═══ */}
        <View className="mx-4 mb-5 rounded-2xl border border-slate-200/60 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-900">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">严重程度</Text>
            <Text className={`text-sm font-bold ${severityColor}`}>{SEVERITY_LEVELS[severity - 1].label}</Text>
          </View>
          <View className="relative h-8 justify-center">
            <View className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
              <View
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                style={{ width: `${((severity - 1) / 3) * 100}%` }}
              />
            </View>
            <View className="absolute inset-x-0 top-0 flex-row justify-between">
              {[0, 1, 2, 3].map((i) => {
                const val = i + 1
                const isActive = severity >= val
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setSeverity(val)}
                    className="h-8 w-8 -mt-3 items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <View
                      className={`h-4 w-4 rounded-full border-2 ${
                        isActive
                          ? `${SEVERITY_LEVELS[i].bar} border-transparent scale-125`
                          : "border-slate-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      }`}
                    />
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
          <View className="flex-row justify-between mt-2">
            {SEVERITY_LEVELS.map((level) => (
              <Text
                key={level.value}
                className={`text-[10px] ${severity === level.value ? level.textColor : "text-slate-400 dark:text-zinc-600"}`}
              >
                {level.label}
              </Text>
            ))}
          </View>
        </View>

        {/* ═══ Media Upload ═══ */}
        <View className="px-4 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">现场资料</Text>
            <TouchableOpacity
              onPress={() => setSheetVisible(true)}
              className="flex-row items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 dark:bg-indigo-950/30"
              activeOpacity={0.7}
            >
              <Text className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">📷 添加照片</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            {mediaFiles.map((file) => (
              <View
                key={file.id}
                className="h-24 w-24 rounded-xl border border-slate-200/60 bg-slate-50 items-center justify-center dark:border-zinc-800/60 dark:bg-zinc-900"
              >
                {file.progress < 100 ? (
                  <>
                    <Text className="text-xl text-slate-400 mb-1">⬆</Text>
                    <View className="h-1 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-700">
                      <View className="h-full rounded-full bg-indigo-500" style={{ width: `${file.progress}%` }} />
                    </View>
                    <Text className="text-[9px] text-slate-400 mt-1">{file.progress}%</Text>
                  </>
                ) : (
                  <>
                    <Text className="text-2xl">📷</Text>
                    <Text className="text-[9px] text-slate-400 mt-1">已上传</Text>
                  </>
                )}
              </View>
            ))}
            {mediaFiles.length === 0 && <SkeletonUpload />}
          </View>
        </View>

        {/* ═══ Diagnose Button ═══ */}
        {!showResult && (
          <View className="px-4">
            <TouchableOpacity
              onPress={handleDiagnose}
              disabled={processing || !text.trim()}
              className="rounded-xl bg-indigo-600 py-4 items-center disabled:opacity-50 shadow-sm"
              activeOpacity={0.7}
            >
              <Text className="text-base font-bold text-white">
                {processing ? "✨ AI 诊断中..." : "🔍 AI 诊断并匹配服务"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ Result Animation ═══ */}
        {showResult && (
          <Animated.View style={{ opacity: fadeAnim }} className="px-4 mt-6 space-y-4">
            <View className="rounded-2xl border border-emerald-200/60 bg-emerald-50/30 p-5 dark:border-emerald-900/30 dark:bg-emerald-950/10">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-2xl">✅</Text>
                <Text className="text-base font-bold text-slate-900 dark:text-zinc-100 flex-1">
                  {diagnosis?.category ?? selectedCategory ?? CATEGORIES[0].label}
                </Text>
              </View>
              <Text className="text-sm text-slate-600 dark:text-zinc-400 leading-5 mb-3">
                {diagnosis?.summary ?? `已诊断：${text}`}
              </Text>
              <View className="flex-row items-center justify-between py-2 border-t border-emerald-200/40 dark:border-emerald-900/20">
                <Text className="text-xs text-slate-500 dark:text-zinc-400">可信度</Text>
                <Text className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round((diagnosis?.confidence ?? 0.92) * 100)}%
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleMatch}
              className="rounded-xl bg-indigo-600 py-4 items-center shadow-sm"
              activeOpacity={0.7}
            >
              <Text className="text-base font-bold text-white">匹配服务者 →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowResult(false); setText("") }}
              className="rounded-xl border border-slate-200/60 bg-white py-3 items-center dark:border-zinc-800/60 dark:bg-zinc-900"
              activeOpacity={0.7}
            >
              <Text className="text-sm font-medium text-slate-600 dark:text-zinc-400">重新诊断</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <MediaBottomSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onPick={handleMediaPick}
        />
      </ScrollView>
    </SafeAreaView>
  )
}
