/**
 * @vitest-environment node
 */
import {
  dbChainMockFns,
  queueTableRows,
  resetDbChainMock,
  resetEnvFlagsMock,
  schemaMock,
  setEnvFlags,
} from '@sim/testing'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockIsTriggerAvailable, mockGetOrganizationSubscription, mockEnqueue } = vi.hoisted(() => ({
  mockIsTriggerAvailable: vi.fn(),
  mockGetOrganizationSubscription: vi.fn(),
  mockEnqueue: vi.fn(),
}))

vi.mock('@/lib/billing/core/billing', () => ({
  getOrganizationSubscription: mockGetOrganizationSubscription,
}))
vi.mock('@/lib/billing/core/subscription', () => ({
  getHighestPriorityPersonalSubscription: vi.fn(),
}))
vi.mock('@/lib/core/async-jobs', () => ({
  getJobQueue: vi.fn(() => ({ enqueue: mockEnqueue })),
}))
vi.mock('@/lib/core/async-jobs/config', () => ({ shouldExecuteInline: vi.fn(() => false) }))
vi.mock('@/lib/core/async-jobs/region', () => ({ resolveTriggerRegion: vi.fn() }))
vi.mock('@/lib/core/config/trigger-availability', () => ({
  isTriggerAvailable: mockIsTriggerAvailable,
}))
vi.mock('@/lib/workspaces/policy', () => ({
  WORKSPACE_MODE: { PERSONAL: 'personal', ORGANIZATION: 'organization' },
  isOrganizationWorkspace: vi.fn(),
}))

import { tasks } from '@trigger.dev/sdk'
import {
  dispatchBoundedCleanup,
  dispatchCleanupJobs,
  runCleanupWithLimits,
} from '@/lib/billing/cleanup-dispatcher'
import { getHighestPriorityPersonalSubscription } from '@/lib/billing/core/subscription'
import { isOrganizationWorkspace } from '@/lib/workspaces/policy'

afterAll(resetEnvFlagsMock)

describe('dispatchCleanupJobs retention gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
    setEnvFlags({ isDataRetentionEnabled: false })
    mockIsTriggerAvailable.mockReturnValue(false)
    mockGetOrganizationSubscription.mockResolvedValue(null)
  })

  afterAll(() => {
    resetDbChainMock()
  })

  it('never dispatches retention deletion when retention is off', async () => {
    const result = await dispatchCleanupJobs('cleanup-logs')

    expect(result).toEqual({ jobIds: [], jobCount: 0, chunkCount: 0, workspaceCount: 0 })
    expect(mockIsTriggerAvailable).not.toHaveBeenCalled()
    expect(dbChainMockFns.select).not.toHaveBeenCalled()
  })

  it('scans workspaces once retention is explicitly enabled', async () => {
    setEnvFlags({ isDataRetentionEnabled: true })
    queueTableRows(schemaMock.workspace, [])

    await dispatchCleanupJobs('cleanup-logs')

    expect(dbChainMockFns.select).toHaveBeenCalled()
  })

  it('deletes nothing for a workspace with no configured retention', async () => {
    setEnvFlags({ isDataRetentionEnabled: true })
    /**
     * The safety property for self-hosted retention: with billing off every
     * workspace resolves as enterprise, which carries no plan default, so a
     * workspace whose organization configured nothing keeps its data forever.
     * Falling through to the free-tier default would silently expire logs on a
     * 30-day window the operator never chose.
     */
    queueTableRows(schemaMock.workspace, [
      {
        id: 'ws-1',
        billedAccountUserId: 'user-1',
        organizationId: null,
        workspaceMode: 'personal',
        organizationSettings: null,
      },
    ])
    queueTableRows(schemaMock.workspace, [])

    const result = await dispatchCleanupJobs('cleanup-logs')

    expect(result.workspaceCount).toBe(0)
    expect(mockGetOrganizationSubscription).not.toHaveBeenCalled()
    /**
     * No chunks at all, including the plan-wide housekeeping one. That chunk is
     * keyed to the hosted free-tier 30-day window, so emitting it off-hosted
     * would act on the very default the per-workspace pass refuses to apply.
     */
    expect(result.chunkCount).toBe(0)
  })
})

describe('organization-owned Search retention dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
    setEnvFlags({ isDataRetentionEnabled: true })
    mockIsTriggerAvailable.mockReturnValue(false)
    mockGetOrganizationSubscription.mockResolvedValue(null)
    mockEnqueue.mockResolvedValue('cleanup-job')
    queueTableRows(schemaMock.workspace, [])
  })

  it('dispatches an organization with zero workspaces using its own configured window', async () => {
    queueTableRows(schemaMock.organization, [
      {
        id: 'org-1',
        settings: {
          softDeleteRetentionHours: 72,
          retentionOverrides: [{ workspaceId: 'irrelevant', softDeleteRetentionHours: 1 }],
        },
      },
    ])
    queueTableRows(schemaMock.organization, [])
    const result = await dispatchCleanupJobs('cleanup-soft-deletes')
    expect(result).toMatchObject({ workspaceCount: 0, chunkCount: 1 })
    expect(mockEnqueue).toHaveBeenCalledWith(
      'cleanup-soft-deletes',
      {
        plan: 'enterprise',
        workspaceIds: [],
        organizationIds: ['org-1'],
        retentionHours: 72,
        label: 'enterprise/organization/org-1',
      },
      expect.any(Object)
    )
    expect(mockGetOrganizationSubscription).not.toHaveBeenCalled()
  })

  it('retains organization data forever when an off-hosted deployment configured no window', async () => {
    queueTableRows(schemaMock.organization, [{ id: 'org-1', settings: null }])
    queueTableRows(schemaMock.organization, [])
    await dispatchCleanupJobs('cleanup-soft-deletes')
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('dispatches configured organization chat retention independently of soft deletes', async () => {
    queueTableRows(schemaMock.organization, [
      { id: 'org-1', settings: { taskCleanupHours: 48, softDeleteRetentionHours: 72 } },
    ])
    queueTableRows(schemaMock.organization, [])
    await dispatchCleanupJobs('cleanup-tasks')
    expect(mockEnqueue).toHaveBeenCalledWith(
      'cleanup-tasks',
      expect.objectContaining({
        workspaceIds: [],
        organizationIds: ['org-1'],
        retentionHours: 48,
      }),
      expect.any(Object)
    )
  })

  it('does not dispatch workspace-only execution cleanup for an organization', async () => {
    await dispatchCleanupJobs('cleanup-logs')
    expect(
      dbChainMockFns.from.mock.calls.some(([table]) => table === schemaMock.organization)
    ).toBe(false)
    expect(mockEnqueue).not.toHaveBeenCalled()
  })
})

describe('cleanup limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDbChainMock()
    setEnvFlags({ isDataRetentionEnabled: true })
    mockIsTriggerAvailable.mockReturnValue(true)
    vi.mocked(getHighestPriorityPersonalSubscription).mockReset()
    mockGetOrganizationSubscription.mockReset()
    vi.mocked(isOrganizationWorkspace).mockReset()
  })

  it('enqueues one job without querying owners or dispatching child jobs', async () => {
    vi.mocked(tasks.trigger).mockResolvedValueOnce({ id: 'run-limited' } as never)
    expect(await dispatchBoundedCleanup('cleanup-logs', { workflowLogs: 3 })).toEqual({
      triggered: true,
      runId: 'run-limited',
      limits: { workflowLogs: 3 },
    })
    expect(tasks.trigger).toHaveBeenCalledWith(
      'cleanup-logs',
      { limits: { workflowLogs: 3 } },
      expect.objectContaining({ maxAttempts: 1 })
    )
    expect(dbChainMockFns.select).not.toHaveBeenCalled()
    expect(tasks.batchTrigger).not.toHaveBeenCalled()
  })

  it('shares budgets across owners and stops before the next page', async () => {
    queueTableRows(
      schemaMock.workspace,
      ['a', 'b', 'c'].map((id) => ({
        id,
        billedAccountUserId: 'user',
        organizationId: null,
        workspaceMode: 'personal',
        organizationSettings: { logRetentionHours: 24 },
      }))
    )
    const seen: number[] = []
    await runCleanupWithLimits('cleanup-logs', { workflowLogs: 2 }, async (_scope, budgets) => {
      seen.push(budgets.workflowLogs.remaining)
      expect(budgets.jobLogs.remaining).toBe(0)
      budgets.workflowLogs.remaining--
    })
    expect(seen).toEqual([2, 1])
    expect(dbChainMockFns.select).toHaveBeenCalledOnce()
  })

  it('rejects invalid direct task input before querying', async () => {
    await expect(
      runCleanupWithLimits('cleanup-logs', { workflowLogs: -1 }, vi.fn())
    ).rejects.toThrow()
    expect(dbChainMockFns.select).not.toHaveBeenCalled()
  })

  it('requires queued execution and respects the retention switch', async () => {
    mockIsTriggerAvailable.mockReturnValue(false)
    await expect(dispatchBoundedCleanup('cleanup-logs', { workflowLogs: 1 })).rejects.toThrow(
      'requires Trigger.dev'
    )
    setEnvFlags({ isDataRetentionEnabled: false })
    await expect(
      runCleanupWithLimits('cleanup-logs', { workflowLogs: 1 }, vi.fn())
    ).rejects.toThrow('retention is disabled')
    expect(dbChainMockFns.select).not.toHaveBeenCalled()
  })
})
