import type { ProxyGroupView } from '@/types/proxy-view'

import delayManager from './delay'

export const resolveGroupTestUrl = (
  profileUid: string | null | undefined,
  group: Pick<ProxyGroupView, 'name' | 'testUrl'>,
  defaultUrl: string | null | undefined,
  savedState: string | null,
): string => {
  let customUrl: unknown
  try {
    customUrl = JSON.parse(savedState || '{}')?.[profileUid || '']?.[group.name]
      ?.testUrl
  } catch {
    // A corrupt local UI preference must not disable latency checks.
  }
  return (
    (typeof customUrl === 'string' && customUrl.trim()) ||
    group.testUrl?.trim() ||
    defaultUrl?.trim() ||
    'http://cp.cloudflare.com/generate_204'
  )
}

export const configureGroupTestUrl = (
  profileUid: string | null | undefined,
  group: Pick<ProxyGroupView, 'name' | 'testUrl'>,
  defaultUrl?: string | null,
) => {
  delayManager.setUrl(
    group.name,
    resolveGroupTestUrl(
      profileUid,
      group,
      defaultUrl,
      localStorage.getItem('proxy-head-state'),
    ),
  )
}
