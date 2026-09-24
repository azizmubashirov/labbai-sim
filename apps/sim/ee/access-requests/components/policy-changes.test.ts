/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  describePolicyChange,
  describePolicyValue,
} from '@/ee/access-requests/components/policy-changes'

const target = { kind: 'integration', id: 'google_sheets_v2' } as const

describe('permission change summaries', () => {
  it('names only newly allowed entries without hiding the changed field', () => {
    expect(
      describePolicyChange(
        {
          configKey: 'allowedIntegrations',
          label: 'Integrations',
          before: ['gmail_v2'],
          after: ['gmail_v2', 'google_sheets_v2'],
        },
        target,
        'Google Sheets'
      )
    ).toBe('Allow Google Sheets')
  })
  it('preserves broader provider changes instead of replacing every value with the requested target', () => {
    expect(
      describePolicyChange(
        {
          configKey: 'allowedModelProviders',
          label: 'Providers',
          before: ['anthropic'],
          after: ['anthropic', 'openai'],
        },
        { kind: 'model', id: 'gpt-4.1' },
        'GPT-4.1'
      )
    ).toBe('Allow openai')
  })
  it('distinguishes removal from allowlists and denylists', () => {
    expect(
      describePolicyChange(
        {
          configKey: 'allowedIntegrations',
          label: 'Integrations',
          before: ['google_sheets_v2'],
          after: [],
        },
        target,
        'Google Sheets'
      )
    ).toBe('Remove Google Sheets')
    expect(
      describePolicyChange(
        {
          configKey: 'deniedTools',
          label: 'Blocked tools',
          before: ['google_sheets_append'],
          after: [],
        },
        { kind: 'tool', id: 'google_sheets_append' },
        'Google Sheets append'
      )
    ).toBe('Unblock Google Sheets append')
  })
  it('reports both additions and removals', () => {
    expect(
      describePolicyChange(
        {
          configKey: 'allowedIntegrations',
          label: 'Integrations',
          before: ['gmail_v2'],
          after: ['google_sheets_v2'],
        },
        target,
        'Google Sheets'
      )
    ).toBe('Allow Google Sheets; Remove Gmail')
  })
  it('distinguishes unrestricted and empty allowlists', () => {
    expect(
      describePolicyChange(
        { configKey: 'allowedIntegrations', label: 'Integrations', before: [], after: null },
        target,
        'Google Sheets'
      )
    ).toBe('Allow all')
    expect(
      describePolicyChange(
        { configKey: 'allowedIntegrations', label: 'Integrations', before: null, after: [] },
        target,
        'Google Sheets'
      )
    ).toBe('Allow none')
    expect(
      describePolicyChange(
        {
          configKey: 'allowedIntegrations',
          label: 'Integrations',
          before: null,
          after: ['google_sheets_v2'],
        },
        target,
        'Google Sheets'
      )
    ).toBe('Allow only Google Sheets')
  })
  it('shows the direction of a boolean restriction', () => {
    expect(
      describePolicyChange(
        { configKey: 'hideTablesTab', label: 'Tables', before: true, after: false },
        { kind: 'feature', configKey: 'hideTablesTab' },
        'Tables'
      )
    ).toBe('Restricted → Allowed')
  })
})

describe('permission change details', () => {
  it('uses canonical names for every integration and preserves the original snapshot', () => {
    const values = ['gmail_v2', 'notion_v2', 'google_sheets_v2', 'loop', 'parallel']
    const before = structuredClone(values)
    expect(describePolicyValue(values, 'allowedIntegrations', target, 'Google Sheets')).toBe(
      'Gmail, Notion, Google Sheets, Loop, Parallel'
    )
    expect(values).toEqual(before)
  })

  it('collapses only equivalent integration aliases in both lists and change summaries', () => {
    expect(
      describePolicyValue(
        ['Gmail', 'gmail_v2', 'notion', 'notion_v2'],
        'allowedIntegrations',
        target,
        'Google Sheets'
      )
    ).toBe('Gmail, Notion')
    expect(
      describePolicyChange(
        {
          configKey: 'allowedIntegrations',
          label: 'Integrations',
          before: ['gmail', 'notion'],
          after: ['gmail_v2', 'notion_v2', 'google_sheets_v2'],
        },
        target,
        'Google Sheets'
      )
    ).toBe('Allow Google Sheets')
    expect(
      describePolicyChange(
        {
          configKey: 'allowedIntegrations',
          label: 'Integrations',
          before: ['google_sheets'],
          after: ['google_sheets_v2'],
        },
        target,
        'Google Sheets'
      )
    ).toBe('No membership change')
  })

  it('retains unknown IDs exactly and does not read inherited object properties', () => {
    expect(
      describePolicyValue(
        ['Unknown_Integration_v2', 'constructor', 'toString', '__proto__'],
        'allowedIntegrations',
        target,
        'Google Sheets'
      )
    ).toBe('Unknown_Integration_v2, constructor, toString, __proto__')
  })

  it('uses the request label for an integration outside the built-in registry', () => {
    expect(
      describePolicyValue(
        ['Custom_Integration'],
        'allowedIntegrations',
        { kind: 'integration', id: 'custom_integration' },
        'Custom integration'
      )
    ).toBe('Custom integration')
  })

  it('keeps meaningful model and tool versions distinct', () => {
    expect(
      describePolicyValue(['model_v1', 'model_v2'], 'deniedModels', target, 'Google Sheets')
    ).toBe('model_v1, model_v2')
    expect(
      describePolicyValue(['tool_v1', 'tool_v2'], 'deniedTools', target, 'Google Sheets')
    ).toBe('tool_v1, tool_v2')
  })

  it('preserves the difference between unrestricted, empty, and boolean values', () => {
    expect(describePolicyValue(null, 'allowedIntegrations', target, 'Google Sheets')).toBe(
      'All allowed'
    )
    expect(describePolicyValue([], 'allowedIntegrations', target, 'Google Sheets')).toBe('None')
    expect(
      describePolicyValue(
        true,
        'hideTablesTab',
        { kind: 'feature', configKey: 'hideTablesTab' },
        'Tables'
      )
    ).toBe('Restricted')
  })
})
