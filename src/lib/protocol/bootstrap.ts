import { getSupabase } from "@/lib/supabase-client"
import { isPlaceholderUrl } from "../supabase-mock"
import { serializeConfig } from "./config-serde"
import { protocolRegistry } from "./registry"
import { clearEngineCache } from "./engine"

let synced = false

/** 将内存中所有内置协议同步到数据库 */
export async function syncBuiltinsToDb(): Promise<void> {
  if (synced) return
  if (isPlaceholderUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) return

  const supabase = getSupabase()
  const builtins = protocolRegistry.getAll()

  for (const def of builtins) {
    const { error: upsertError } = await supabase
      .from('protocols')
      .upsert({
        id: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        enabled: true,
      }, { onConflict: 'id' })
    if (upsertError) throw upsertError

    const { data: existing } = await supabase
      .from('protocol_versions')
      .select('id')
      .eq('protocol_id', def.id)
      .eq('version', def.version)
      .maybeSingle()

    if (!existing) {
      const { error: insertError } = await supabase
        .from('protocol_versions')
        .insert({
          protocol_id: def.id,
          version: def.version,
          config: JSON.stringify(serializeConfig(def)),
        })
      if (insertError) throw insertError
    } else {
      const { error: updateError } = await supabase
        .from('protocol_versions')
        .update({ config: JSON.stringify(serializeConfig(def)) })
        .eq('id', existing.id)
      if (updateError) throw updateError
    }
  }

  synced = true
}

/** 从数据库重新加载协议状态到内存 */
export async function reloadFromDb(): Promise<void> {
  const supabase = getSupabase()

  const { data: protocols } = await supabase
    .from('protocols')
    .select('id, enabled')
    .eq('enabled', true)

  for (const p of Array.isArray(protocols) ? protocols : []) {
    const registryDef = protocolRegistry.get(p.id)
    if (!registryDef) continue

    if (!p.enabled) {
      protocolRegistry.disable(p.id)
    } else {
      protocolRegistry.enable(p.id)
    }
  }

  clearEngineCache()
}

/** 获取 DB 中启用的协议列表（含最新版本配置） */
export async function getDbProtocols() {
  const supabase = getSupabase()

  const { data: protocols } = await supabase
    .from('protocols')
    .select('*')
    .eq('enabled', true)

  if (!protocols || protocols.length === 0) return []

  const protocolIds = protocols.map(p => p.id)
  const { data: versions } = await supabase
    .from('protocol_versions')
    .select('*')
    .in('protocol_id', protocolIds)
    .order('created_at', { ascending: false })

  const versionMap = new Map<string, any>()
  for (const v of Array.isArray(versions) ? versions : []) {
    if (!versionMap.has(v.protocol_id)) {
      versionMap.set(v.protocol_id, v)
    }
  }

  return protocols.map(p => ({
    ...p,
    versions: versionMap.has(p.id) ? [versionMap.get(p.id)!] : [],
  }))
}

/** 获取协议详情（含所有版本） */
export async function getDbProtocolDetail(id: string) {
  const supabase = getSupabase()

  const { data: protocol } = await supabase
    .from('protocols')
    .select('*')
    .eq('id', id)
    .single()

  if (!protocol) return null

  const { data: versions } = await supabase
    .from('protocol_versions')
    .select('*')
    .eq('protocol_id', id)
    .order('created_at', { ascending: false })

  return { ...protocol, versions: versions || [] }
}

export function resetSyncFlag(): void {
  synced = false
}
