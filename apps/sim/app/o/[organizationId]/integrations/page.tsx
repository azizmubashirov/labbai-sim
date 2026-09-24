import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import {
  searchConnectionPath,
  searchConnectionTargetSchema,
} from '@/lib/knowledge/search/connection-target'
import { organizationRoutes } from '@/lib/navigation/paths'
import { getOrganizationSurfaceContext } from '@/lib/organizations/surface'
import { SEARCH_CONNECTORS } from '@/lib/sim-search/connectors'
import { buildAuthCrossLink } from '@/app/(auth)/auth-redirect'
import { OrganizationIntegrations } from '@/app/o/[organizationId]/integrations/integrations'
import { loadIntegrationConnectionParams } from '@/app/o/[organizationId]/integrations/search-params'

export const metadata: Metadata = {
  title: 'Integrations',
  referrer: 'no-referrer',
}

interface OrganizationIntegrationsPageProps {
  params: Promise<{ organizationId: string }>
  searchParams: Promise<{
    connectorType?: string | string[]
    connectorId?: string | string[]
    credentialId?: string | string[]
  }>
}

export default async function OrganizationIntegrationsPage({
  params,
  searchParams,
}: OrganizationIntegrationsPageProps) {
  const { organizationId } = await params
  const query = await searchParams
  const selection = loadIntegrationConnectionParams(query)
  const connector = SEARCH_CONNECTORS.find((entry) => entry.type === selection.connectorType)
  const requested =
    selection.connectorType || selection.connectorId || selection.credentialId
      ? searchConnectionTargetSchema.safeParse({
          type: 'link',
          provider: connector?.providerId,
          connectorType: selection.connectorType,
          ...(selection.connectorId ? { connectorId: selection.connectorId } : {}),
          ...(selection.credentialId ? { credentialId: selection.credentialId } : {}),
        })
      : undefined
  if (requested && !requested.success) notFound()
  const connectionTarget = requested?.data
  const session = await getSession()
  if (!session?.user)
    redirect(
      buildAuthCrossLink('/login', {
        callbackUrl: connectionTarget
          ? searchConnectionPath(organizationId, connectionTarget)
          : organizationRoutes(organizationId).integrations,
        isInviteFlow: false,
      })
    )
  const organizationContext = await getOrganizationSurfaceContext(organizationId, session.user.id)
  if (!organizationContext?.searchAccess.memberScoped) notFound()
  return (
    <OrganizationIntegrations
      connectionRequest={
        connectionTarget ? { target: connectionTarget, userId: session.user.id } : undefined
      }
    />
  )
}
