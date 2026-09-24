/**
 * @vitest-environment jsdom
 */
import { act } from 'react'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequestJson, context } = vi.hoisted(() => ({
  mockRequestJson: vi.fn(),
  context: {
    organization: { id: 'org-1' },
    viewer: { isAdmin: true },
    connectedAccountsAvailable: true,
    searchAccess: { memberScoped: true },
    settingsFeatures: {
      hosted: true,
      hasEnterprisePlan: true,
      selfHosted: {},
    },
  },
}))

vi.mock('@/lib/api/client/request', () => ({ requestJson: mockRequestJson }))
vi.mock('@/app/o/[organizationId]/providers/organization-provider', () => ({
  useOrganizationContext: () => context,
}))
vi.mock('@/components/settings/settings-sidebar', () => ({
  SettingsSidebar: ({ items }: { items: { id: string; label: string }[] }) => (
    <nav>
      {items.map((item) => (
        <span key={item.id}>{item.label}</span>
      ))}
    </nav>
  ),
}))

import { OrganizationSettingsSidebar } from '@/app/o/[organizationId]/settings/organization-settings-sidebar'

let root: Root
let container: HTMLDivElement
let queryClient: QueryClient

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  mockRequestJson.mockImplementation(() => new Promise(() => {}))
  context.viewer.isAdmin = true
  context.settingsFeatures.hosted = true
  context.settingsFeatures.hasEnterprisePlan = true
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  queryClient = new QueryClient()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  queryClient.clear()
  focusManager.setFocused(undefined)
  vi.useRealTimers()
})

async function renderSidebar() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <OrganizationSettingsSidebar isCollapsed={false} showCollapsedTooltips={false} />
      </QueryClientProvider>
    )
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
}

describe('organization settings navigation first paint', () => {
  it('renders enterprise sections from the server-resolved features without a billing read', async () => {
    await renderSidebar()

    expect(container).toHaveTextContent('Audit logs')
    expect(container).toHaveTextContent('Data retention')
    expect(container).toHaveTextContent('Sources')
    expect(container).not.toHaveTextContent('Subscription')
    expect(mockRequestJson).not.toHaveBeenCalled()
  })

  it('keeps admin sections hidden from ordinary members even with enterprise features', async () => {
    context.viewer.isAdmin = false
    await renderSidebar()

    expect(container).toHaveTextContent('Search MCP')
    expect(container).not.toHaveTextContent('Audit logs')
    expect(mockRequestJson).not.toHaveBeenCalled()
  })

  it('does not display enterprise sections when the organization is not entitled', async () => {
    context.settingsFeatures.hasEnterprisePlan = false
    await renderSidebar()

    expect(container).not.toHaveTextContent('Audit logs')
    expect(mockRequestJson).not.toHaveBeenCalled()
  })
})
