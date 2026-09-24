/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_SETTINGS_ITEMS,
  ACCOUNT_SETTINGS_PATH_ALIASES,
  parseSettingsPathSection,
} from '@/components/settings/navigation'

describe('standalone settings section resolution', () => {
  it('keeps Billing active for the static account credit-usage route', () => {
    expect(
      parseSettingsPathSection({
        path: '/account/settings/billing/credit-usage',
        items: ACCOUNT_SETTINGS_ITEMS,
        defaultSection: 'general',
        aliases: ACCOUNT_SETTINGS_PATH_ALIASES,
      })
    ).toBe('billing')
  })
})
