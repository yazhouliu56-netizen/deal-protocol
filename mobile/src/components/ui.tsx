import React from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ViewStyle, TextStyle, ActivityIndicator,
} from 'react-native'
import { colors, fonts, spacing, borderRadius, shadows } from '../theme'

export function Container({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.container, style]}>{children}</View>
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function Input({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, style]}
      {...props}
    />
  )
}

export function Button({
  title, variant, loading, style, ...props
}: React.ComponentProps<typeof TouchableOpacity> & {
  title: string; variant?: 'primary' | 'outline' | 'ghost' | 'destructive'; loading?: boolean
}) {
  const btnStyle = variant === 'outline' ? styles.btnOutline
    : variant === 'ghost' ? styles.btnGhost
    : variant === 'destructive' ? styles.btnDestructive
    : styles.btnPrimary
  const textStyle = variant === 'outline' ? styles.btnTextOutline
    : variant === 'ghost' ? styles.btnTextGhost
    : variant === 'destructive' ? styles.btnTextDestructive
    : styles.btnTextPrimary

  return (
    <TouchableOpacity style={[btnStyle, style]} disabled={loading} activeOpacity={0.7} {...props}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.brand[600] : '#fff'} size="small" />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

export function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color || colors.brand[600] + '20' }]}>
      <Text style={[styles.badgeText, { color: color || colors.brand[600] }]}>{label}</Text>
    </View>
  )
}

export function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fonts.sizes.base,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPrimary: {
    backgroundColor: colors.brand[600],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutline: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhost: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDestructive: {
    backgroundColor: colors.destructive + '20',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextPrimary: { color: '#fff', fontSize: fonts.sizes.base, fontWeight: fonts.weights.semibold },
  btnTextOutline: { color: colors.foreground, fontSize: fonts.sizes.base, fontWeight: fonts.weights.semibold },
  btnTextGhost: { color: colors.brand[600], fontSize: fonts.sizes.base, fontWeight: fonts.weights.semibold },
  btnTextDestructive: { color: colors.destructive, fontSize: fonts.sizes.base, fontWeight: fonts.weights.semibold },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
  },
  header: {
    paddingTop: spacing['5xl'],
    paddingBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: fonts.sizes['2xl'],
    fontWeight: fonts.weights.bold,
    color: colors.foreground,
  },
})
