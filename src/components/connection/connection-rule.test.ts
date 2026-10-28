import { load } from 'js-yaml'
import { expect, test } from 'vitest'

import { exactHostRule, prependHostRule } from './connection-rule'

test('uses only the exact hostname, without guessing a registrable domain', () => {
  expect(exactHostRule('api.example.co.uk', 'Proxy')).toBe(
    'DOMAIN,api.example.co.uk,Proxy',
  )
  expect(exactHostRule('192.0.2.1', 'DIRECT')).toBeNull()
  expect(exactHostRule('example.com,REJECT', 'Proxy')).toBeNull()
  expect(exactHostRule('example.com', 'Proxy,REJECT')).toBeNull()
})

test('preserves other sequence fields while replacing the exact-host override', () => {
  const result = load(
    prependHostRule(
      'prepend: ["DOMAIN,example.com,DIRECT", "DOMAIN,other.com,Proxy"]\nappend: ["MATCH,Proxy"]\ndelete: ["GEOIP,CN,DIRECT"]\n',
      'DOMAIN,example.com,REJECT',
    ),
  )
  expect(result).toEqual({
    prepend: ['DOMAIN,example.com,REJECT', 'DOMAIN,other.com,Proxy'],
    append: ['MATCH,Proxy'],
    delete: ['GEOIP,CN,DIRECT'],
  })
})

test('does not overwrite malformed rule extension data', () => {
  expect(() =>
    prependHostRule('prepend: wrong', 'DOMAIN,example.com,DIRECT'),
  ).toThrow()
  expect(() => prependHostRule('- a', 'DOMAIN,example.com,DIRECT')).toThrow()
})
