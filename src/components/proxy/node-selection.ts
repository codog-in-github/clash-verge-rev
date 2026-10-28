import type { ProxyGroupView, ProxyMemberRef } from '@/types/proxy-view'

export const isUnambiguousGroupMember = (
  group: Pick<ProxyGroupView, 'members'>,
  member: ProxyMemberRef,
) => {
  if (member.kind === 'unresolved') return false
  const matches = group.members.filter(
    (candidate) => candidate.name === member.name,
  )
  // Mihomo selects by name, so different records with that name cannot be targeted separately.
  return (
    matches.length > 0 &&
    matches.every(
      (candidate) =>
        candidate.kind === member.kind &&
        (candidate.kind !== 'node' ||
          (member.kind === 'node' && candidate.recordId === member.recordId)),
    )
  )
}

export const canSelectGroupMember = (
  group: Pick<ProxyGroupView, 'type' | 'members'>,
  member: ProxyMemberRef,
) =>
  ['Selector', 'URLTest', 'Fallback'].includes(group.type) &&
  isUnambiguousGroupMember(group, member)
