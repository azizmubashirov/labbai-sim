import { createLogger } from '@sim/logger'
import { toError } from '@sim/utils/errors'
import { type NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/auth/internal'
import { isDataDrainsEnabled } from '@/lib/core/config/env-flags'
import { withRouteHandler } from '@/lib/core/utils/with-route-handler'
import { dispatchDueDrains } from '@/lib/data-drains/dispatcher'

const logger = createLogger('CronRunDataDrains')

export const GET = withRouteHandler(async (request: NextRequest) => {
  const authError = verifyCronAuth(request, 'Data drain dispatcher')
  if (authError) return authError

  // Opt-in: skip dispatch entirely when the deployment hasn't enabled drains.
  if (!isDataDrainsEnabled) {
    return NextResponse.json({ success: true, dispatched: 0, skipped: 'disabled' })
  }

  try {
    const result = await dispatchDueDrains()
    logger.info('Data drain dispatcher run complete', result)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    logger.error('Data drain dispatcher run failed', { error: toError(error).message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
