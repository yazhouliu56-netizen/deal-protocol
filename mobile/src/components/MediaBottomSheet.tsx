import React, { useCallback, useRef, useMemo } from "react"
import { View, Text, TouchableOpacity } from "react-native"
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet"

export type MediaPickAction = "camera" | "gallery"

interface MediaBottomSheetProps {
  visible: boolean
  onClose: () => void
  onPick: (action: MediaPickAction) => void
}

export default function MediaBottomSheet({ visible, onClose, onPick }: MediaBottomSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null)
  const snapPoints = useMemo(() => ["30%"], [])

  const handleCamera = useCallback(() => {
    onPick("camera")
    bottomSheetRef.current?.close()
  }, [onPick])

  const handleGallery = useCallback(() => {
    onPick("gallery")
    bottomSheetRef.current?.close()
  }, [onPick])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  )

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      onChange={(idx) => {
        if (idx === -1) onClose()
      }}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#fff", borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: "#cbd5e1", width: 40 }}
    >
      <BottomSheetView className="flex-1 px-6 pb-8">
        <View className="items-center mb-5">
          <Text className="text-base font-bold text-slate-900">添加现场资料</Text>
          <Text className="text-xs text-slate-500 mt-1">帮助服务者更好评估</Text>
        </View>

        <TouchableOpacity
          onPress={handleCamera}
          className="flex-row items-center gap-4 rounded-xl bg-slate-50 px-5 py-4 mb-3"
          activeOpacity={0.7}
        >
          <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center">
            <Text className="text-xl">📷</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-slate-900">拍照</Text>
            <Text className="text-xs text-slate-500">使用相机拍摄现场照片</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleGallery}
          className="flex-row items-center gap-4 rounded-xl bg-slate-50 px-5 py-4"
          activeOpacity={0.7}
        >
          <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center">
            <Text className="text-xl">🖼</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-slate-900">从相册选择</Text>
            <Text className="text-xs text-slate-500">选取已有照片或视频</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => bottomSheetRef.current?.close()}
          className="mt-5 items-center py-2"
          activeOpacity={0.7}
        >
          <Text className="text-sm font-medium text-slate-400">取消</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  )
}
