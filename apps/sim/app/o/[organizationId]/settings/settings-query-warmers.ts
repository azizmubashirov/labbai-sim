import type { QueryClient } from '@tanstack/react-query'
import type {
  AccountSettingsSection,
  OrganizationSettingsSection,
} from '@/components/settings/navigation'
import {
  organizationDetailQueryOptions,
  organizationRosterQueryOptions,
} from '@/hooks/queries/organization'
import { prefetchQueryOnIntent } from '@/hooks/queries/utils/prefetch-query-on-intent'

interface OrganizationSettingsQueryWarmContext {
  organizationId: string
  isAdmin: boolean
}

/** Warms the selected panel's existing cache entries without mounting hidden query observers. */
export function warmOrganizationSettingsSectionQuery(
  queryClient: QueryClient,
  { organizationId }: OrganizationSettingsQueryWarmContext,
  section: AccountSettingsSection | OrganizationSettingsSection
): void {
  if (!organizationId) return

  if (section === 'members') {
    prefetchQueryOnIntent(queryClient, organizationDetailQueryOptions(organizationId))
    prefetchQueryOnIntent(queryClient, organizationRosterQueryOptions(organizationId))
  }
}
