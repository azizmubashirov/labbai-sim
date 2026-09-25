import type { Principal, ScimConnectionPrincipal, ScimCredentialScope } from '@sim/auth/principal'
import {
  type ApplicationOperation,
  assertOperationCapability,
  type OperationUseCase,
} from '@/lib/core/application/operation'
import type { OrchestrationRequestContext } from '@/lib/core/orchestration/types'
import { ScimError } from '@/lib/labbai/scim/protocol/errors'

/**
 * Operations on the SCIM protocol surface. Their only principal is a
 * `scim_connection`, and their whole authorization story is the credential
 * scope each one declares: the connection itself is the tenant boundary.
 */
export interface ScimOperation<Id extends string = string> extends ApplicationOperation<Id> {
  readonly scope: ScimCredentialScope
}

function defineScimOperation<const Id extends string>(definition: {
  id: Id
  scope: ScimCredentialScope
}): ScimOperation<Id> {
  /**
   * permission-group-exempt: a SCIM connection is the identity provider, not a
   * member, so no permission group governs it; credential scopes do instead.
   */
  const operation: ScimOperation<Id> = { ...definition, capability: 'none' }
  assertOperationCapability(operation)
  return Object.freeze(operation)
}

export const scimOperations = {
  listUsers: defineScimOperation({ id: 'scim.users.list', scope: 'users:read' }),
  getUser: defineScimOperation({ id: 'scim.users.get', scope: 'users:read' }),
  provisionUser: defineScimOperation({ id: 'scim.users.provision', scope: 'users:write' }),
  replaceUser: defineScimOperation({ id: 'scim.users.replace', scope: 'users:write' }),
  patchUser: defineScimOperation({ id: 'scim.users.patch', scope: 'users:write' }),
  deprovisionUser: defineScimOperation({ id: 'scim.users.deprovision', scope: 'users:write' }),
  listGroups: defineScimOperation({ id: 'scim.groups.list', scope: 'groups:read' }),
  getGroup: defineScimOperation({ id: 'scim.groups.get', scope: 'groups:read' }),
  createGroup: defineScimOperation({ id: 'scim.groups.create', scope: 'groups:write' }),
  replaceGroup: defineScimOperation({ id: 'scim.groups.replace', scope: 'groups:write' }),
  patchGroup: defineScimOperation({ id: 'scim.groups.patch', scope: 'groups:write' }),
  deleteGroup: defineScimOperation({ id: 'scim.groups.delete', scope: 'groups:write' }),
} as const

/** What a SCIM use case body receives once the principal is admitted. */
export interface ScimUseCaseContext<I> {
  principal: ScimConnectionPrincipal
  input: I
  request?: OrchestrationRequestContext
}

/**
 * Wraps a SCIM use case body with the admission every SCIM operation shares:
 * the principal must be a SCIM connection and its credential must hold the
 * operation's scope.
 */
export function defineScimUseCase<O extends ScimOperation, I, R>(definition: {
  operation: O
  execute(context: ScimUseCaseContext<I>): Promise<R>
}): OperationUseCase<O, I, R> {
  return {
    operation: definition.operation,
    async execute(args: {
      principal: Principal
      input: I
      request?: OrchestrationRequestContext
    }): Promise<R> {
      const { principal } = args
      if (principal.kind !== 'scim_connection') {
        throw new Error(
          `Operation ${definition.operation.id} reached by principal kind ${principal.kind}`
        )
      }
      if (!principal.scopes.includes(definition.operation.scope)) {
        throw new ScimError(
          403,
          undefined,
          `This token does not grant the ${definition.operation.scope} scope`
        )
      }
      return definition.execute({ principal, input: args.input, request: args.request })
    },
  }
}
