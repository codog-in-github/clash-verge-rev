import { dump, load } from 'js-yaml'
import isIP from 'validator/es/lib/isIP'

import { normalizeHost } from '@/utils/network'

export const exactHostRule = (host: string, target: string): string | null => {
  const normalized = normalizeHost(host)
  if (!normalized || isIP(normalized) || !target || /[,\r\n]/u.test(target))
    return null
  return `DOMAIN,${normalized},${target}`
}

export const prependHostRule = (source: string, rule: string): string => {
  const document: unknown = load(source)
  if (
    document !== null &&
    document !== undefined &&
    (typeof document !== 'object' || Array.isArray(document))
  ) {
    throw new Error('Rule extension must be a YAML mapping')
  }
  const config = (document ?? {}) as Record<string, unknown>
  const prepend = config.prepend ?? []
  if (
    !Array.isArray(prepend) ||
    prepend.some((item) => typeof item !== 'string')
  ) {
    throw new Error('Rule extension prepend must be a list of rules')
  }
  const prefix = rule.slice(0, rule.lastIndexOf(',') + 1)
  return dump(
    {
      ...config,
      prepend: [
        rule,
        ...prepend.filter((item: string) => !item.startsWith(prefix)),
      ],
    },
    { lineWidth: -1, noRefs: true },
  )
}
