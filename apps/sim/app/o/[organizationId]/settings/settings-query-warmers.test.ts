/**
 * @vitest-environment node
 */
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequestJson, mockGetOrganization } = vi.hoisted(() => ({
  mockRequestJson: vi.fn(),
  mockGetOrganization: vi.fn(),
}))

vi.mock('@/lib/api/client/request', () => ({ requestJson: mockRequestJson }))
vi.mock('@/lib/auth/auth-client', () => ({
  client: { organization: { getFullOrganization: mockGetOrganization } },
}))

import { warmOrganizationSettingsSectionQuery } from '@/app/o/[organizationId]/settings/settings-query-warmers'
import {
  organizationDetailQueryOptions,
  organizationRosterQueryOptions,
} from '@/hooks/queries/organization'

let queryClient: QueryClient
const adminContext = { organizationId: 'org-1', isAdmin: true }

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockGetOrganization.mockResolvedValue({ data: { id: 'org-1' } })
  mockRequestJson.mockResolvedValue({ success: true, data: { organizationId: 'org-1' } })
})

afterEach(() => queryClient.clear())

describe('organization settings query warming', () => {
  it('starts member data together and reuses it through the consumer options', async () => {
    warmOrganizationSettingsSectionQuery(queryClient, adminContext, 'members')
    expect(mockGetOrganization).toHaveBeenCalledExactlyOnceWith({
      query: { organizationId: 'org-1' },
      fetchOptions: { signal: expect.any(AbortSignal) },
    })
    expect(mockRequestJson).toHaveBeenCalledTimes(1)

    await Promise.all([
      queryClient.fetchQuery(organizationDetailQueryOptions('org-1')),
      queryClient.fetchQuery(organizationRosterQueryOptions('org-1')),
    ])
    warmOrganizationSettingsSectionQuery(queryClient, adminContext, 'members')

    expect(mockGetOrganization).toHaveBeenCalledTimes(1)
    expect(mockRequestJson).toHaveBeenCalledTimes(1)
    expect(mockRequestJson.mock.calls.map(([, input]) => input)).toEqual([
      { params: { id: 'org-1' }, signal: expect.any(AbortSignal) },
    ])
  })

  it('does not fetch unrelated sections or an empty organization', () => {
    warmOrganizationSettingsSectionQuery(queryClient, adminContext, 'general')
    warmOrganizationSettingsSectionQuery(queryClient, adminContext, 'audit-logs')
    warmOrganizationSettingsSectionQuery(
      queryClient,
      { ...adminContext, organizationId: '' },
      'members'
    )

    expect(mockGetOrganization).not.toHaveBeenCalled()
    expect(mockRequestJson).not.toHaveBeenCalled()
  })
})
