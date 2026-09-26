'use client'

import dynamic from 'next/dynamic'
import {
  getOrganizationSettingsHref,
  ORGANIZATION_SETTINGS_ITEMS,
  type OrganizationSettingsSection,
} from '@/components/settings/navigation'
import { SettingsSectionProvider } from '@/components/settings/settings-panel'
import { useOrganizationContext } from '@/app/o/[organizationId]/providers/organization-provider'

const OrganizationRecentlyDeleted = dynamic(() =>
  import('@/app/o/[organizationId]/settings/components/organization-recently-deleted').then(
    (m) => m.OrganizationRecentlyDeleted
  )
)

const OrganizationIntegrationsSettings = dynamic(() =>
  import(
    '@/app/o/[organizationId]/settings/components/integrations/organization-integrations-settings'
  ).then((m) => m.OrganizationIntegrationsSettings)
)
const OrganizationSearchMcp = dynamic(() =>
  import('@/app/o/[organizationId]/settings/components/organization-search-mcp').then(
    (m) => m.OrganizationSearchMcp
  )
)
const OrganizationConnectedAccounts = dynamic(() =>
  import('@/components/settings/credential-groups/organization-connected-accounts').then(
    (m) => m.OrganizationConnectedAccounts
  )
)

const TeamManagement = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/team-management/team-management').then(
    (m) => m.TeamManagement
  )
)
const AccessControl = dynamic(() =>
  import('@/components/settings/access-control/access-control').then((m) => m.AccessControl)
)
const AccessRequestsSettings = dynamic(() =>
  import('@/components/access-requests/access-requests-settings').then(
    (m) => m.AccessRequestsSettings
  )
)
const AuditLogs = dynamic(() =>
  import('@/components/settings/audit-logs/audit-logs').then((m) => m.AuditLogs)
)
const OrganizationSecuritySettings = dynamic(() =>
  import('@/components/settings/organization-security').then((m) => m.OrganizationSecuritySettings)
)

interface OrganizationSettingsProps {
  section: OrganizationSettingsSection
}

export function OrganizationSettings({ section }: OrganizationSettingsProps) {
  const { organization, viewer } = useOrganizationContext()
  const organizationId = organization.id
  const meta = ORGANIZATION_SETTINGS_ITEMS.find(({ id }) => id === section)

  return (
    <SettingsSectionProvider section={section} meta={meta}>
      {section === 'recently-deleted' && (
        <OrganizationRecentlyDeleted key={organizationId} organizationId={organizationId} />
      )}
      {section === 'integrations' && <OrganizationIntegrationsSettings />}
      {section === 'connected-accounts' && (
        <OrganizationConnectedAccounts organizationId={organizationId} />
      )}
      {section === 'search-mcp' && <OrganizationSearchMcp />}
      {section === 'members' && (
        <TeamManagement
          organizationId={organizationId}
          canInviteMembers={viewer.canInviteMembers}
        />
      )}
      {section === 'access-control' && (
        <AccessControl
          organizationId={organizationId}
          isOrganizationAdmin={viewer.isAdmin}
          requestsHref={getOrganizationSettingsHref(organizationId, 'requests')}
        />
      )}
      {section === 'requests' && (
        <AccessRequestsSettings
          scope={{ kind: 'organization', organizationId }}
          reviewOrganizationId={viewer.isAdmin ? organizationId : undefined}
        />
      )}
      {section === 'audit-logs' && <AuditLogs organizationId={organizationId} />}
      {section === 'security' && <OrganizationSecuritySettings organizationId={organizationId} />}
    </SettingsSectionProvider>
  )
}
