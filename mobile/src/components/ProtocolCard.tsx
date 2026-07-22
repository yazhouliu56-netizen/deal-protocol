import React, { useState, useMemo, useCallback } from "react"
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native"

interface SchemaField {
  type: string
  label: string
  required?: boolean
  options?: string[]
  min?: number
  max?: number
}

interface SchemaDef {
  core_fields?: Record<string, SchemaField>
  category_fields?: Record<string, SchemaField>
}

interface MediaFile {
  uri: string
  name: string
  type: "image" | "video"
}

interface ProtocolCardProps {
  title: string
  description: string
  category: string
  riskTier: "low" | "medium" | "high"
  budgetMin?: number
  budgetMax?: number
  urgency?: string
  address?: string
  schema: SchemaDef
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  price: number
  onPriceChange: (price: number) => void
  suggestedMin?: number
  suggestedMax?: number
  media: MediaFile[]
  onMediaPress: () => void
  onRemoveMedia: (idx: number) => void
  onPublish: () => void
  publishing?: boolean
  published?: boolean
  onAdjust?: () => void
  role: "consumer" | "provider"
  onAccept?: () => void
}

function FieldRenderer({
  field, value, onChange, missing,
}: {
  field: SchemaField
  value: unknown
  onChange: (v: unknown) => void
  missing?: boolean
}) {
  const fieldContainer = `rounded-xl border ${missing ? "border-indigo-300/60 bg-indigo-50/30" : "border-slate-200"} p-3`
  const pulseStyle = missing ? "opacity-90" : ""

  if (field.type === "enum" && field.options) {
    return (
      <View className={fieldContainer}>
        <View className="flex-row flex-wrap gap-2">
          {field.options.map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              className={`rounded-full px-4 py-2 ${value === opt ? "bg-indigo-600" : "bg-slate-100"}`}
            >
              <Text className={`text-xs font-medium ${value === opt ? "text-white" : "text-slate-600"}`}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {missing && (
          <Text className="mt-1.5 text-[10px] text-indigo-500 font-medium">点此选择</Text>
        )}
      </View>
    )
  }

  if (field.type === "text") {
    return (
      <View className={fieldContainer}>
        <TextInput
          value={String(value ?? "")}
          onChangeText={(t) => onChange(t)}
          multiline
          numberOfLines={3}
          className={`text-sm text-slate-900 leading-relaxed ${pulseStyle}`}
          placeholderTextColor="#94a3b8"
          placeholder={`输入${field.label}`}
        />
      </View>
    )
  }

  if (field.type === "boolean") {
    return (
      <View className={fieldContainer}>
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-slate-700">{field.label}</Text>
          <Switch
            value={!!value}
            onValueChange={(v) => onChange(v)}
            trackColor={{ false: "#e2e8f0", true: "#c7d2fe" }}
            thumbColor={!!value ? "#4f46e5" : "#f1f5f9"}
          />
        </View>
      </View>
    )
  }

  return (
    <View className={fieldContainer}>
      <TextInput
        value={String(value ?? "")}
        onChangeText={(t) => onChange(t)}
        className={`text-sm text-slate-900 ${pulseStyle}`}
        placeholderTextColor="#94a3b8"
        placeholder={`输入${field.label}`}
        keyboardType={field.type === "number" || field.type === "int" ? "numeric" : "default"}
      />
    </View>
  )
}

export default function ProtocolCard({
  title, description, category, riskTier,
  budgetMin, budgetMax, urgency, address,
  schema, value, onChange,
  price, onPriceChange, suggestedMin, suggestedMax,
  media, onMediaPress, onRemoveMedia,
  onPublish, publishing, published, onAdjust,
  role, onAccept,
}: ProtocolCardProps) {
  const allFields: [string, SchemaField][] = useMemo(() => [
    ...Object.entries(schema.core_fields ?? {}),
    ...Object.entries(schema.category_fields ?? {}),
  ], [schema])

  const missingRequired = useMemo(() => {
    return allFields.filter(([key, field]) => field.required && !value[key])
  }, [allFields, value])

  const updateField = useCallback((key: string, val: unknown) => {
    onChange({ ...value, [key]: val })
  }, [value, onChange])

  const pricePct = suggestedMin != null && suggestedMax != null && suggestedMax > 0
    ? ((price - suggestedMin) / (suggestedMax - suggestedMin)) * 100
    : 0

  if (published) {
    return (
      <View className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 items-center">
        <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center mb-4">
          <Text className="text-3xl">✓</Text>
        </View>
        <Text className="text-lg font-bold text-slate-900">需求已发布！</Text>
        <Text className="text-sm text-slate-500 mt-1 text-center">
          服务者将主动联系您
        </Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ padding: 16 }}>
      {/* ── Card ── */}
      <View className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* ── Header ── */}
        <View className="border-b border-slate-100 px-5 py-4">
          <View className="flex-row items-center gap-2">
            <View className="w-6 h-6 rounded-lg bg-indigo-50 items-center justify-center">
              <Text className="text-xs text-indigo-600">✦</Text>
            </View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              AI 协议预览
            </Text>
            <View className="bg-slate-100 rounded-full px-2.5 py-0.5">
              <Text className="text-[10px] font-medium text-slate-500">{category}</Text>
            </View>
            <View className="ml-auto">
              <View
                className={`rounded-full px-3 py-1 ${
                  riskTier === "high" ? "bg-rose-50" : riskTier === "medium" ? "bg-amber-50" : "bg-emerald-50"
                }`}
              >
                <Text
                  className={`text-[10px] font-semibold ${
                    riskTier === "high" ? "text-rose-700" : riskTier === "medium" ? "text-amber-700" : "text-emerald-700"
                  }`}
                >
                  {riskTier === "high" ? "高风险 · 押金担保" : riskTier === "medium" ? "中风险" : "低风险"}
                </Text>
              </View>
            </View>
          </View>

          <Text className="mt-2 text-base font-bold text-slate-900 leading-tight">{title}</Text>
          <Text className="mt-0.5 text-sm text-slate-500">{description}</Text>

          {(budgetMin != null || budgetMax != null || urgency || address) && (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {budgetMin != null && (
                <View className="bg-slate-100 rounded-md px-2 py-1">
                  <Text className="text-xs text-slate-500">¥{budgetMin}{budgetMax ? `-${budgetMax}` : ""}</Text>
                </View>
              )}
              {urgency && (
                <View className="bg-slate-100 rounded-md px-2 py-1">
                  <Text className="text-xs text-slate-500">
                    {urgency === "high" ? "紧急" : urgency === "medium" ? "适中" : "不着急"}
                  </Text>
                </View>
              )}
              {address && (
                <View className="bg-slate-100 rounded-md px-2 py-1">
                  <Text className="text-xs text-slate-500">{address}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Body ── */}
        <View className="px-5 py-4 space-y-4">
          {/* Missing required fields reminder */}
          {missingRequired.length > 0 && (
            <View className="flex-row items-center gap-2 bg-indigo-50 rounded-xl px-4 py-3">
              <Text className="text-sm text-indigo-700 flex-1">
                请完善 <Text className="font-bold">{missingRequired.length}</Text> 个必填项
              </Text>
            </View>
          )}

          {/* Protocol fields */}
          {allFields.length > 0 && (
            <View>
              <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                协议内容
              </Text>
              <View className="space-y-3">
                {allFields.map(([key, field]) => {
                  const isMissing = field.required && !value[key]
                  return (
                    <View key={key} className={isMissing ? "opacity-90" : ""}>
                      <Text className="text-sm font-medium text-slate-700 mb-1.5">
                        {field.label}
                        {field.required && <Text className="text-red-500 ml-0.5">*</Text>}
                      </Text>
                      <FieldRenderer
                        field={field}
                        value={value[key]}
                        onChange={(v) => updateField(key, v)}
                        missing={isMissing}
                      />
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* AI Price Slider */}
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              服务价格
            </Text>
            <View className="rounded-xl border border-slate-200 p-4">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-xs text-slate-500">拖动调整价格</Text>
                <Text className="text-lg font-bold text-slate-900">¥{price.toLocaleString()}</Text>
              </View>
              {/* Custom slider track with green highlight */}
              <View className="h-7 justify-center">
                <View className="absolute left-0 right-0 h-1.5 rounded-full bg-slate-200" />
                {suggestedMin != null && suggestedMax != null && (
                  <View
                    className="absolute h-1.5 rounded-full bg-emerald-200/60"
                    style={{
                      left: `${(suggestedMin / 2000) * 100}%`,
                      width: `${((suggestedMax - suggestedMin) / 2000) * 100}%`,
                    }}
                  />
                )}
                <View
                  className="absolute left-0 h-1.5 rounded-full bg-indigo-500"
                  style={{ width: `${(price / 2000) * 100}%` }}
                />
              </View>
              <View className="flex-row justify-between mt-2">
                <Text className="text-[10px] text-slate-400">¥0</Text>
                <Text className="text-[10px] text-slate-400">¥2,000</Text>
              </View>
              {suggestedMin != null && suggestedMax != null && (
                <Text className="text-xs text-emerald-600 mt-2">
                  AI 建议区间：¥{suggestedMin} - ¥{suggestedMax}
                </Text>
              )}
              <View className="mt-4">
                <TextInput
                  value={String(price)}
                  onChangeText={(t) => onPriceChange(Number(t) || 0)}
                  keyboardType="numeric"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-center text-slate-900"
                  placeholderTextColor="#94a3b8"
                  placeholder="或直接输入价格"
                />
              </View>
            </View>
          </View>

          {/* Media upload */}
          <View>
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              现场照片 / 视频
            </Text>
            <TouchableOpacity
              onPress={onMediaPress}
              className="rounded-xl border-2 border-dashed border-slate-300 p-6 items-center bg-slate-50/50"
              activeOpacity={0.7}
            >
              <Text className="text-2xl mb-1">📷</Text>
              <Text className="text-sm text-slate-500 text-center">
                {media.length > 0 ? `已选 ${media.length} 个文件` : "点击拍摄或上传"}
              </Text>
            </TouchableOpacity>
            {media.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mt-3">
                {media.map((file, idx) => (
                  <View key={idx} className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden">
                    <TouchableOpacity
                      onPress={() => onRemoveMedia(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 items-center justify-center z-10"
                    >
                      <Text className="text-white text-[10px]">✕</Text>
                    </TouchableOpacity>
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-2xl">{file.type === "video" ? "▶" : "🖼"}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Risk tier note */}
          {riskTier === "high" && (
            <View className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <Text className="text-xs font-medium text-rose-700">
                ⚠ 高风险协议：建议在协议中包含押金担保条款。
              </Text>
            </View>
          )}
        </View>

        {/* ── Footer CTA ── */}
        <View className="border-t border-slate-100 px-5 py-4">
          {role === "provider" ? (
            <View>
              <TouchableOpacity
                onPress={onAccept}
                className="bg-indigo-600 rounded-xl py-4 items-center shadow-sm"
                activeOpacity={0.9}
              >
                <Text className="text-base font-bold text-white">接单</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={onPublish}
                disabled={publishing}
                className="flex-1 bg-indigo-600 rounded-xl py-3.5 items-center shadow-sm"
                activeOpacity={0.9}
              >
                {publishing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-bold text-white">全网发布</Text>
                )}
              </TouchableOpacity>
              {onAdjust && (
                <TouchableOpacity
                  onPress={onAdjust}
                  className="flex-1 border border-slate-200 rounded-xl py-3.5 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="text-sm font-medium text-slate-600">再调整</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  )
}
