'use client'

import { useQueryClient } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { ORGANIZATION_SETTINGS_GROUPS } from '@/components/settings/navigation'
import { SettingsSidebar } from '@/components/settings/settings-sidebar'
import { organizationRoutes, WORKSPACE_SETTINGS_PATH } from '@/lib/navigation/paths'
import { useOrganizationContext } from '@/app/o/[organizationId]/providers/organization-provider'
import {
  organizationSurfaceSettingsNavigation,
  resolveOrganizationSurfaceSection,
} from '@/app/o/[organizationId]/settings/navigation'
import { warmOrganizationSettingsSectionQuery } from '@/app/o/[organizationId]/settings/settings-query-warmers'

interface OrganizationSettingsSidebarProps {
  isCollapsed: boolean
  showCollapsedTooltips: boolean
}

export function OrganizationSettingsSidebar(props: OrganizationSettingsSidebarProps) {
  const { organization, viewer, connectedAccountsAvailable, searchAccess, settingsFeatures } =
    useOrganizationContext()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const isAdmin = viewer.isAdmin
  const features = settingsFeatures

  const routes = organizationRoutes(organization.id)

  return (
    <SettingsSidebar
      {...props}
      plane='organization'
      activeSection={resolveOrganizationSurfaceSection(pathname ?? '')?.section ?? 'general'}
      groups={ORGANIZATION_SETTINGS_GROUPS}
      items={organizationSurfaceSettingsNavigation(isAdmin, features, {
        connectedAccounts: connectedAccountsAvailable,
        search: searchAccess.memberScoped,
      })}
      hrefForSection={(section) => routes.settingsSection(section)}
      onSectionIntent={(section) =>
        warmOrganizationSettingsSectionQuery(
          queryClient,
          { organizationId: organization.id, isAdmin },
          section
        )
      }
      backHref={searchAccess.memberScoped ? routes.home : WORKSPACE_SETTINGS_PATH}
    />
  )
}
