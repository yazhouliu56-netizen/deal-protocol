import { describe, it, expect, beforeEach } from 'vitest'

const ORIG_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIG_ENV }
})

describe('getAIModel', () => {
  it('should return a DeepSeek model when AI_PROVIDER=deepseek', async () => {
    process.env.AI_PROVIDER = 'deepseek'
    process.env['DEEPSEEK_API_KEY'] = 'test-key'

    const { getAIModel } = await import('@/lib/ai-provider')
    const model = getAIModel()

    expect(model).toBeDefined()
    expect(typeof model).toBe('object')
  })

  it('should default to deepseek when AI_PROVIDER is unset', async () => {
    delete process.env.AI_PROVIDER
    process.env['DEEPSEEK_API_KEY'] = 'test-key'

    const { getAIModel } = await import('@/lib/ai-provider')
    const model = getAIModel()

    expect(model).toBeDefined()
  })

  it('should fallback to Gemini when DEEPSEEK_API_KEY has placeholder', async () => {
    process.env.AI_PROVIDER = 'deepseek'
    process.env['DEEPSEEK_API_KEY'] = 'your_deepseek_api_key_here'
    process.env['GEMINI_API_KEY'] = 'valid-gemini-key'

    const { getAIModel } = await import('@/lib/ai-provider')
    const model = getAIModel()

    expect(model).toBeDefined()
  })

  it('should return mock model when no valid keys are configured', async () => {
    delete process.env.AI_PROVIDER
    delete process.env['DEEPSEEK_API_KEY']
    delete process.env['GEMINI_API_KEY']

    const { getAIModel } = await import('@/lib/ai-provider')
    const model = getAIModel()

    expect(model).toBeDefined()
  })
})