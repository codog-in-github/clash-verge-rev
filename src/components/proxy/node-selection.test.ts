import { expect, test } from 'vitest'

import type { ProxyMemberRef } from '@/types/proxy-view'

import { canSelectGroupMember } from './node-selection'

const node = (recordId: string): ProxyMemberRef => ({
  kind: 'node',
  name: 'Hong Kong',
  recordId,
})

test('does not select a same-name member when the core name API cannot identify its source', () => {
  const members = [node('provider-a'), node('provider-b')]
  expect(canSelectGroupMember({ type: 'Selector', members }, members[0])).toBe(
    false,
  )
})

test('allows repeated occurrences of one record but rejects unsupported group types', () => {
  const member = node('provider-a')
  for (const type of ['Selector', 'URLTest', 'Fallback']) {
    expect(
      canSelectGroupMember({ type, members: [member, member] }, member),
    ).toBe(true)
  }
  expect(
    canSelectGroupMember({ type: 'LoadBalance', members: [member] }, member),
  ).toBe(false)
})

test('rejects unresolved and no-longer-present members', () => {
  const member: ProxyMemberRef = {
    kind: 'unresolved',
    name: 'Hong Kong',
    reason: 'ambiguous',
  }
  expect(
    canSelectGroupMember({ type: 'Selector', members: [member] }, member),
  ).toBe(false)
  expect(
    canSelectGroupMember(
      { type: 'Selector', members: [node('provider-b')] },
      node('provider-a'),
    ),
  ).toBe(false)
})
