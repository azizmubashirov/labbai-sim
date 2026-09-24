import { db } from '@sim/db'
import type { DataRetentionSettings } from '@sim/db/schema'
import { workspace } from '@sim/db/schema'
import { and, eq, inArray } from 'drizzle-orm'

export type RetentionHoursKey =
  | 'logRetentionHours'
  | 'softDeleteRetentionHours'
  | 'taskCleanupHours'
  | 'fileVersionRetentionHours'

/**
 * Resolve the effective retention hours for one workspace and job type. A
 * workspace override wins when it sets the field (a number, or `null` for
 * forever); an omitted field inherits the org-level value. Returns `null` when
 * nothing is configured (the dispatcher treats `null` as "skip").
 */
export function resolveEffectiveRetentionHours(params: {
  orgSettings: DataRetentionSettings | null | undefined
  workspaceId: string
  key: RetentionHoursKey
}): number | null {
  const override = params.orgSettings?.retentionOverrides?.find(
    (o) => o?.workspaceId === params.workspaceId
  )
  const overrideValue = override?.[params.key]
  if (overrideValue !== undefined) return overrideValue
  return params.orgSettings?.[params.key] ?? null
}

/**
 * Rejects retention settings that point at workspaces the organization does not
 * own. Returns `null` when every referenced workspace belongs to it.
 *
 * `retentionOverrides` name a workspace but are not a foreign key — an id that
 * belongs to another organization would persist silently and then be applied by
 * `resolveEffectiveRetentionHours` to whatever workspace later matched it. Shared so the settings API and the Admin API
 * cannot accept different data for the same organization.
 */
export async function getForeignWorkspaceTargetsReason(params: {
  organizationId: string
  retentionOverrides?: Array<{ workspaceId: string }> | null
}): Promise<string | null> {
  const targeted = new Set<string>()
  for (const override of params.retentionOverrides ?? []) {
    if (override?.workspaceId) targeted.add(override.workspaceId)
  }
  if (targeted.size === 0) return null

  const ids = [...targeted]
  const owned = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(and(eq(workspace.organizationId, params.organizationId), inArray(workspace.id, ids)))

  const known = new Set(owned.map((row) => row.id))
  const unknown = ids.filter((id) => !known.has(id))

  return unknown.length > 0
    ? `Override targets workspaces outside this organization: ${unknown.join(', ')}`
    : null
}
