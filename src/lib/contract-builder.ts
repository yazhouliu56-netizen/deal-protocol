import { callLLM } from '@/lib/llm-adapter'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import type { ProtocolJSON } from '@/lib/contracts'

interface ContractDoc {
  markdown: string
  html: string
  hash: string
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function generateFormalContractDoc(
  protocol: Partial<ProtocolJSON> & { id?: string; demander_id?: string },
): Promise<ContractDoc | null> {
  if (!protocol.id) return null

  const systemPrompt = `You are a legal contract generator for an O2O service platform.
Generate a formal Chinese service contract document in Markdown.
Include: service standard, pricing & refund terms, safety disclaimer, liability clause, and dispute resolution.
Output ONLY the Markdown document, no commentary.`

  const userPrompt = `Generate a formal service contract based on:
Category: ${protocol.category ?? 'N/A'}
Core fields: ${JSON.stringify(protocol.core_fields ?? {}, null, 2)}
Category fields: ${JSON.stringify(protocol.category_fields ?? {}, null, 2)}
Risk tier: ${protocol.risk_tier ?? 'low'}
Status: ${protocol.status ?? 'pending'}`

  let markdown: string
  try {
    markdown = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
  } catch {
    return null
  }

  if (!markdown || markdown.length < 50) return null

  const html = markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, '<br>\n')

  const hash = await sha256Hex(markdown)

  await appendEvidence({
    protocolId: protocol.id,
    eventType: 'CONTRACT_DOC_HASH',
    payload: { contract_doc_hash: hash, category: protocol.category ?? null },
    capturedBy: protocol.demander_id,
  })

  return { markdown, html, hash }
}
