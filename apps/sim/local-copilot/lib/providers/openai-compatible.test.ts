/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { isOpenAiReasoningModel } from '@/local-copilot/lib/providers/openai-compatible'

describe('isOpenAiReasoningModel', () => {
  it('treats gpt-5+, gpt-6 and o-series OpenAI models as reasoning models', () => {
    expect(isOpenAiReasoningModel('openai', 'gpt-5.5')).toBe(true)
    expect(isOpenAiReasoningModel('openai', 'gpt-6-sol')).toBe(true)
    expect(isOpenAiReasoningModel('openai', 'o4-mini')).toBe(true)
    expect(isOpenAiReasoningModel('azure-openai', 'gpt-5-mini')).toBe(true)
  })

  it('keeps max_tokens/temperature for classic chat models and other providers', () => {
    expect(isOpenAiReasoningModel('openai', 'gpt-4.1')).toBe(false)
    expect(isOpenAiReasoningModel('openai', 'gpt-4.1-mini')).toBe(false)
    expect(isOpenAiReasoningModel('openai-compatible', 'gpt-5.5')).toBe(false)
  })
})
