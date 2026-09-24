/**
 * @vitest-environment node
 */
import type { DataRetentionSettings } from '@sim/db/schema'
import { queueTableRows, resetDbChainMock, schemaMock } from '@sim/testing'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getForeignWorkspaceTargetsReason,
  resolveEffectiveRetentionHours,
} from '@/lib/billing/retention'

describe('resolveEffectiveRetentionHours', () => {
  const orgSettings: DataRetentionSettings = {
    logRetentionHours: 720,
    softDeleteRetentionHours: 2160,
    taskCleanupHours: null,
  }

  it('returns the org value when the workspace has no override', () => {
    expect(
      resolveEffectiveRetentionHours({ orgSettings, workspaceId: 'ws-1', key: 'logRetentionHours' })
    ).toBe(720)
  })

  it('returns the org value when an override exists but omits the field (inherit)', () => {
    expect(
      resolveEffectiveRetentionHours({
        orgSettings: { ...orgSettings, retentionOverrides: [{ workspaceId: 'ws-1' }] },
        workspaceId: 'ws-1',
        key: 'logRetentionHours',
      })
    ).toBe(720)
  })

  it('uses the override hours when the field is set to a number', () => {
    expect(
      resolveEffectiveRetentionHours({
        orgSettings: {
          ...orgSettings,
          retentionOverrides: [{ workspaceId: 'ws-1', logRetentionHours: 168 }],
        },
        workspaceId: 'ws-1',
        key: 'logRetentionHours',
      })
    ).toBe(168)
  })

  it('uses null (forever) when the override field is explicitly null', () => {
    expect(
      resolveEffectiveRetentionHours({
        orgSettings: {
          ...orgSettings,
          retentionOverrides: [{ workspaceId: 'ws-1', logRetentionHours: null }],
        },
        workspaceId: 'ws-1',
        key: 'logRetentionHours',
      })
    ).toBeNull()
  })

  it('only applies the override to its own workspace', () => {
    const settingsWithOverride: DataRetentionSettings = {
      ...orgSettings,
      retentionOverrides: [{ workspaceId: 'ws-1', logRetentionHours: 168 }],
    }
    expect(
      resolveEffectiveRetentionHours({
        orgSettings: settingsWithOverride,
        workspaceId: 'ws-2',
        key: 'logRetentionHours',
      })
    ).toBe(720)
  })

  it('returns null when neither an override nor an org value is configured', () => {
    expect(
      resolveEffectiveRetentionHours({ orgSettings, workspaceId: 'ws-1', key: 'taskCleanupHours' })
    ).toBeNull()
    expect(
      resolveEffectiveRetentionHours({
        orgSettings: null,
        workspaceId: 'ws-1',
        key: 'logRetentionHours',
      })
    ).toBeNull()
  })
})

describe('getForeignWorkspaceTargetsReason', () => {
  beforeEach(resetDbChainMock)
  afterAll(resetDbChainMock)

  it('skips the lookup entirely when nothing targets a workspace', async () => {
    await expect(
      getForeignWorkspaceTargetsReason({
        organizationId: 'org-1',
        retentionOverrides: [],
      })
    ).resolves.toBeNull()
  })

  it('accepts overrides whose workspaces belong to the organization', async () => {
    queueTableRows(schemaMock.workspace, [{ id: 'ws-1' }, { id: 'ws-2' }])

    await expect(
      getForeignWorkspaceTargetsReason({
        organizationId: 'org-1',
        retentionOverrides: [{ workspaceId: 'ws-1' }, { workspaceId: 'ws-2' }],
      })
    ).resolves.toBeNull()
  })

  it('rejects an override naming a workspace the organization does not own', async () => {
    queueTableRows(schemaMock.workspace, [{ id: 'ws-1' }])

    await expect(
      getForeignWorkspaceTargetsReason({
        organizationId: 'org-1',
        retentionOverrides: [{ workspaceId: 'ws-1' }, { workspaceId: 'ws-foreign' }],
      })
    ).resolves.toContain('ws-foreign')
  })
})
