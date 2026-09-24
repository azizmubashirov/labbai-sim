/**
 * @vitest-environment jsdom
 */
import { act, cloneElement, type ReactNode } from 'react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/queries/environment', () => ({
  usePersonalEnvironment: () => ({ data: {} }),
  useWorkspaceEnvironment: () => ({ data: { workspace: {}, personal: {} } }),
}))

const mocks = vi.hoisted(() => ({
  canAdmin: true,
  hasMaxAccess: true,
  replace: vi.fn(),
  push: vi.fn(),
  availabilityReady: true,
  availabilityLoading: false,
  availabilityError: null as Error | null,
  refetchAvailability: vi.fn(),
  unavailableProviders: [] as string[],
  integrationAvailability: new Map<
    string,
    { oauthAvailable: boolean; state: 'ready' | 'limited' | 'unavailable' | 'misconfigured' }
  >(),
  userId: 'user-1',
  urlUpdate: vi.fn(),
  oauthReturn: vi.fn(),
  features: { knowledgeMemberAccess: true, knowledgeSourceMirroredAccess: true },
  create: vi.fn(),
  update: vi.fn(),
  applyAccess: vi.fn(),
  prepare: vi.fn(),
  createPending: false,
  updatePending: false,
  accessPending: false,
  basesPending: false,
  basesError: null as Error | null,
  connectorsError: null as Error | null,
  connectorsPending: false,
  refetchBases: vi.fn(),
  refetchConnectors: vi.fn(),
  preparePending: false,
  prepareError: null as Error | null,
  prepareData: undefined as { knowledgeBaseId: string } | undefined,
  bases: [{ id: 'kb-search', name: 'Sim Search', isSearchIndex: true }] as {
    id: string
    name: string
    isSearchIndex?: boolean
  }[],
  connectors: [] as { id: string; connectorType: string; accessMode: string; status: string }[],
  credentials: [{ id: 'cred-source', name: 'Indexing account', provider: 'google-drive' }] as {
    id: string
    name: string
    provider: string
    type?: 'oauth' | 'service_account'
  }[],
  credentialGroup: null as {
    id: string
    name: string
    status: string
    options: {
      id: string
      label: string
      status: string
      provider: string
      configurationStatus: string
    }[]
  } | null,
  basesQuery: vi.fn(),
  connectorsQuery: vi.fn(),
}))

vi.mock('@/lib/auth/auth-client', () => ({
  useSession: () => ({ data: { user: { id: mocks.userId } } }),
}))
vi.mock('@/hooks/use-oauth-return', () => ({ useOAuthReturnForKBConnectors: mocks.oauthReturn }))
vi.mock('@/hooks/use-permission-config', () => ({
  usePermissionConfig: () => ({
    integrationAvailability: new Map([...mocks.integrationAvailability]),
    oauthServiceAvailability: new Map(
      ['google-drive', 'google_drive'].map((providerId) => [
        providerId,
        !mocks.unavailableProviders.includes(providerId),
      ])
    ),
    isIntegrationAvailabilityReady: mocks.availabilityReady,
    isIntegrationAvailabilityLoading: mocks.availabilityLoading,
    integrationAvailabilityError: mocks.availabilityError,
    refetchIntegrationAvailability: mocks.refetchAvailability,
  }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useParams: () => ({ workspaceId: 'workspace-1' }),
  usePathname: () => '/o/org-1/settings/integrations',
}))
vi.mock('@/app/workspace/[workspaceId]/providers/workspace-host-provider', () => ({
  useWorkspaceHostContext: () => ({ ownerBilling: {}, features: mocks.features }),
  useOptionalWorkspaceHostContext: () => ({ ownerBilling: {}, features: mocks.features }),
}))
vi.mock('@/app/workspace/[workspaceId]/providers/workspace-permissions-provider', () => ({
  useUserPermissionsContext: () => ({ canAdmin: mocks.canAdmin }),
}))
vi.mock('@/app/workspace/[workspaceId]/knowledge/[id]/hooks/use-connector-scope', () => ({
  useConnectorScope: (
    scope?:
      | { kind: 'workspace'; workspaceId: string }
      | { kind: 'organization'; organizationId: string }
  ) => ({
    scope: scope ?? { kind: 'workspace', workspaceId: 'workspace-1' },
    canAdmin: mocks.canAdmin,
    memberAccessAvailable: mocks.features.knowledgeMemberAccess,
    mirroredAccessAvailable: mocks.features.knowledgeSourceMirroredAccess,
    hasMaxAccess: mocks.hasMaxAccess,
  }),
}))
vi.mock('@/hooks/queries/kb/connectors', () => ({
  isConnectorSyncingOrPending: (row: {
    status: string
    accessMode?: string
    memberSyncStatus?: string
  }) =>
    ['pending', 'syncing'].includes(row.status) ||
    ['pending', 'running'].includes(row.memberSyncStatus ?? ''),
  useSearchIndex: (
    scope: { workspaceId?: string; organizationId?: string },
    options: { enabled: boolean }
  ) => {
    mocks.basesQuery(scope.workspaceId ?? scope.organizationId, options)
    return {
      data: { knowledgeBaseId: mocks.bases.find((base) => base.isSearchIndex)?.id ?? null },
      isPending: mocks.basesPending,
      isError: Boolean(mocks.basesError),
      error: mocks.basesError,
      isFetching: false,
      refetch: mocks.refetchBases,
    }
  },
  useCreateConnector: () => ({ mutate: mocks.create, isPending: mocks.createPending }),
  useUpdateConnector: () => ({ mutate: mocks.update, isPending: mocks.updatePending }),
  useUpdateConnectorAccess: () => ({ mutate: mocks.applyAccess, isPending: mocks.accessPending }),
  usePrepareSearchSource: () => ({
    mutate: mocks.prepare,
    data: mocks.prepareData,
    isPending: mocks.preparePending,
    error: mocks.prepareError,
  }),
  useConnectorList: (id?: string) => {
    mocks.connectorsQuery(id)
    return {
      data: mocks.connectors,
      isError: Boolean(mocks.connectorsError),
      error: mocks.connectorsError,
      isPending: mocks.connectorsPending,
      isSuccess: !mocks.connectorsPending && !mocks.connectorsError,
      isFetching: mocks.connectorsPending,
      refetch: mocks.refetchConnectors,
    }
  },
  useConnectorDocuments: () => ({ data: { documents: [], total: 0 }, isLoading: false }),
  useExcludeConnectorDocument: () => ({ mutate: vi.fn(), isPending: false }),
  useRestoreConnectorDocument: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/queries/oauth/oauth-credentials', () => ({
  useOAuthCredentials: () => ({
    data: mocks.credentials,
    isLoading: false,
    isSuccess: true,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
vi.mock('@/hooks/queries/source-accounts', () => ({
  useSourceAccounts: () => ({
    data: { credentialGroup: mocks.credentialGroup },
    isLoading: false,
    isPending: false,
    isSuccess: true,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    error: null,
  }),
}))
vi.mock('@/hooks/queries/selectors', () => ({
  useSelectorOptions: () => ({ data: [], isLoading: false, loadMore: vi.fn(), loadAll: vi.fn() }),
  useSelectorOptionDetails: () => ({ data: [], isLoading: false }),
  useSelectorOptionDetail: () => ({ data: undefined }),
}))
vi.mock('@/hooks/use-credential-refresh-triggers', () => ({
  useCredentialRefreshTriggers: () => undefined,
}))

import type { ConnectorData } from '@/lib/api/contracts/knowledge/connectors'
import { SearchSourceSetup } from '@/app/o/[organizationId]/settings/components/integrations/search-source-setup'
import { AddConnectorModal } from '@/app/workspace/[workspaceId]/knowledge/[id]/components/add-connector-modal'
import { EditConnectorModal } from '@/app/workspace/[workspaceId]/knowledge/[id]/components/edit-connector-modal'
import { useConnectorSetupStore } from '@/stores/connector-setup/store'

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(node: ReactNode, searchParams = '') {
  if (!root) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  }
  await act(async () =>
    root?.render(
      <NuqsTestingAdapter hasMemory searchParams={searchParams} onUrlUpdate={mocks.urlUpdate}>
        {node}
      </NuqsTestingAdapter>
    )
  )
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === label || node.getAttribute('aria-label') === label
  )
  expect(match, `Button ${label}`).toBeDefined()
  return match as HTMLButtonElement
}

async function click(element: HTMLElement) {
  await act(async () => element.click())
}

async function openSyncFrequency() {
  await act(async () => {
    button('Sync frequency').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    )
  })
}

function menuItem(label: string): HTMLElement {
  const match = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (node) => node.textContent?.trim() === label
  )
  expect(match, `Menu item ${label}`).toBeDefined()
  return match!
}

async function fill(placeholder: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  expect(input, `Input ${placeholder}`).not.toBeNull()
  await act(async () => input?.focus())
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input?.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function openCombo(currentLabel: string) {
  const combo = Array.from(document.querySelectorAll<HTMLElement>('[role="combobox"]')).find(
    (node) => node.textContent?.includes(currentLabel)
  )
  expect(combo, `Combobox ${currentLabel}`).toBeDefined()
  await click(combo!)
}

async function chooseCombo(currentLabel: string, nextLabel: string) {
  await openCombo(currentLabel)
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (node) => node.textContent?.trim() === nextLabel
  )
  expect(option, `Option ${nextLabel}`).toBeDefined()
  await act(async () => option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
}

function connector(overrides: Partial<ConnectorData> = {}): ConnectorData {
  return {
    id: 'connector-1',
    knowledgeBaseId: 'kb-search',
    connectorType: 'google_drive',
    credentialId: null,
    sourceConfig: {},
    syncMode: 'full',
    syncIntervalMinutes: 1440,
    status: 'active',
    lastSyncAt: null,
    lastSyncError: null,
    lastSyncDocCount: null,
    nextSyncAt: null,
    consecutiveFailures: 0,
    accessMode: 'members',
    viewerMembership: null,
    credentialGroupId: 'group-1',
    credentialGroupOptionId: 'option-1',
    memberSyncStatus: 'idle',
    lastMemberSyncAt: null,
    nextMemberSyncAt: null,
    lastMemberSyncError: null,
    memberSyncConsecutiveFailures: 0,
    accessRewritePending: false,
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.userId = 'user-1'
  useConnectorSetupStore.getState().reset()
  mocks.canAdmin = true
  mocks.hasMaxAccess = true
  mocks.availabilityReady = true
  mocks.availabilityLoading = false
  mocks.availabilityError = null
  mocks.unavailableProviders = []
  mocks.features = { knowledgeMemberAccess: true, knowledgeSourceMirroredAccess: true }
  mocks.createPending = false
  mocks.updatePending = false
  mocks.accessPending = false
  mocks.basesPending = false
  mocks.basesError = null
  mocks.connectorsError = null
  mocks.connectorsPending = false
  mocks.preparePending = false
  mocks.prepareError = null
  mocks.prepareData = undefined
  mocks.bases = [{ id: 'kb-search', name: 'Sim Search', isSearchIndex: true }]
  mocks.connectors = []
  mocks.integrationAvailability.clear()
  mocks.credentials = [{ id: 'cred-source', name: 'Indexing account', provider: 'google-drive' }]
  mocks.credentialGroup = {
    id: 'group-1',
    name: 'Workspace accounts',
    status: 'active',
    options: [
      {
        id: 'option-1',
        label: 'Google Drive',
        provider: 'google-drive',
        status: 'active',
        configurationStatus: 'ready',
      },
    ],
  }
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.restoreAllMocks()
})

function organizationSetup() {
  return (
    <SearchSourceSetup
      scope={{ kind: 'organization', organizationId: 'org-1' }}
      canAdmin={mocks.canAdmin}
      memberAccessAvailable={mocks.features.knowledgeMemberAccess}
      mirroredAccessAvailable={mocks.features.knowledgeSourceMirroredAccess}
    />
  )
}

describe('organization setup entry points', () => {
  it.each([false, true])('does not load setup while closed (admin=%s)', async (canAdmin) => {
    mocks.canAdmin = canAdmin
    await render(organizationSetup())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(mocks.basesQuery).toHaveBeenLastCalledWith('org-1', { enabled: false })
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it.each(['?addConnector=google_drive', '?manage-source=source-one'])(
    'blocks reader setup at %s',
    async (query) => {
      mocks.canAdmin = false
      await render(organizationSetup(), query)
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(mocks.basesQuery).toHaveBeenLastCalledWith('org-1', { enabled: false })
      expect(mocks.prepare).not.toHaveBeenCalled()
      expect(mocks.replace).not.toHaveBeenCalled()
    }
  )

  it.each([
    { type: 'google_drive', mode: 'admin', name: 'Connect Google Drive service account' },
  ])(
    'opens the known $name configuration after preparing its missing index',
    async ({ type, mode, name }) => {
      mocks.bases = []
      const query = `?addConnector=${type}&source-access=${mode}`
      await render(organizationSetup(), query)
      expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith({
        organizationId: 'org-1',
        connectorType: type,
        accessMode: mode,
      })
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(document.body.textContent).not.toContain('Continue setup')
      expect(document.body.textContent).not.toContain('Find a source')
      mocks.preparePending = true
      await render(organizationSetup(), query)
      expect(mocks.prepare).toHaveBeenCalledOnce()
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      mocks.preparePending = false
      mocks.bases = [{ id: 'kb-search', name: 'Sim Search', isSearchIndex: true }]
      await render(organizationSetup(), query)
      expect(document.body.textContent).toContain(name)
      expect(document.body.textContent).not.toContain('Loading source setup')
      expect(document.querySelector('button[aria-label="Choose another source"]')).toBeNull()
      expect(mocks.prepare).toHaveBeenCalledOnce()
    }
  )

  it('waits for index discovery without opening an interim modal', async () => {
    mocks.bases = []
    mocks.basesPending = true
    await render(organizationSetup(), '?addConnector=google_drive')
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.textContent).not.toContain('Continue setup')
    mocks.basesPending = false
    mocks.bases = [{ id: 'kb-search', name: 'Sim Search', isSearchIndex: true }]
    await render(organizationSetup(), '?addConnector=google_drive')
    expect(mocks.prepare).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('Loading source setup')
    expect(document.body.textContent).toContain('Connect Google Drive service account')
  })

  it.each(['loading', 'error'] as const)(
    'does not prepare while availability is %s',
    async (state) => {
      mocks.bases = []
      mocks.availabilityReady = false
      mocks.availabilityLoading = state === 'loading'
      mocks.availabilityError = state === 'error' ? new Error('Availability failed') : null
      await render(organizationSetup(), '?addConnector=google_drive')
      expect(mocks.prepare).not.toHaveBeenCalled()
      expect(document.body.textContent).not.toContain('Continue setup')
      if (state === 'loading') {
        expect(document.querySelector('[role="dialog"]')).toBeNull()
      } else {
        expect(document.body.textContent).toContain('Availability failed')
      }
    }
  )

  it('retries failed preparation only when requested', async () => {
    mocks.bases = []
    await render(organizationSetup(), '?addConnector=google_drive')
    mocks.prepareError = new Error('Could not prepare the Search index')
    await render(organizationSetup(), '?addConnector=google_drive')
    expect(mocks.prepare).toHaveBeenCalledOnce()
    expect(document.body.textContent).toContain('Could not prepare the Search index')
    await click(button('Try again'))
    expect(mocks.prepare).toHaveBeenCalledTimes(2)
  })

  it('does not prepare after the selected setup is closed while index discovery finishes', async () => {
    mocks.bases = []
    mocks.basesPending = true
    await render(organizationSetup(), '?addConnector=google_drive')
    await render(organizationSetup())
    mocks.basesPending = false
    await render(organizationSetup())
    expect(mocks.prepare).not.toHaveBeenCalled()
  })

  it.each(['google_drive'])(
    'opens %s central setup directly and keeps explicit member links in member mode',
    async (type) => {
      mocks.bases = []
      await render(organizationSetup(), `?addConnector=${type}`)
      expect(mocks.prepare).toHaveBeenLastCalledWith({
        organizationId: 'org-1',
        connectorType: type,
        accessMode: 'admin',
      })
      expect(mocks.replace).not.toHaveBeenCalled()
      expect(document.body.textContent).not.toContain('Continue setup')
      mocks.bases = [{ id: 'kb-search', name: 'Sim Search', isSearchIndex: true }]
      await render(organizationSetup(), `?addConnector=${type}`)
      expect(button('Connect & Sync')).toBeDisabled()
      expect(document.body.textContent).toContain('Sync using')
      expect(document.querySelector('button[aria-label="Choose another source"]')).toBeNull()
      await click(button('Member accounts'))
      expect(button('Set up member accounts')).toBeEnabled()
      expect(document.body.textContent).not.toContain('Directory administrator email')
      await render(organizationSetup(), `?addConnector=${type}&source-access=members`)
      expect(button('Set up member accounts')).toBeEnabled()
      expect(document.body.textContent).not.toContain('Connect & Sync')
      expect(document.body.textContent).not.toContain('Directory administrator email')
      await click(button('Set up member accounts'))
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorType: type,
          accessMode: 'members',
          credentialId: undefined,
        }),
        expect.any(Object)
      )
    }
  )

  it.each([
    { type: 'google_drive', provider: 'google-drive', block: 'google_drive' },
  ])(
    'prepares central $type without a personal OAuth rollout and refuses a disabled member entry',
    async ({ type, provider, block }) => {
      mocks.bases = []
      mocks.features = { knowledgeMemberAccess: false, knowledgeSourceMirroredAccess: true }
      mocks.unavailableProviders = [provider]
      mocks.integrationAvailability.set(block, { oauthAvailable: false, state: 'limited' })
      await render(organizationSetup(), `?addConnector=${type}`)
      expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith({
        organizationId: 'org-1',
        connectorType: type,
        accessMode: 'admin',
      })
      expect(document.body.textContent).not.toContain('Not available in this organization')
      await render(organizationSetup(), `?addConnector=${type}&source-access=members`)
      expect(document.body.textContent).toContain('Not available in this organization')
      expect(mocks.prepare).toHaveBeenCalledOnce()
    }
  )

  it('prepares explicit member sources under the organization without switching them to central mode', async () => {
    mocks.bases = []
    await render(organizationSetup(), '?addConnector=google_drive&source-access=members')
    expect(mocks.prepare).toHaveBeenCalledWith({
      organizationId: 'org-1',
      connectorType: 'google_drive',
      accessMode: 'members',
    })
  })

  it.each([
    { query: '?addConnector=google_drive', member: true, mirrored: false },
    { query: '?addConnector=google_drive&source-access=members', member: false, mirrored: true },
  ])(
    'does not substitute the other connection mode when its selected feature is denied: $query',
    async ({ query, member, mirrored }) => {
      mocks.bases = []
      mocks.features = { knowledgeMemberAccess: member, knowledgeSourceMirroredAccess: mirrored }
      await render(organizationSetup(), query)
      expect(document.body.textContent).toContain('Not available in this organization')
      expect(document.body.textContent).not.toContain('Continue setup')
      expect(mocks.prepare).not.toHaveBeenCalled()
    }
  )

  it.each([
    {
      type: 'google_drive',
      placeholder: 'e.g. 1aBcDeFg…, 2cDeFgHi… (comma-separated for multiple)',
      value: 'qa-folder',
      config: { folderId: ['qa-folder'] },
      manualField: 'Folders',
    },
  ])(
    'preserves the $type draft and chosen method when availability fails and recovers',
    async ({ type, placeholder, value, config, manualField }) => {
      const query = `?addConnector=${type}`
      await render(organizationSetup(), query)
      await click(button('Member accounts'))
      await click(button(`Switch ${manualField} to manual input`))
      await fill(placeholder, value)
      const submitLabel = 'Set up member accounts'
      expect(button(submitLabel)).toBeEnabled()

      mocks.availabilityReady = false
      mocks.availabilityError = new Error('Availability refresh failed')
      await render(organizationSetup(), query)
      expect(
        document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)?.value
      ).toBe(value)
      expect(button(submitLabel)).toBeDisabled()
      await click(button('Try again'))
      expect(mocks.refetchAvailability).toHaveBeenCalledOnce()
      expect(mocks.create).not.toHaveBeenCalled()

      mocks.availabilityReady = true
      mocks.availabilityError = null
      await render(organizationSetup(), query)
      expect(
        document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)?.value
      ).toBe(value)
      expect(button(submitLabel)).toBeEnabled()
      await click(button(submitLabel))
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorType: type,
          accessMode: 'members',
          sourceConfig: expect.objectContaining(config),
        }),
        expect.any(Object)
      )
    }
  )
})

describe('Search source setup with real connector dialogs', () => {
  it.each([
    ['source-one', '/o/org-1/settings/integrations/sources/source-one'],
    ['google_drive', '/o/org-1/settings/integrations'],
    ['', '/o/org-1/settings/integrations'],
  ])(
    'redirects legacy organization management for %s without loading the connector list',
    async (source, destination) => {
      await render(
        <SearchSourceSetup
          scope={{ kind: 'organization', organizationId: 'org-1' }}
          canAdmin
          memberAccessAvailable
          mirroredAccessAvailable
        />,
        `?manage-source=${source}`
      )
      if (source === 'source-one') expect(mocks.replace).toHaveBeenCalledWith(destination)
      else expect(mocks.replace).not.toHaveBeenCalled()
      expect(mocks.connectorsQuery).not.toHaveBeenCalled()
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    }
  )
})

describe('administrator source prerequisites in real connector dialogs', () => {
  const adminEmailPlaceholder = 'admin@yourcompany.com'
  const folderPlaceholder = 'e.g. 1aBcDeFg…, 2cDeFgHi… (comma-separated for multiple)'
  const driveCredential = {
    id: 'drive-credential',
    name: 'Drive indexing account',
    provider: 'google-drive',
    type: 'service_account' as const,
  }

  beforeEach(() => {
    mocks.credentials = [driveCredential]
  })

  it.each(['admin', 'workspace'] as const)(
    'offers inline Drive service-account setup only when a general KB requires it in %s mode',
    async (accessMode) => {
      mocks.credentials = []
      mocks.integrationAvailability.set('google_drive', { oauthAvailable: true, state: 'ready' })
      await render(
        <AddConnectorModal
          open
          onOpenChange={vi.fn()}
          knowledgeBaseId='kb-general'
          initialConnectorType='google_drive'
          initialAccessMode={accessMode}
        />
      )
      await openCombo(
        accessMode === 'admin' ? 'Select a service account' : 'Select Google Drive account'
      )
      const options = Array.from(document.querySelectorAll('[role="option"]')).map((node) =>
        node.textContent?.trim()
      )

      expect(options.includes('Add service account')).toBe(accessMode === 'admin')
      expect(options.includes('Connect Google Drive account')).toBe(accessMode === 'workspace')
    }
  )

  it.each([
    { type: 'google_drive', provider: 'google-drive' },
  ])(
    'requires the Directory administrator email in $type administrator mode and refuses empty or blank subjects',
    async ({ type, provider }) => {
      mocks.credentials = [{ ...driveCredential, provider }]
      await render(
        <AddConnectorModal
          open
          onOpenChange={vi.fn()}
          knowledgeBaseId='kb-search'
          isSearchIndex
          initialConnectorType={type}
          initialAccessMode='admin'
        />
      )
      expect(document.body.textContent).toContain('Directory administrator email*')
      expect(button('Connect & Sync')).toBeDisabled()
      await click(button('Connect & Sync'))
      expect(mocks.create).not.toHaveBeenCalled()
      await fill(adminEmailPlaceholder, '   ')
      expect(button('Connect & Sync')).toBeDisabled()

      await fill(adminEmailPlaceholder, 'admin@example.com')
      expect(button('Connect & Sync')).toBeEnabled()
      await click(button('Connect & Sync'))
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorType: type,
          accessMode: 'admin',
          credentialId: driveCredential.id,
          sourceConfig: expect.objectContaining({ adminEmail: 'admin@example.com' }),
        }),
        expect.any(Object)
      )
    }
  )

  it.each([
    { type: 'google_drive', provider: 'google-drive', name: 'Google Drive' },
  ])(
    'excludes personal OAuth accounts and stale OAuth drafts from $type administrator setup',
    async ({ type, provider, name }) => {
      const oauthCredential = {
        id: 'drive-personal',
        name: 'Personal Drive account',
        provider,
        type: 'oauth' as const,
      }
      mocks.credentials = [oauthCredential]
      const setupDraftKey = `user-1:workspace-1:kb-search:${type}`
      useConnectorSetupStore.getState().saveDraft(setupDraftKey, {
        sourceConfig: { adminEmail: 'admin@example.com' },
        canonicalModes: {},
        accessMode: 'admin',
        credentialId: oauthCredential.id,
        contentCredentialId: null,
        disabledTagIds: [],
        savedAt: Date.now(),
      })
      const modal = (
        <AddConnectorModal
          open
          onOpenChange={vi.fn()}
          knowledgeBaseId='kb-search'
          isSearchIndex
          initialConnectorType={type}
          setupDraftKey={setupDraftKey}
        />
      )
      await render(modal)
      expect(document.body.textContent).toContain('Service account')
      expect(document.body.textContent).not.toContain(oauthCredential.name)
      expect(button('Connect & Sync')).toBeDisabled()
      const picker = Array.from(document.querySelectorAll<HTMLElement>('[role="combobox"]')).find(
        (node) => node.textContent?.includes('Select a service account')
      )!
      await click(picker)
      expect(document.body.textContent).not.toContain(`Connect ${name} account`)
      expect(document.body.textContent).not.toContain(oauthCredential.name)
      await click(picker)
      mocks.credentials = [oauthCredential, { ...driveCredential, provider }]
      await render(cloneElement(modal))

      expect(button('Connect & Sync')).toBeEnabled()
      await click(button('Connect & Sync'))

      expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ credentialId: driveCredential.id, accessMode: 'admin' }),
        expect.any(Object)
      )
    }
  )

  it('replaces an existing Drive administrator account through the access operation', async () => {
    const oauthCredential = {
      id: 'drive-personal',
      name: 'Personal Drive account',
      provider: 'google-drive',
      type: 'oauth' as const,
    }
    const replacement = { ...driveCredential, id: 'drive-new', name: 'Replacement service account' }
    mocks.credentials = [oauthCredential, driveCredential, replacement]
    await render(
      <EditConnectorModal
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='kb-search'
        isSearchIndex
        connector={connector({
          connectorType: 'google_drive',
          accessMode: 'admin',
          credentialId: driveCredential.id,
          sourceConfig: { adminEmail: 'admin@example.com' },
        })}
      />
    )
    const picker = Array.from(document.querySelectorAll<HTMLElement>('[role="combobox"]')).find(
      (node) => node.textContent?.includes(driveCredential.name)
    )!
    await click(picker)
    expect(document.body.textContent).not.toContain(oauthCredential.name)
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (node) => node.textContent?.trim() === replacement.name
    )!
    await act(async () => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
    expect(button('Save')).toBeEnabled()
    expect(document.body.textContent).not.toContain('Change service account')

    await click(button('Save'))

    expect(mocks.applyAccess).toHaveBeenCalledExactlyOnceWith(
      {
        knowledgeBaseId: 'kb-search',
        connectorId: 'connector-1',
        access: { accessMode: 'admin', credentialId: replacement.id },
      },
      expect.any(Object)
    )
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each(['members', 'workspace'] as const)(
    'keeps the Drive crawl subject optional in %s mode',
    async (accessMode) => {
      await render(
        <AddConnectorModal
          open
          onOpenChange={vi.fn()}
          knowledgeBaseId='general-kb'
          initialConnectorType='google_drive'
          initialAccessMode={accessMode}
        />
      )
      const subjectLabel = accessMode === 'members' ? 'Sync documents with' : 'Crawl as'
      expect(document.body.textContent).toContain(subjectLabel)
      expect(document.body.textContent).not.toContain(`${subjectLabel}*`)
      const submit = button(accessMode === 'members' ? 'Create & Invite' : 'Connect & Sync')
      expect(submit).toBeEnabled()
      await click(submit)
      expect(mocks.create.mock.calls[0][0]).toMatchObject({
        knowledgeBaseId: 'general-kb',
        connectorType: 'google_drive',
        accessMode,
      })
      expect(mocks.create.mock.calls[0][0].sourceConfig.adminEmail).toBeFalsy()
    }
  )

  it('does not let an administrator erase the crawl subject from an existing mirrored Drive source', async () => {
    await render(
      <EditConnectorModal
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='kb-search'
        isSearchIndex
        connector={connector({
          connectorType: 'google_drive',
          accessMode: 'admin',
          credentialId: driveCredential.id,
          sourceConfig: { adminEmail: 'admin@example.com', fileType: 'documents' },
        })}
      />
    )
    expect(document.body.textContent).toContain('Directory administrator email*')
    await fill(adminEmailPlaceholder, '')
    expect(button('Save')).toBeDisabled()
    await click(button('Save'))
    expect(mocks.update).not.toHaveBeenCalled()
    await fill(adminEmailPlaceholder, 'replacement@example.com')
    expect(button('Save')).toBeEnabled()
    await click(button('Save'))
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      connectorId: 'connector-1',
      updates: {
        sourceConfig: {
          adminEmail: 'replacement@example.com',
          fileType: 'documents',
        },
      },
    })
    expect(mocks.applyAccess).not.toHaveBeenCalled()
  })

  it('guides a general knowledge-base member source back to saving its crawl subject without losing drafts or combining mutations', async () => {
    const existing = connector({
      connectorType: 'google_drive',
      sourceConfig: { folderId: 'original-folder', _canonicalModes: { folderId: 'advanced' } },
    })
    await render(
      <EditConnectorModal
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='kb-general'
        connector={existing}
      />
    )
    await fill(folderPlaceholder, 'draft-folder')
    await click(button('Service account'))
    expect(document.body.textContent).toContain(
      'Set Crawl as and save your settings before changing the connection method.'
    )
    expect(button('Apply connection method')).toBeDisabled()
    expect(button('Save')).toBeDisabled()
    await fill(adminEmailPlaceholder, 'admin@example.com')
    expect(button('Apply connection method')).toBeDisabled()
    await click(button('Edit settings'))

    expect(button('Member accounts')).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector(`input[placeholder="${folderPlaceholder}"]`)).toHaveValue(
      'draft-folder'
    )
    expect(document.querySelector(`input[placeholder="${adminEmailPlaceholder}"]`)).toHaveValue(
      'admin@example.com'
    )
    expect(button('Save')).toBeEnabled()
    await click(button('Save'))
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      updates: {
        sourceConfig: {
          adminEmail: 'admin@example.com',
          folderId: ['draft-folder'],
          _canonicalModes: { folderId: 'advanced' },
        },
      },
    })
    expect(mocks.applyAccess).not.toHaveBeenCalled()

    await render(
      <EditConnectorModal
        key='saved-settings'
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='kb-general'
        connector={connector({
          ...existing,
          sourceConfig: mocks.update.mock.calls[0][0].updates.sourceConfig,
        })}
      />
    )
    await click(button('Service account'))
    await chooseCombo('Select the account to sync as', driveCredential.name)
    expect(button('Apply connection method')).toBeEnabled()
    await click(button('Apply connection method'))
    expect(mocks.applyAccess).toHaveBeenCalledExactlyOnceWith(
      {
        knowledgeBaseId: 'kb-general',
        connectorId: existing.id,
        access: { accessMode: 'admin', credentialId: driveCredential.id },
      },
      expect.any(Object)
    )
    expect(mocks.update).toHaveBeenCalledOnce()
  })

  it.each(['creating', 'saving', 'switching access'] as const)(
    'disables generic source inputs, dropdowns, selectors, and mode toggles while %s',
    async (phase) => {
      mocks.createPending = phase === 'creating'
      mocks.updatePending = phase === 'saving'
      mocks.accessPending = phase === 'switching access'
      await render(
        phase === 'creating' ? (
          <AddConnectorModal
            open
            onOpenChange={vi.fn()}
            knowledgeBaseId='kb-search'
            isSearchIndex
            initialConnectorType='google_drive'
            initialAccessMode='admin'
          />
        ) : (
          <EditConnectorModal
            open
            onOpenChange={vi.fn()}
            knowledgeBaseId='kb-search'
            isSearchIndex
            connector={connector({
              connectorType: 'google_drive',
              accessMode: 'admin',
              credentialId: driveCredential.id,
              sourceConfig: { adminEmail: 'admin@example.com' },
            })}
          />
        )
      )
      expect(document.querySelector(`input[placeholder="${adminEmailPlaceholder}"]`)).toBeDisabled()
      expect(button('Switch Folders to manual input')).toBeDisabled()
      if (phase === 'creating') await click(button('More options'))
      const dropdown = Array.from(document.querySelectorAll('[role="combobox"]')).find((node) =>
        node.textContent?.includes('Select file type')
      )
      expect(dropdown).toHaveAttribute('aria-disabled', 'true')
      const folders = Array.from(document.querySelectorAll('[role="combobox"]')).find((node) =>
        node.textContent?.includes('Select one or more folders (optional)')
      )
      expect(folders).toHaveAttribute('aria-disabled', 'true')
    }
  )
})

describe('canonical Search connector safety', () => {
  it('offers only reviewed source types, including when a deep link names an unsupported provider', async () => {
    await render(
      <AddConnectorModal
        open
        onOpenChange={() => {}}
        knowledgeBaseId='kb-search'
        isSearchIndex
        initialConnectorType='airtable'
      />
    )
    const sourceButtons = Array.from(document.querySelectorAll('button')).filter((node) =>
      ['Google Docs', 'Google Drive', 'Notion', 'Airtable'].some(
        (name) => node.getAttribute('aria-label') === name
      )
    )
    expect(sourceButtons.map((node) => node.getAttribute('aria-label'))).toEqual(['Google Drive'])
  })

  it('defaults an OAuth source to member accounts and never offers workspace-wide access', async () => {
    await render(
      <AddConnectorModal
        open
        onOpenChange={() => {}}
        knowledgeBaseId='kb-search'
        isSearchIndex
        initialConnectorType='google_drive'
      />
    )
    expect(button('Member accounts')).toHaveAttribute('aria-checked', 'true')
    expect(
      Array.from(document.querySelectorAll('button')).some(
        (node) => node.textContent === 'Workspace'
      )
    ).toBe(false)
    expect(document.body.textContent).not.toContain('Everyone in this workspace')
  })

  it('keeps an existing Search member source out of workspace-wide mode', async () => {
    await render(
      <EditConnectorModal
        open
        onOpenChange={() => {}}
        knowledgeBaseId='kb-search'
        isSearchIndex
        connector={connector()}
      />
    )
    expect(document.body.textContent).toContain('Member accounts')
    expect(
      Array.from(document.querySelectorAll('[role="radio"]')).filter((node) =>
        ['Workspace', 'Member accounts', 'Admin or service account'].includes(
          node.textContent ?? ''
        )
      )
    ).toHaveLength(0)
    expect(
      Array.from(document.querySelectorAll('button')).some(
        (node) => node.textContent === 'Workspace'
      )
    ).toBe(false)
    expect(document.body.textContent).not.toContain('Everyone in this workspace')
  })
})

describe('resuming Search source setup', () => {
  it('selects the verified OAuth account instead of the previously selected one', async () => {
    mocks.credentials = [
      { id: 'cred-source', name: 'Old account', provider: 'google_drive' },
      { id: 'cred-new', name: 'New account', provider: 'google_drive' },
    ]
    await render(
      <AddConnectorModal
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='kb-search'
        isSearchIndex
        initialConnectorType='google_drive'
      />
    )
    await act(async () => mocks.oauthReturn.mock.calls.at(-1)?.[1]('cred-new'))
    const account = document.querySelector('[role="combobox"]')
    expect(account?.textContent).toContain('New account')
  })

  it('keeps Live unavailable without Max while allowing a manual schedule', async () => {
    mocks.hasMaxAccess = false
    await render(
      <AddConnectorModal
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='ordinary-kb'
        initialConnectorType='google_drive'
      />
    )
    await openSyncFrequency()
    expect(menuItem('Live (Max)')).toHaveAttribute('aria-disabled', 'true')
    await click(menuItem('Live (Max)'))
    expect(button('Sync frequency')).toHaveTextContent('Daily')
    await click(menuItem('Manual only'))
    expect(button('Sync frequency')).toHaveTextContent('Manual only')
  })

  it('keeps the general KB schedule and both document-detail sections collapsed by default', async () => {
    await render(
      <AddConnectorModal
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='ordinary-kb'
        initialConnectorType='google_drive'
      />
    )
    expect(document.body.textContent).toContain('Sync Frequency')
    await openSyncFrequency()
    expect(menuItem('Live')).not.toHaveAttribute('aria-disabled', 'true')
    await click(menuItem('Daily'))
    expect(button('Document details (optional)')).toHaveAttribute('aria-expanded', 'false')
    await click(button('Document details (optional)'))
    expect(document.body.textContent).toContain('Metadata tags')
    await render(
      <AddConnectorModal
        key='search'
        open
        onOpenChange={vi.fn()}
        knowledgeBaseId='kb-search'
        isSearchIndex
        initialConnectorType='google_drive'
      />
    )
    expect(document.body.textContent).not.toContain('Sync Frequency')
    expect(button('More options')).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Search setup guides', () => {
  it.each(['add', 'edit'])('does not show Search guides in general KB %s dialogs', async (mode) => {
    await render(
      mode === 'add' ? (
        <AddConnectorModal
          open
          onOpenChange={vi.fn()}
          knowledgeBaseId='kb-general'
          initialType='google_drive'
        />
      ) : (
        <EditConnectorModal
          open
          onOpenChange={vi.fn()}
          knowledgeBaseId='kb-general'
          connector={connector()}
        />
      )
    )

    expect(document.body.textContent).not.toContain('Setup guide')
  })
})
