'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { usePostHog } from 'posthog-js/react'
import { getSettingsPermissionConfigKey } from '@/components/settings/navigation'
import { useSession } from '@/lib/auth/auth-client'
import { captureEvent } from '@/lib/posthog/client'
import { useWorkspaceHostContext } from '@/app/workspace/[workspaceId]/providers/workspace-host-provider'
import { General } from '@/app/workspace/[workspaceId]/settings/components/general/general'
import { SettingsSectionProvider } from '@/app/workspace/[workspaceId]/settings/components/settings-panel'
import {
  getSettingsSectionMeta,
  type SettingsSection,
} from '@/app/workspace/[workspaceId]/settings/navigation'
import { PermissionAccessBoundary } from '@/ee/access-requests/components/permission-access-boundary'

const Admin = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/admin/admin').then((m) => m.Admin)
)
const ApiKeys = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/api-keys/api-keys').then(
    (m) => m.ApiKeys
  )
)
const Forks = dynamic(() => import('@/ee/workspace-forking/components/forks').then((m) => m.Forks))
const Secrets = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/secrets/secrets').then((m) => m.Secrets)
)
const OrganizationConnectedAccounts = dynamic(() =>
  import('@/ee/credential-groups/components/organization-connected-accounts').then(
    (m) => m.OrganizationConnectedAccounts
  )
)
const CustomTools = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/custom-tools/custom-tools').then(
    (m) => m.CustomTools
  )
)
const MCP = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/mcp/mcp').then((m) => m.MCP)
)
const RecentlyDeleted = dynamic(() =>
  import(
    '@/app/workspace/[workspaceId]/settings/components/recently-deleted/recently-deleted'
  ).then((m) => m.RecentlyDeleted)
)
const Teammates = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/teammates/teammates').then(
    (m) => m.Teammates
  )
)
const TeamManagement = dynamic(() =>
  import('@/app/workspace/[workspaceId]/settings/components/team-management/team-management').then(
    (m) => m.TeamManagement
  )
)
const WorkflowMcpServers = dynamic(() =>
  import(
    '@/app/workspace/[workspaceId]/settings/components/workflow-mcp-servers/workflow-mcp-servers'
  ).then((m) => m.WorkflowMcpServers)
)
const AccessControl = dynamic(() =>
  import('@/ee/access-control/components/access-control').then((m) => m.AccessControl)
)
const AccessRequestsSettings = dynamic(() =>
  import('@/ee/access-requests/components/access-requests-settings').then(
    (m) => m.AccessRequestsSettings
  )
)
const CustomBlocks = dynamic(() =>
  import('@/ee/custom-blocks/components/custom-blocks').then((m) => m.CustomBlocks)
)
const AuditLogs = dynamic(() =>
  import('@/ee/audit-logs/components/audit-logs').then((m) => m.AuditLogs)
)
const SSO = dynamic(() => import('@/ee/sso/components/sso-settings').then((m) => m.SSO))
const DataRetentionSettings = dynamic(() =>
  import('@/ee/data-retention/components/data-retention-settings').then(
    (m) => m.DataRetentionSettings
  )
)
const DataDrainsSettings = dynamic(() =>
  import('@/ee/data-drains/components/data-drains-settings').then((m) => m.DataDrainsSettings)
)
const OrganizationSecuritySettings = dynamic(() =>
  import('@/components/settings/organization-security').then((m) => m.OrganizationSecuritySettings)
)
const UsageMonitoring = dynamic(() =>
  import('@/ee/organization-usage/components/usage-monitoring').then((m) => m.UsageMonitoring)
)
const WhitelabelingSettings = dynamic(() =>
  import('@/ee/whitelabeling/components/whitelabeling-settings').then(
    (m) => m.WhitelabelingSettings
  )
)

interface SettingsPageProps {
  section: SettingsSection
}

export function SettingsPage(props: SettingsPageProps) {
  const configKey = getSettingsPermissionConfigKey(props.section)
  if (!configKey) return <SettingsPageContent {...props} />
  return (
    <PermissionAccessBoundary configKey={configKey}>
      <SettingsPageContent {...props} />
    </PermissionAccessBoundary>
  )
}

function SettingsPageContent({ section }: SettingsPageProps) {
  const { data: session, isPending: sessionLoading } = useSession()
  const hostContext = useWorkspaceHostContext()
  const posthog = usePostHog()

  const isAdminRole = session?.user?.role === 'admin'
  const effectiveSection: SettingsSection =
    section === 'admin' && !sessionLoading && !isAdminRole ? 'general' : section
  const organizationId = hostContext.hostOrganizationId
  const meta = getSettingsSectionMeta(effectiveSection)

  useEffect(() => {
    if (sessionLoading) return
    captureEvent(posthog, 'settings_tab_viewed', {
      plane: 'workspace',
      section: effectiveSection,
    })
  }, [effectiveSection, sessionLoading, posthog])

  return (
    <SettingsSectionProvider section={effectiveSection} meta={meta ?? undefined}>
      {effectiveSection === 'general' && <General />}
      {effectiveSection === 'secrets' && <Secrets />}
      {effectiveSection === 'connected-accounts' && organizationId && (
        <OrganizationConnectedAccounts organizationId={organizationId} />
      )}
      {effectiveSection === 'access-control' && organizationId && (
        <AccessControl
          organizationId={organizationId}
          isOrganizationAdmin={hostContext.viewer.isHostOrganizationAdmin}
          requestsHref={`/workspace/${hostContext.workspace.id}/settings/requests`}
        />
      )}
      {effectiveSection === 'requests' && organizationId && (
        <AccessRequestsSettings
          scope={{ kind: 'workspace', workspaceId: hostContext.workspace.id }}
          reviewOrganizationId={
            hostContext.viewer.isHostOrganizationAdmin ? organizationId : undefined
          }
        />
      )}
      {effectiveSection === 'custom-blocks' && <CustomBlocks />}
      {effectiveSection === 'audit-logs' && organizationId && (
        <AuditLogs organizationId={organizationId} />
      )}
      {effectiveSection === 'usage' && organizationId && (
        <UsageMonitoring
          organizationId={organizationId}
          eventsHref={`/workspace/${hostContext.workspace.id}/settings/usage/events`}
          auditLogsHref={`/workspace/${hostContext.workspace.id}/settings/audit-logs`}
        />
      )}
      {effectiveSection === 'apikeys' && <ApiKeys scope='combined' />}
      {effectiveSection === 'teammates' && <Teammates />}
      {effectiveSection === 'organization' && organizationId && (
        <TeamManagement organizationId={organizationId} />
      )}
      {effectiveSection === 'sso' && organizationId && <SSO organizationId={organizationId} />}
      {effectiveSection === 'data-retention' && organizationId && (
        <DataRetentionSettings organizationId={organizationId} />
      )}
      {effectiveSection === 'data-drains' && organizationId && (
        <DataDrainsSettings organizationId={organizationId} />
      )}
      {effectiveSection === 'security' && organizationId && (
        <OrganizationSecuritySettings organizationId={organizationId} />
      )}
      {effectiveSection === 'whitelabeling' && organizationId && (
        <WhitelabelingSettings organizationId={organizationId} />
      )}
      {effectiveSection === 'mcp' && <MCP />}
      {effectiveSection === 'forks' && <Forks />}
      {effectiveSection === 'custom-tools' && <CustomTools />}
      {effectiveSection === 'workflow-mcp-servers' && <WorkflowMcpServers />}
      {effectiveSection === 'recently-deleted' && <RecentlyDeleted />}
      {effectiveSection === 'admin' && <Admin />}
    </SettingsSectionProvider>
  )
}
