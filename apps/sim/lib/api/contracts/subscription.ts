import { z } from 'zod'
import { defineRouteContract } from '@/lib/api/contracts/types'
import { INTERNAL_CHAT_BILLING_SOURCES } from '@/lib/billing/usage-sources'
import {
  BILLING_ACCOUNT_DECISION_HEADER,
  BILLING_ACCOUNT_DECISION_HEADER_MAX_BYTES,
  BILLING_ATTRIBUTION_HEADER,
  BILLING_ATTRIBUTION_HEADER_MAX_BYTES,
  BILLING_REQUEST_ID_HEADER,
  COPILOT_BILLING_PROTOCOL_HEADER,
  COPILOT_BILLING_PROTOCOL_VALUES,
} from '@/lib/copilot/generated/billing-protocol-v1'

export const billingUpdateCostBodySchema = z
  .object({
    userId: z.string().min(1, 'User ID is required'),
    cost: z.number().min(0, 'Cost must be a non-negative number'),
    model: z.string().min(1, 'Model is required'),
    inputTokens: z.number().min(0).default(0),
    outputTokens: z.number().min(0).default(0),
    source: z.enum(INTERNAL_CHAT_BILLING_SOURCES).default('copilot'),
    idempotencyKey: z.string().min(1, 'Idempotency key is required'),
    /**
     * Originating workspace, used for org-workspace cost attribution on hosted
     * Sim. The value remains optional because self-hosted/headless callers may
     * supply an ID from another deployment or omit it. Modern protocols bind a
     * locally known workspace to their immutable envelope. Markerless local
     * self-hosted callbacks re-resolve current workspace payer state; unknown
     * workspaces remain account-only.
     */
    workspaceId: z.string().min(1).optional(),
    organizationId: z.string().min(1).max(200).optional(),
  })
  .refine((body) => !(body.workspaceId && body.organizationId), {
    message: 'workspaceId and organizationId are mutually exclusive',
  })
export type BillingUpdateCostBody = z.input<typeof billingUpdateCostBodySchema>

export const billingUpdateCostHeadersSchema = z.object({
  [COPILOT_BILLING_PROTOCOL_HEADER]: z.enum(COPILOT_BILLING_PROTOCOL_VALUES).optional(),
  [BILLING_REQUEST_ID_HEADER]: z.string().uuid().optional(),
  [BILLING_ATTRIBUTION_HEADER]: z.string().max(BILLING_ATTRIBUTION_HEADER_MAX_BYTES).optional(),
  [BILLING_ACCOUNT_DECISION_HEADER]: z
    .string()
    .max(BILLING_ACCOUNT_DECISION_HEADER_MAX_BYTES)
    .optional(),
})
export type BillingUpdateCostHeaders = z.input<typeof billingUpdateCostHeadersSchema>

export const billingUpdateCostResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({
    userId: z.string().optional(),
    cost: z.number().optional(),
    processedAt: z.string(),
    requestId: z.string(),
  }),
})

export const billingUpdateCostContract = defineRouteContract({
  method: 'POST',
  path: '/api/billing/update-cost',
  headers: billingUpdateCostHeadersSchema,
  body: billingUpdateCostBodySchema,
  response: {
    mode: 'json',
    schema: billingUpdateCostResponseSchema,
  },
})
