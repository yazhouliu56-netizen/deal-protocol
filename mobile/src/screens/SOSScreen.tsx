import React, { useRef, useEffect } from "react"
import { View, Text, SafeAreaView, TouchableOpacity, Animated, StatusBar } from "react-native"

export default function SOSScreen() {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ).start()
  }, [pulse])

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f0f]">
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-sm items-center rounded-3xl border border-rose-900/40 bg-[#1a0f0f] p-8 shadow-lg">
          <Text className="text-5xl">🆘</Text>
          <Text className="mt-4 text-2xl font-extrabold text-white">紧急求助</Text>
          <Text className="mt-3 text-center text-xs leading-5 text-zinc-400">
            按下按钮立即触发 SOS 流程：通知安全团队、联系紧急联系人、共享实时位置
          </Text>
          <Animated.View style={{ transform: [{ scale: pulse }] }} className="mt-6 w-full">
            <TouchableOpacity
              className="w-full items-center rounded-2xl bg-rose-600 py-5 shadow-lg"
              activeOpacity={0.7}
            >
              <Text className="text-lg font-extrabold text-white">🚨 触发 SOS</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  )
}
