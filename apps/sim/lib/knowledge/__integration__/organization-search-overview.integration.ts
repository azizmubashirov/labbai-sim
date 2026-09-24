import { db } from '@sim/db'
import {
  document,
  knowledgeBase,
  knowledgeConnector,
  knowledgeConnectorSyncLog,
  member,
  organization,
  organizationSearchIntegration,
  user,
  workspace,
} from '@sim/db/schema'
import { generateId } from '@sim/utils/id'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createKnowledgeAclFixtureIds,
  seedKnowledgeAclFixture,
} from '@/lib/knowledge/__integration__/seed-source-access-fixture'
import { readOrganizationSearchOverview } from '@/lib/knowledge/application/organization-search-overview'
import { listSearchSources } from '@/lib/knowledge/application/search-sources'
import { SOURCE_PERMISSION_ERROR } from '@/lib/knowledge/connectors/sync-limits'

const ids = createKnowledgeAclFixtureIds()
const indexId = generateId()
const driveId = generateId()
const pausedDriveId = generateId()
const documentId = generateId()
const sourceIds = [driveId, pausedDriveId]
const principal = { kind: 'session', userId: ids.aliceId, sessionId: 'overview-admin' } as const
const input = { organizationId: ids.organizationId }

beforeAll(async () => {
  await seedKnowledgeAclFixture(ids)
  await db.insert(member).values([
    { id: generateId(), organizationId: ids.organizationId, userId: ids.aliceId, role: 'admin' },
    { id: generateId(), organizationId: ids.organizationId, userId: ids.bobId, role: 'member' },
  ])
  await db.insert(knowledgeBase).values({
    id: indexId,
    userId: ids.aliceId,
    organizationId: ids.organizationId,
    name: 'Overview fixture',
    isSearchIndex: true,
  })
  await db.insert(knowledgeConnector).values([
    {
      id: driveId,
      knowledgeBaseId: indexId,
      connectorType: 'google_drive',
      accessMode: 'admin',
      sourceConfig: {},
    },
    {
      id: pausedDriveId,
      knowledgeBaseId: indexId,
      connectorType: 'google_drive',
      accessMode: 'admin',
      sourceConfig: {},
    },
  ])
  await db.insert(document).values({
    id: documentId,
    knowledgeBaseId: indexId,
    connectorId: driveId,
    externalId: 'private-fixture',
    filename: 'private-title.txt',
    fileUrl: 'https://fixture.test/private',
    fileSize: 5,
    mimeType: 'text/plain',
    processingStatus: 'completed',
    acl: ['u:someone-else@fixture.test'],
    aclVerifiedAt: new Date(),
  })
})

beforeEach(async () => {
  await db
    .delete(organizationSearchIntegration)
    .where(eq(organizationSearchIntegration.organizationId, ids.organizationId))
  await db
    .delete(knowledgeConnectorSyncLog)
    .where(inArray(knowledgeConnectorSyncLog.connectorId, sourceIds))
  await db
    .update(knowledgeConnector)
    .set({
      status: 'active',
      memberSyncStatus: 'idle',
      lastSyncAt: new Date(),
      lastMemberSyncAt: new Date(),
      lastSyncError: null,
      lastMemberSyncError: null,
      listingCheckpoint: null,
      directoryCheckpoint: null,
      nextMemberSyncAt: null,
    })
    .where(inArray(knowledgeConnector.id, sourceIds))
  await db
    .update(knowledgeConnector)
    .set({ status: 'paused' })
    .where(eq(knowledgeConnector.id, pausedDriveId))
  await db
    .update(document)
    .set({
      processingStatus: 'completed',
      enabled: true,
      userExcluded: false,
      contentHash: null,
      storageKey: null,
      fileUrl: 'https://fixture.test/private',
    })
    .where(eq(document.id, documentId))
})

afterAll(async () => {
  await db.delete(workspace).where(eq(workspace.id, ids.workspaceId))
  await db.delete(organization).where(eq(organization.id, ids.organizationId))
  await db.delete(user).where(inArray(user.id, [ids.aliceId, ids.bobId]))
})

async function provider(connectorType: string) {
  return (await readOrganizationSearchOverview.execute({ principal, input })).providers.find(
    (item) => item.connectorType === connectorType
  )
}

describe('organization operational overview with real SQL', () => {
  it.each([
    SOURCE_PERMISSION_ERROR,
    `Directory refresh incomplete: fixture\n${SOURCE_PERMISSION_ERROR}`,
    `${SOURCE_PERMISSION_ERROR}\nSource listing failed for a fixture account`,
    `Directory refresh incomplete: fixture\n${SOURCE_PERMISSION_ERROR}\nSource listing failed for a fixture account`,
  ])(
    'recognizes a complete permission notice within composed diagnostics: %s',
    async (lastSyncError) => {
      await db
        .update(knowledgeConnector)
        .set({ lastSyncError })
        .where(eq(knowledgeConnector.id, driveId))
      expect(await provider('google_drive')).toMatchObject({
        status: 'needs_attention',
        issue: 'permission_sync_incomplete',
      })
    }
  )

  it('does not classify a provider message containing the permission text as its own notice', async () => {
    await db
      .update(knowledgeConnector)
      .set({ lastSyncError: `Provider message: ${SOURCE_PERMISSION_ERROR}` })
      .where(eq(knowledgeConnector.id, driveId))
    expect(await provider('google_drive')).toMatchObject({
      status: 'needs_attention',
      issue: 'sync_failed',
    })
  })

  it('ignores permission notices on paused sources', async () => {
    await db
      .update(knowledgeConnector)
      .set({ lastSyncError: `Directory refresh incomplete: fixture\n${SOURCE_PERMISSION_ERROR}` })
      .where(eq(knowledgeConnector.id, pausedDriveId))
    expect(await provider('google_drive')).toMatchObject({ status: 'active', issue: null })
  })

  it('counts configured sources independently of viewer ACLs, and excludes workspace and untouched providers', async () => {
    const result = await readOrganizationSearchOverview.execute({ principal, input })
    expect(result.providers).toEqual(
      expect.arrayContaining([
        {
          connectorType: 'google_drive',
          sourceCount: 2,
          approved: true,
          status: 'active',
          issue: null,
          isSyncing: false,
          hasPendingSync: false,
        },
      ])
    )
    expect(result.providers).toHaveLength(1)
    expect(JSON.stringify(result)).not.toMatch(/private-title|someone-else|fixture connection/i)
    const visible = await listSearchSources.execute({
      principal,
      input: { ...input, connectorType: 'google_drive' },
    })
    expect(visible.sources).toHaveLength(2)
    expect(visible.sources.every((source) => !source.hasViewerDocuments)).toBe(true)
  })
  it('keeps an explicit deactivation visible and ignores approvals for non-search connectors', async () => {
    await db.insert(organizationSearchIntegration).values([
      { organizationId: ids.organizationId, connectorType: 'google_drive', approved: false },
      { organizationId: ids.organizationId, connectorType: 'notion', approved: true },
    ])
    expect(await provider('google_drive')).toMatchObject({
      sourceCount: 2,
      approved: false,
      status: 'paused',
    })
    expect(await provider('notion')).toBeUndefined()
  })
  it('ignores intentional skips while reporting inaccessible source and indexing failures', async () => {
    await db
      .update(document)
      .set({ processingStatus: 'failed', contentHash: 'immutable-sha', fileUrl: '' })
      .where(eq(document.id, documentId))
    expect(await provider('google_drive')).toMatchObject({
      status: 'active',
      issue: null,
      isSyncing: false,
    })
    await db
      .update(knowledgeConnector)
      .set({ lastSyncError: 'previous sync failed' })
      .where(eq(knowledgeConnector.id, driveId))
    expect(await provider('google_drive')).toMatchObject({
      status: 'needs_attention',
      issue: 'sync_failed',
      isSyncing: false,
    })
    await db
      .update(knowledgeConnector)
      .set({ lastSyncError: null })
      .where(eq(knowledgeConnector.id, driveId))
    await db.update(document).set({ contentHash: null }).where(eq(document.id, documentId))
    expect(await provider('google_drive')).toMatchObject({
      status: 'needs_attention',
      issue: 'document_indexing_failed',
      isSyncing: false,
    })
    await db
      .update(document)
      .set({ contentHash: 'immutable-sha', storageKey: 'fixture-retained-artifact' })
      .where(eq(document.id, documentId))
    expect(await provider('google_drive')).toMatchObject({
      status: 'needs_attention',
      issue: 'document_indexing_failed',
      isSyncing: false,
    })
    await db.update(document).set({ userExcluded: true }).where(eq(document.id, documentId))
    expect(await provider('google_drive')).toMatchObject({ status: 'active' })
    await db
      .update(document)
      .set({ userExcluded: false, processingStatus: 'processing' })
      .where(eq(document.id, documentId))
    expect(await provider('google_drive')).toMatchObject({ status: 'indexing' })
    await db
      .update(knowledgeConnector)
      .set({ lastSyncError: 'previous sync failed' })
      .where(eq(knowledgeConnector.id, driveId))
    expect(await provider('google_drive')).toMatchObject({
      status: 'needs_attention',
      isSyncing: true,
    })
  })
  it('surfaces retained source errors, while pause and deactivation take precedence', async () => {
    await db
      .update(knowledgeConnector)
      .set({ lastSyncError: 'private-provider-error' })
      .where(eq(knowledgeConnector.id, driveId))
    expect(await provider('google_drive')).toMatchObject({ status: 'needs_attention' })
    await db
      .update(knowledgeConnector)
      .set({ status: 'paused' })
      .where(eq(knowledgeConnector.id, driveId))
    expect(await provider('google_drive')).toMatchObject({ status: 'paused' })
    await db.insert(organizationSearchIntegration).values({
      organizationId: ids.organizationId,
      connectorType: 'google_drive',
      approved: false,
    })
    expect(await provider('google_drive')).toMatchObject({
      approved: false,
      status: 'paused',
      isSyncing: false,
    })
  })
  it('requires a current organization admin even for a workspace administrator', async () => {
    await expect(
      readOrganizationSearchOverview.execute({
        principal: { ...principal, userId: ids.bobId },
        input,
      })
    ).rejects.toMatchObject({ code: 'forbidden' })
    await expect(
      readOrganizationSearchOverview.execute({ principal, input: { organizationId: generateId() } })
    ).rejects.toMatchObject({ code: 'not_found' })
  })
})
