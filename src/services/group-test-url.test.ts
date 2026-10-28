import { expect, test } from 'vitest'

import { resolveGroupTestUrl } from './group-test-url'

test('keeps the saved per-profile override ahead of the subscription URL', () => {
  const saved = JSON.stringify({
    active: { Proxy: { testUrl: ' https://custom.test/204 ' } },
    other: { Proxy: { testUrl: 'https://other.test' } },
  })
  expect(
    resolveGroupTestUrl(
      'active',
      { name: 'Proxy', testUrl: 'https://subscription.test' },
      'https://default.test',
      saved,
    ),
  ).toBe('https://custom.test/204')
})

test('uses the subscription URL before the global default for another profile', () => {
  expect(
    resolveGroupTestUrl(
      'new',
      { name: 'Proxy', testUrl: 'https://subscription.test' },
      'https://default.test',
      '{}',
    ),
  ).toBe('https://subscription.test')
})

test('retains the global default when local storage is empty or malformed', () => {
  for (const saved of [null, '{broken']) {
    expect(
      resolveGroupTestUrl(
        'active',
        { name: 'Proxy' },
        ' https://default.test/204 ',
        saved,
      ),
    ).toBe('https://default.test/204')
  }
})
