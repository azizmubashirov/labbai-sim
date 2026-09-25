import { defineOrganizationOperation } from '@/lib/core/application/organization-operation'

/**
 * Settings-surface operations for an organization's SCIM connection. Only an
 * organization admin (or owner) may configure provisioning, issue tokens, or
 * change what directory groups mean.
 */

function adminOperation<const Id extends string>(id: Id) {
  /**
   * permission-group-exempt: directory provisioning is configured by
   * organization administrators; the admin role is the whole gate.
   */
  return defineOrganizationOperation({
    id,
    minimumRole: 'admin',
    capability: 'none',
    principalKinds: ['session'],
  })
}

export const scimAdminOperations = {
  getConnection: adminOperation('scim_admin.connection.get'),
  configureConnection: adminOperation('scim_admin.connection.configure'),
  listActivity: adminOperation('scim_admin.activity.list'),
  reconcile: adminOperation('scim_admin.connection.reconcile'),
  issueCredential: adminOperation('scim_admin.credentials.issue'),
  revokeCredential: adminOperation('scim_admin.credentials.revoke'),
  listMappings: adminOperation('scim_admin.mappings.list'),
  upsertMapping: adminOperation('scim_admin.mappings.upsert'),
  deleteMapping: adminOperation('scim_admin.mappings.delete'),
} as const
