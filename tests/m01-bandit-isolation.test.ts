import { describe, it, expect } from 'vitest'

describe('M01 Bandit Reader Isolation', () => {
  const sqlPath = '../supabase/migrations/001_schema.sql'

  it('migration file contains CREATE ROLE bandit_reader', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(require.resolve(sqlPath), 'utf-8')
    expect(content).toContain('CREATE ROLE bandit_reader')
  })

  it('migration file revokes ALL on credit_records from bandit_reader', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(require.resolve(sqlPath), 'utf-8')
    expect(content).toContain('REVOKE ALL ON credit_records FROM bandit_reader')
  })

  it('migration file revokes ALL on credit_events from bandit_reader', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(require.resolve(sqlPath), 'utf-8')
    expect(content).toContain('REVOKE ALL ON credit_events FROM bandit_reader')
  })

  it('migration file grants SELECT on orders, protocols, bandit_stats to bandit_reader', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(require.resolve(sqlPath), 'utf-8')
    expect(content).toContain('GRANT SELECT ON orders, protocols, bandit_stats TO bandit_reader')
  })

  it('migration file does not grant INSERT/UPDATE/DELETE to bandit_reader', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(require.resolve(sqlPath), 'utf-8')
    expect(content).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE)\s+ON.*TO\s+bandit_reader/)
  })
})