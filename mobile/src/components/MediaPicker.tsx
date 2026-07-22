import React from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { colors, fonts, spacing, borderRadius } from '../theme'

export interface MediaFile {
  uri: string
  name: string
  type: 'image' | 'video'
}

interface MediaPickerProps {
  value: MediaFile[]
  onChange: (files: MediaFile[]) => void
  maxFiles?: number
  onPick: () => Promise<void>
}

export function MediaPicker({ value, onChange, maxFiles = 3, onPick }: MediaPickerProps) {
  const removeFile = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {value.map((file, idx) => (
          <View key={idx} style={styles.previewWrap}>
            {file.type === 'video' ? (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoIcon}>▶</Text>
              </View>
            ) : (
              <Image source={{ uri: file.uri }} style={styles.preview} />
            )}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeFile(idx)}
            >
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        {value.length < maxFiles && (
          <TouchableOpacity
            style={[styles.addBtn, value.length === 0 && styles.addBtnFull]}
            onPress={onPick}
            activeOpacity={0.7}
          >
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.addText}>
              {value.length === 0 ? '点击拍摄或上传' : '继续添加'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  previewWrap: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    fontSize: 24,
    color: colors.muted,
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 10,
  },
  addBtn: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight + '50',
  },
  addBtnFull: {
    width: '100%',
    height: 96,
  },
  cameraIcon: {
    fontSize: 20,
  },
  addText: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
})
