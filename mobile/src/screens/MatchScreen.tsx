import React, { useEffect, useState, useRef } from "react"
import {
  View, Text, SafeAreaView, StatusBar, ActivityIndicator,
} from "react-native"
import ProtocolCard from "../components/ProtocolCard"
import MediaBottomSheet, { MediaPickAction } from "../components/MediaBottomSheet"

const MOCK_PROTOCOL = {
  title: "空调加氟",
  description: "空调不制冷了，需要加氟",
  category: "家电维修",
  riskTier: "low" as const,
  budgetMin: 80,
  budgetMax: 150,
  urgency: "high",
  address: "朝阳区三里屯SOHO",
  schema: {
    core_fields: {
      address: { type: "geo", label: "服务地址", required: true },
      scheduled_at: { type: "datetime", label: "期望时间", required: true },
    },
  },
}

export default function MatchScreen() {
  const [step, setStep] = useState(0)
  const [protocolReady, setProtocolReady] = useState(false)
  const [protocolFields, setProtocolFields] = useState<Record<string, unknown>>({})
  const [price, setPrice] = useState(0)
  const [media, setMedia] = useState<Array<{ uri: string; name: string; type: "image" | "video" }>>([])
  const [sheetVisible, setSheetVisible] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const mediaIdCounter = useRef(0)

  const steps = ["AI 分析需求中...", "生成智能协议...", "协议就绪 ✓"]

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => {
        const next = s + 1
        if (next >= 3) {
          setProtocolReady(true)
          setPrice(120)
          clearInterval(timer)
          return next
        }
        return next
      })
    }, 1500)
    return () => clearInterval(timer)
  }, [])

  const handleMediaPick = async (action: MediaPickAction) => {
    setSheetVisible(false)
    mediaIdCounter.current += 1
    const id = mediaIdCounter.current
    setMedia((prev) => [
      ...prev,
      { uri: `file:///mock_${id}`, name: `photo_${id}.jpg`, type: "image" },
    ])
  }

  const handlePublish = async () => {
    setPublishing(true)
    await new Promise((r) => setTimeout(r, 1500))
    setPublishing(false)
    setPublished(true)
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      {!protocolReady ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-sm items-center">
            {step < 2 ? (
              <ActivityIndicator size="large" color="#4f46e5" />
            ) : (
              <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-2">
                <Text className="text-3xl">✓</Text>
              </View>
            )}
            <Text className="text-base font-medium text-slate-900 mt-5">{steps[step]}</Text>
            <View className="flex-row gap-2 mt-6">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className={`w-2 h-2 rounded-full ${i <= step ? "bg-indigo-500" : "bg-slate-200"}`}
                />
              ))}
            </View>
          </View>
        </View>
      ) : (
        <ProtocolCard
          {...MOCK_PROTOCOL}
          value={protocolFields}
          onChange={setProtocolFields}
          price={price}
          onPriceChange={setPrice}
          suggestedMin={MOCK_PROTOCOL.budgetMin}
          suggestedMax={MOCK_PROTOCOL.budgetMax}
          media={media}
          onMediaPress={() => setSheetVisible(true)}
          onRemoveMedia={(idx) => setMedia((prev) => prev.filter((_, i) => i !== idx))}
          onPublish={handlePublish}
          publishing={publishing}
          published={published}
          onAdjust={() => {}}
          role="consumer"
        />
      )}

      <MediaBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onPick={handleMediaPick}
      />
    </SafeAreaView>
  )
}
