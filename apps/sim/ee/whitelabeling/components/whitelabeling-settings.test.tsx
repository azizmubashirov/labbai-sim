/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseWhitelabelSettings } = vi.hoisted(() => ({
  mockUseWhitelabelSettings: vi.fn(),
}))

vi.mock('@/components/settings/save-discard-actions', () => ({
  saveDiscardActions: () => [],
}))
vi.mock('@/app/workspace/[workspaceId]/settings/components/settings-empty-state', () => ({
  SettingsEmptyState: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/app/workspace/[workspaceId]/settings/components/settings-panel', () => ({
  SettingsPanel: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}))
vi.mock(
  '@/app/workspace/[workspaceId]/settings/components/settings-section/settings-section',
  () => ({
    SettingsSection: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  })
)
vi.mock('@/app/workspace/[workspaceId]/settings/hooks/use-profile-picture-upload', () => ({
  useProfilePictureUpload: () => ({ isUploading: false, uploadProfilePicture: vi.fn() }),
}))
vi.mock('@/app/workspace/[workspaceId]/settings/hooks/use-settings-unsaved-guard', () => ({
  useSettingsUnsavedGuard: vi.fn(),
}))
vi.mock('@/ee/components/setting-row', () => ({
  SettingRow: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/ee/whitelabeling/hooks/whitelabel', () => ({
  useUpdateWhitelabelSettings: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useWhitelabelSettings: mockUseWhitelabelSettings,
}))
vi.mock('@/hooks/queries/workspace', () => ({
  useWorkspacesQuery: () => ({ data: [] }),
}))

import { WhitelabelingSettings } from '@/ee/whitelabeling/components/whitelabeling-settings'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('WhitelabelingSettings entitlement states', () => {
  it('shows a settings failure without any plan gate', () => {
    mockUseWhitelabelSettings.mockReturnValue({
      data: undefined,
      error: new Error('Whitelabel settings failed'),
      isLoading: false,
    })

    act(() => root.render(<WhitelabelingSettings organizationId='org-1' />))

    expect(container.textContent).toContain('Whitelabel settings failed')
    expect(container.textContent).not.toContain('Enterprise plans')
  })
})
