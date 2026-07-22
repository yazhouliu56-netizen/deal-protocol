'use client'

/**
 * @deprecated Use SmartProtocolCard from '@/components/SmartProtocolCard' instead.
 * This module is kept for backward compatibility (landing page demo).
 * ProtocolCard and GenUIRenderer will be removed in a future phase.
 */

import { useCallback, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import SmartProtocolCard from '@/components/SmartProtocolCard'
import { cn } from '@/lib/utils'

interface SchemaField {
  type: string
  label: string
  required?: boolean
  min?: number
  max?: number
  options?: string[]
  items?: { type: string }
}

interface SchemaDefinition {
  core_fields?: Record<string, SchemaField>
  category_fields?: Record<string, SchemaField>
}

interface GenUIRendererProps {
  schema: SchemaDefinition
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  riskTier?: 'low' | 'medium' | 'high'
}

function FieldString({ field, value, onChange, id }: {
  field: SchemaField
  value: string
  onChange: (v: string) => void
  id: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <Input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function FieldText({ field, value, onChange, id }: {
  field: SchemaField
  value: string
  onChange: (v: string) => void
  id: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <Textarea id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function FieldNumber({ field, value, onChange, id }: {
  field: SchemaField
  value: number
  onChange: (v: number) => void
  id: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <Input id={id} type="number" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function FieldDatetime({ field, value, onChange, id }: {
  field: SchemaField
  value: string
  onChange: (v: string) => void
  id: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <Input id={id} type="datetime-local" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function FieldEnum({ field, value, onChange }: {
  field: SchemaField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
              value === opt
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function FieldIntArray({ field, value, onChange }: {
  field: SchemaField
  value: number
  onChange: (v: number) => void
}) {
  const min = field.min ?? 1
  const max = field.max ?? 8
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value ?? min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="min-w-6 text-center text-sm font-medium tabular-nums">{value ?? min}</span>
      </div>
    </div>
  )
}

function FieldArray({ field, value, onChange }: {
  field: SchemaField
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [inputVal, setInputVal] = useState('')
  const items: string[] = Array.isArray(value) ? value : []

  const addItem = useCallback(() => {
    const trimmed = inputVal.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
    }
    setInputVal('')
  }, [inputVal, items, onChange])

  const removeItem = useCallback((idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    onChange(next)
  }, [items, onChange])

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        <Input value={inputVal} onChange={(e) => setInputVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())} placeholder="输入后按回车添加" />
        <Button type="button" variant="outline" onClick={addItem} disabled={!inputVal.trim()}>添加</Button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item, idx) => (
            <Badge key={idx} variant="secondary" className="cursor-pointer gap-1" onClick={() => removeItem(idx)}>
              {item} <span className="ml-0.5 text-muted-foreground">✕</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

function FieldGeo({ field, value, onChange, id }: {
  field: SchemaField
  value: string
  onChange: (v: string) => void
  id: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <Input id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="输入地址" />
    </div>
  )
}

function FieldInt({ field, value, onChange, id }: {
  field: SchemaField
  value: number
  onChange: (v: number) => void
  id: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <Input id={id} type="number" value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function FieldBoolean({ field, value, onChange, id }: {
  field: SchemaField
  value: boolean
  onChange: (v: boolean) => void
  id: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
    </div>
  )
}

const FIELD_RENDERERS: Record<string, React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>> = {
  string: FieldString as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  text: FieldText as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  number: FieldNumber as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  datetime: FieldDatetime as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  enum: FieldEnum as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  int_array: FieldIntArray as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  array: FieldArray as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  boolean: FieldBoolean as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  geo: FieldGeo as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
  int: FieldInt as React.FC<{ field: SchemaField; value: unknown; onChange: (v: unknown) => void; id: string }>,
}

function HighRiskConfirmDialog({ riskTier }: { riskTier?: string }) {
  if (riskTier !== 'high') return null
  return (
    <div className="mt-6 rounded-lg border-2 border-red-400 bg-red-50 p-4">
      <p className="text-sm font-semibold text-red-700">
        This is a high-risk category. By submitting, you acknowledge the additional safety measures.
      </p>
      <label className="mt-2 flex items-center gap-2 text-sm text-red-600">
        <input type="checkbox" className="h-4 w-4 rounded border-red-300" required />
        I understand and agree to proceed
      </label>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  )
}

/**
 * @deprecated Use SmartProtocolCard from '@/components/SmartProtocolCard' with mode="view" instead.
 */
export function ProtocolCard({ schema, value, riskTier }: { schema: SchemaDefinition; value: Record<string, unknown>; riskTier?: string }) {
  const allFields: [string, SchemaField][] = [
    ...Object.entries(schema.core_fields ?? {}),
    ...Object.entries(schema.category_fields ?? {}),
  ]
  return (
    <div className={`rounded-lg border p-4 ${riskTier === 'high' ? 'border-red-400 bg-red-50/50' : ''}`}>
      {riskTier === 'high' && (
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-600">High Risk Category</div>
      )}
      <div className="space-y-2">
        {allFields.map(([key, field]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="font-medium text-gray-600">{field.label}</span>
            <span className="text-gray-900">{String(value[key] ?? '-')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * @deprecated Use SmartProtocolCard from '@/components/SmartProtocolCard' instead.
 */
export function GenUIRenderer({ schema, value, onChange, riskTier }: GenUIRendererProps) {
  const updateField = useCallback((key: string, val: unknown) => {
    onChange({ ...value, [key]: val })
  }, [value, onChange])

  const allFields: [string, SchemaField][] = [
    ...Object.entries(schema.core_fields ?? {}),
    ...Object.entries(schema.category_fields ?? {}),
  ]

  return (
    <div className="space-y-4">
      {allFields.map(([key, field]) => {
        const Renderer = FIELD_RENDERERS[field.type]
        if (!Renderer) return null
        return (
          <Renderer
            key={key}
            field={field}
            value={value[key]}
            onChange={(v) => updateField(key, v)}
            id={`field-${key}`}
          />
        )
      })}
      <HighRiskConfirmDialog riskTier={riskTier} />
    </div>
  )
}

export { SmartProtocolCard }
