import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { Client } from 'pg'

const PROJECT_ROOT = resolve(process.cwd())
const POOLER_URL_PATH = resolve(PROJECT_ROOT, 'supabase', '.temp', 'pooler-url')
const LOCAL_PW_FILE = resolve(PROJECT_ROOT, '.db-pw')

const SQL = `ALTER PUBLICATION supabase_realtime ADD TABLE demands, orders;`

async function main() {
  let databaseUrl = process.env.SUPABASE_DATABASE_URL || ''

  if (!databaseUrl) {
    if (!existsSync(POOLER_URL_PATH)) {
      console.error('ERROR: supabase/.temp/pooler-url not found. Run `supabase link` first.')
      process.exit(1)
    }

    const poolerUrl = readFileSync(POOLER_URL_PATH, 'utf-8').trim()
    const parts = poolerUrl.split('://')
    const afterProto = parts[1]
    const atIdx = afterProto.indexOf('@')
    const userPart = afterProto.substring(0, atIdx)
    const hostPart = afterProto.substring(atIdx)

    let password: string
    if (existsSync(LOCAL_PW_FILE)) {
      password = readFileSync(LOCAL_PW_FILE, 'utf-8').trim()
      console.log('Reading password from .db-pw file.')
    } else {
      password = process.env.SUPABASE_DB_PASSWORD || ''
    }

    if (!password) {
      console.error('ERROR: No database password found.')
      console.error('Create .db-pw file in project root with the password, or set SUPABASE_DATABASE_URL env var.')
      process.exit(1)
    }

    databaseUrl = `${parts[0]}://${userPart}:${encodeURIComponent(password)}${hostPart}`
  }

  console.log('Connecting to Supabase database...')
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 })

  try {
    await client.connect()
    console.log('Connected successfully.')

    const checkResult = await client.query(`
      SELECT tablename FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      ORDER BY tablename;
    `)
    const currentTables = checkResult.rows.map((r: any) => r.tablename)
    console.log(`Current tables in supabase_realtime: [${currentTables.join(', ')}]`)

    const needsDemands = !currentTables.includes('demands')
    const needsOrders = !currentTables.includes('orders')

    if (!needsDemands && !needsOrders) {
      console.log('Both demands and orders are already in the publication. Nothing to do.')
      await client.end()
      return
    }

    const toAdd = [needsDemands && 'demands', needsOrders && 'orders'].filter(Boolean) as string[]
    console.log(`Adding tables: ${toAdd.join(', ')}`)

    if (needsDemands) {
      await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE demands;')
      console.log('  ✓ demands added')
    }
    if (needsOrders) {
      await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE orders;')
      console.log('  ✓ orders added')
    }

    const verifyResult = await client.query(`
      SELECT tablename FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      ORDER BY tablename;
    `)
    const finalTables = verifyResult.rows.map((r: any) => r.tablename)
    console.log(`\nPublication tables after update: [${finalTables.join(', ')}]`)
    console.log('Supabase Realtime configuration complete.')
  } catch (err) {
    console.error('Failed to configure Supabase Realtime.')
    console.error(err)
    console.error('\n--- Manual fallback ---')
    console.error('Run the following SQL in Supabase Dashboard SQL Editor:')
    console.error(`  ${SQL}`)
    console.error('\nDashboard URL:')
    console.error('  https://supabase.com/dashboard/project/eixqnwaxcnwtxiizmdfs/sql/new')
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
}

main()
