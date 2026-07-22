import React from 'react'
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet } from 'react-native'

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

interface Props {
  schema: SchemaDef
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  riskTier?: string
}

export default function DynamicForm({ schema, value, onChange, riskTier }: Props) {
  const allFields: [string, SchemaField][] = [
    ...Object.entries(schema.core_fields ?? {}),
    ...Object.entries(schema.category_fields ?? {}),
  ]

  const updateField = (key: string, val: unknown) => {
    onChange({ ...value, [key]: val })
  }

  return (
    <View style={styles.container}>
      {riskTier === 'high' && (
        <View style={styles.highRiskBanner}>
          <Text style={styles.highRiskText}>This is a high-risk category.</Text>
        </View>
      )}
      {allFields.map(([key, field]) => (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>
            {field.label}{field.required ? ' *' : ''}
          </Text>
          {renderField(key, field, value[key], (v) => updateField(key, v))}
        </View>
      ))}
    </View>
  )

  function renderField(
    key: string,
    field: SchemaField,
    val: unknown,
    onChangeVal: (v: unknown) => void,
  ) {
    switch (field.type) {
      case 'text':
      case 'string':
      case 'geo':
        return (
          <TextInput
            style={styles.input}
            value={String(val ?? '')}
            onChangeText={onChangeVal as (v: string) => void}
            multiline={field.type === 'text'}
          />
        )
      case 'number':
      case 'int':
        return (
          <TextInput
            style={styles.input}
            value={val != null ? String(val) : ''}
            onChangeText={(t) => onChangeVal(Number(t))}
            keyboardType="numeric"
          />
        )
      case 'enum':
        return (
          <View style={styles.options}>
            {(field.options ?? []).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionBtn, val === opt && styles.optionBtnActive]}
                onPress={() => onChangeVal(opt)}
              >
                <Text style={[styles.optionText, val === opt && styles.optionTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )
      case 'int_array':
        return (
          <View style={styles.sliderRow}>
            <TouchableOpacity
              style={styles.sliderBtn}
              onPress={() => onChangeVal(Math.max(field.min ?? 1, (val as number ?? 1) - 1))}
            >
              <Text>-</Text>
            </TouchableOpacity>
            <Text style={styles.sliderValue}>{String(val ?? field.min ?? 1)}</Text>
            <TouchableOpacity
              style={styles.sliderBtn}
              onPress={() => onChangeVal(Math.min(field.max ?? 10, (val as number ?? 1) + 1))}
            >
              <Text>+</Text>
            </TouchableOpacity>
          </View>
        )
      case 'boolean':
        return (
          <Switch
            value={!!val}
            onValueChange={onChangeVal as (v: boolean) => void}
          />
        )
      case 'datetime':
        return (
          <TextInput
            style={styles.input}
            value={String(val ?? '')}
            onChangeText={onChangeVal as (v: string) => void}
            placeholder="YYYY-MM-DD HH:mm"
          />
        )
      default:
        return (
          <TextInput
            style={styles.input}
            value={String(val ?? '')}
            onChangeText={onChangeVal as (v: string) => void}
          />
        )
    }
  }
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 },
  highRiskBanner: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 16 },
  highRiskText: { color: '#dc2626', fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  optionBtnActive: { backgroundColor: '#2196f3', borderColor: '#2196f3' },
  optionText: { fontSize: 13, color: '#666' },
  optionTextActive: { color: '#fff' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  sliderValue: { fontSize: 16, fontWeight: '600', minWidth: 24, textAlign: 'center' },
})
