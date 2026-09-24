'use client'

import type { SearchConnectionTarget } from '@/lib/knowledge/search/connection-target'
import { SEARCH_DEBOUNCE_MS } from '@/lib/url-state'
import { OrganizationPage } from '@/app/o/[organizationId]/components/organization-page'
import { useOrganizationPageFilters } from '@/app/o/[organizationId]/components/organization-page/use-organization-page-filters'
import { MemberIntegrationsList } from '@/app/o/[organizationId]/integrations/member-integrations-list'
import { useOrganizationContext } from '@/app/o/[organizationId]/providers/organization-provider'
import { SearchIntegrationConnection } from '@/app/workspace/[workspaceId]/home/components/message-content/components/special-tags/search-integration-connection'
import { useDebounce } from '@/hooks/use-debounce'
import { useOAuthReturnRouter } from '@/hooks/use-oauth-return'

interface OrganizationIntegrationsProps {
  connectionRequest?: { target: SearchConnectionTarget; userId: string }
}

export function OrganizationIntegrations({
  connectionRequest,
}: OrganizationIntegrationsProps = {}) {
  useOAuthReturnRouter()
  const { organization } = useOrganizationContext()
  const { search } = useOrganizationPageFilters()
  const sourceSearch = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS)

  return (
    <OrganizationPage
      title='Integrations'
      description='Connect your accounts for Sim Search'
      searchMode='expanded'
      searchPlaceholder='Search integrations'
    >
      {connectionRequest && (
        <SearchIntegrationConnection
          organizationId={organization.id}
          {...connectionRequest}
          controlId='integrations-link'
        />
      )}
      <MemberIntegrationsList search={sourceSearch} />
    </OrganizationPage>
  )
}
