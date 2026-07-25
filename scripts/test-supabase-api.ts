const T1 = 'sbp_a0422f02b9f0e1f713b9193e900691e6bbd7e3bc'
const token = T1

const ref = 'eixqnwaxcnwtxiizmdfs'

async function main() {
  const r1 = await fetch('https://api.supabase.com/v1/projects/' + ref, {
    headers: { Authorization: 'Bearer ' + token }
  })
  console.log('GET /projects status:', r1.status)
  const body = await r1.json().catch(() => null)
  console.log('name:', body?.name, 'org:', body?.organization_id)

  const r2 = await fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SELECT current_database(), current_schema, version()' })
  })
  console.log('POST /database/query status:', r2.status)
  const body2 = await r2.text()
  console.log('response:', body2.substring(0, 300))
}

main().catch(console.error)
