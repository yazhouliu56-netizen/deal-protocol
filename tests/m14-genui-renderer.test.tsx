import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

vi.mock('@/components/ui/input', () => ({ Input: (p: Record<string, unknown>) => React.createElement('input', p) }))
vi.mock('@/components/ui/textarea', () => ({ Textarea: (p: Record<string, unknown>) => React.createElement('textarea', p) }))
vi.mock('@/components/ui/badge', () => ({ Badge: (p: Record<string, unknown>) => React.createElement('span', p) }))
vi.mock('@/components/ui/button', () => ({ Button: (p: Record<string, unknown>) => React.createElement('button', p) }))
vi.mock('@/lib/utils', () => ({ cn: (...args: string[]) => args.filter(Boolean).join(' ') }))

describe('M14 GenUIRenderer', () => {
  const petSchema = {
    core_fields: {
      pet_name: { type: 'string', label: '宠物名称', required: true },
      description: { type: 'text', label: '情况描述', required: true },
      service_date: { type: 'datetime', label: '上门时间', required: true },
    },
    category_fields: {
      pet_type: {
        type: 'enum',
        label: '宠物类型',
        required: true,
        options: ['狗', '猫', '鸟', '其他'],
      },
      care_hours: { type: 'int_array', label: '看护时长(小时)', min: 1, max: 12 },
      tools_needed: { type: 'array', label: '自带工具', items: { type: 'string' } },
      has_allergies: { type: 'boolean', label: '是否有过敏史' },
    },
  }

  it('imports and defines GenUIRenderer component', async () => {
    const mod = await import('@/lib/genui-renderer')
    expect(mod.GenUIRenderer).toBeDefined()
    expect(typeof mod.GenUIRenderer).toBe('function')
  })

  it('renders pet care schema with correct field labels', async () => {
    const mod = await import('@/lib/genui-renderer')
    const onChange = vi.fn()

    const html = renderToString(
      React.createElement(mod.GenUIRenderer, { schema: petSchema, value: {}, onChange }),
    )

    expect(html).toContain('宠物名称')
    expect(html).toContain('情况描述')
    expect(html).toContain('上门时间')
    expect(html).toContain('宠物类型')
    expect(html).toContain('看护时长(小时)')
    expect(html).toContain('自带工具')
    expect(html).toContain('是否有过敏史')
  })

  it('renders all 8 field type variants', async () => {
    const mod = await import('@/lib/genui-renderer')

    const allTypes = ['string', 'text', 'datetime', 'number', 'enum', 'int_array', 'array', 'boolean']
    const catFields: Record<string, unknown> = {}
    for (let i = 0; i < allTypes.length; i++) {
      const t = allTypes[i]
      catFields[`field_${t}`] =
        t === 'enum'
          ? { type: t, label: `${t} field`, options: ['A', 'B'] }
          : t === 'int_array'
            ? { type: t, label: `${t} field`, min: 1, max: 10 }
            : t === 'array'
              ? { type: t, label: `${t} field`, items: { type: 'string' } }
              : { type: t, label: `${t} field` }
    }

    const testSchema: Record<string, unknown> = { core_fields: {}, category_fields: catFields }
    const onChange = vi.fn()

    const html = renderToString(
      React.createElement(mod.GenUIRenderer, { schema: testSchema as any, value: {}, onChange }),
    )

    for (const t of allTypes) {
      expect(html).toContain(`${t} field`)
    }
  })

  it('宠物喂养 schema has all required field types', () => {
    expect(Object.keys(petSchema.core_fields)).toHaveLength(3)
    expect(Object.keys(petSchema.category_fields)).toHaveLength(4)

    expect(petSchema.core_fields.pet_name.type).toBe('string')
    expect(petSchema.core_fields.pet_name.required).toBe(true)

    expect(petSchema.category_fields.pet_type.type).toBe('enum')
    expect(petSchema.category_fields.pet_type.options).toContain('狗')

    expect(petSchema.category_fields.care_hours.type).toBe('int_array')
    expect(petSchema.category_fields.care_hours.min).toBe(1)
    expect(petSchema.category_fields.care_hours.max).toBe(12)

    expect(petSchema.category_fields.tools_needed.type).toBe('array')
    expect(petSchema.category_fields.has_allergies.type).toBe('boolean')
  })

  it('renders HighRiskConfirmDialog when riskTier=high', async () => {
    const mod = await import('@/lib/genui-renderer')
    const onChange = vi.fn()
    const html = renderToString(
      React.createElement(mod.GenUIRenderer, { schema: petSchema, value: {}, onChange, riskTier: 'high' }),
    )
    expect(html).toContain('high-risk')
    expect(html).toContain('I understand and agree to proceed')
  })

  it('does not render confirm dialog for low risk', async () => {
    const mod = await import('@/lib/genui-renderer')
    const onChange = vi.fn()
    const html = renderToString(
      React.createElement(mod.GenUIRenderer, { schema: petSchema, value: {}, onChange, riskTier: 'low' }),
    )
    expect(html).not.toContain('high-risk')
  })
})