import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

interface PricingConfigSeed {
  category: string
  default_work_hours: number
  min_price: number
  warranty_months: number | null
  warranty_text: string | null
  material_markup: number
  fixed_quote_max_minutes: number
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const pricingSeeds: PricingConfigSeed[] = [
  {
    category: '家政',
    default_work_hours: 1.0,
    min_price: 50,
    warranty_months: null,
    warranty_text: null,
    material_markup: 0,
    fixed_quote_max_minutes: 30,
  },
  {
    category: '交友',
    default_work_hours: 2.0,
    min_price: 100,
    warranty_months: null,
    warranty_text: '不适用',
    material_markup: 0,
    fixed_quote_max_minutes: 30,
  },
  {
    category: '按摩',
    default_work_hours: 1.0,
    min_price: 80,
    warranty_months: null,
    warranty_text: '短期待 - 满意度保障，非传统保修',
    material_markup: 0,
    fixed_quote_max_minutes: 30,
  },
  {
    category: '医疗陪护',
    default_work_hours: 4.0,
    min_price: 200,
    warranty_months: null,
    warranty_text: '以合同约定为准',
    material_markup: 0,
    fixed_quote_max_minutes: 30,
  },
]

async function seed() {
  const { data: existing, error: fetchError } = await supabase
    .from('pricing_configs')
    .select('category')

  if (fetchError) {
    if (fetchError.code === '42P01') {
      console.error('pricing_configs table does not exist. Run 008_pricing_configs.sql first.')
      process.exit(1)
    }
    console.error('Error checking existing configs:', fetchError.message)
    process.exit(1)
  }

  const existingCategories = new Set((existing ?? []).map((r: { category: string }) => r.category))

  for (const config of pricingSeeds) {
    if (existingCategories.has(config.category)) {
      const { error: updateError } = await supabase
        .from('pricing_configs')
        .update(config)
        .eq('category', config.category)

      if (updateError) {
        console.error(`Error updating pricing config for ${config.category}:`, updateError.message)
      } else {
        console.log(`Updated pricing config for ${config.category}`)
      }
    } else {
      const { error: insertError } = await supabase
        .from('pricing_configs')
        .insert(config)

      if (insertError) {
        console.error(`Error inserting pricing config for ${config.category}:`, insertError.message)
      } else {
        console.log(`Inserted pricing config for ${config.category}`)
      }
    }
  }

  console.log('Pricing config seeding complete.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
