import {
  ArrowForwardRounded,
  BoltRounded,
  CheckRounded,
  SearchRounded,
} from '@mui/icons-material'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  Typography,
} from '@mui/material'
import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { isUnambiguousGroupMember } from '@/components/proxy/node-selection'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { patchClashMode, updateProfile } from '@/services/cmds'
import delayManager from '@/services/delay'
import { configureGroupTestUrl } from '@/services/group-test-url'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { requestService } from '@/services/service-request'
import {
  isInteractableMember,
  memberDetails,
  providerNameOf,
  resolveMember,
  type InteractableProxyMember,
  type ProxyGroupView,
} from '@/types/proxy-view'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface Command {
  id: string
  label: string
  section: string
  detail?: string
  keywords?: string
  selected?: boolean
  run?: () => void | boolean | Promise<void | boolean>
  node?: { group: ProxyGroupView; member: InteractableProxyMember }
}

const PaletteContent = ({
  onClose,
  inputRef,
}: {
  onClose: () => void
  inputRef: RefObject<HTMLInputElement | null>
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profiles, patchProfiles, mutateProfiles } = useProfiles()
  const { proxyView } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const { refreshProxy, refreshClashConfig, refreshAll } = useAppRefreshers()
  const { verge, patchVerge } = useVerge()
  const { indicator, toggleSystemProxy } = useSystemProxyState()
  const { runState, isTunModeAvailable, isLoading } = useSystemState()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [measurement, setMeasurement] = useState<{ id: string; text: string }>()
  const busyRef = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const release = () => {
    busyRef.current = false
    setBusy(false)
  }
  const { changeProxy } = useProxySelection({
    onSuccess: () => {
      void refreshProxy()
      release()
      onClose()
    },
    onError: (error) => {
      release()
      showNotice.error(error)
    },
  })

  const actions = t('redesign.palette.actions', { defaultValue: '操作' })
  const nodes = t('redesign.nodes', { defaultValue: '节点' })
  const subscription = t('profiles.page.title')
  const commands: Command[] = [
    ...(['rule', 'global', 'direct'] as const).map((mode) => ({
      id: `mode:${mode}`,
      section: actions,
      label: t('redesign.palette.switchMode', {
        defaultValue: '切换到 {{mode}}模式',
        mode: t(`home.components.clashMode.labels.${mode}`),
      }),
      keywords: `mode ${mode}`,
      selected: clashConfig?.mode?.toLowerCase() === mode,
      run: async () => {
        const result = await mutate(() => patchClashMode(mode), {
          id: 'patch-clash-mode',
          errorNotice: false,
        })
        if (!result.ok) return false
        await refreshClashConfig()
      },
    })),
    {
      id: 'system-proxy',
      section: actions,
      label: t('redesign.palette.toggleSystemProxy', {
        defaultValue: '切换系统代理',
      }),
      keywords: 'system proxy',
      selected: indicator,
      run: async () => {
        if (!indicator && (isLoading || runState.mode === 'NotRunning')) {
          showNotice.error('settings.feedback.errors.sysproxy.coreNotReady')
          return false
        }
        await toggleSystemProxy(!indicator)
      },
    },
    {
      id: 'tun',
      section: actions,
      label: t('redesign.palette.toggleTun', {
        defaultValue: '切换 TUN 虚拟网卡',
      }),
      keywords: 'tun',
      selected: verge?.enable_tun_mode === true,
      run: async () => {
        const enabled = !verge?.enable_tun_mode
        if (enabled && !isTunModeAvailable) {
          requestService({
            reason: 'tunNeedsService',
            restore: { enable_tun_mode: true },
          })
          return
        }
        await patchVerge({ enable_tun_mode: enabled })
      },
    },
    {
      id: 'update-profiles',
      section: actions,
      label: t('redesign.palette.updateProfiles', {
        defaultValue: '更新所有订阅',
      }),
      keywords: 'update profiles subscriptions',
      run: async () => {
        try {
          for (const profile of profiles?.items ?? []) {
            if (profile.type !== 'remote' || !profile.uid) continue
            const result = await mutate(() => updateProfile(profile.uid!), {
              id: `update-profile:${profile.uid}`,
              errorNotice: false,
            })
            if (!result.ok) return false
          }
        } finally {
          await mutateProfiles()
        }
      },
    },
  ]

  for (const profile of profiles?.items ?? []) {
    if (!profile.uid || !['remote', 'local'].includes(profile.type ?? ''))
      continue
    commands.push({
      id: `profile:${profile.uid}`,
      section: subscription,
      label: profile.name ?? profile.uid,
      keywords: 'profile subscription 订阅',
      selected: profiles?.current === profile.uid,
      run: async () => {
        const outcome = await patchProfiles({ current: profile.uid! })
        if (outcome.status !== 'valid') {
          if (outcome.status === 'busy') {
            showNotice.info('profiles.page.feedback.notifications.switchBusy')
          }
          return false
        }
        await refreshAll()
      },
    })
  }

  if (proxyView) {
    const groups = [...proxyView.groups]
    if (
      proxyView.global &&
      !groups.some((group) => group.name === proxyView.global?.name)
    ) {
      groups.unshift(proxyView.global)
    }
    for (const group of groups) {
      commands.push({
        id: `group:${group.name}`,
        section: t('redesign.palette.groups', { defaultValue: '策略组' }),
        label: group.name,
        detail: group.type,
        keywords: 'group 策略组',
        run: () => navigate(`/proxies?group=${encodeURIComponent(group.name)}`),
      })
      if (!['Selector', 'URLTest', 'Fallback'].includes(group.type)) continue
      for (const [index, ref] of group.members.entries()) {
        const member = resolveMember(proxyView, ref)
        if (
          !isInteractableMember(member) ||
          !isUnambiguousGroupMember(group, ref)
        )
          continue
        const provider =
          member.kind === 'node' ? providerNameOf(member.node) : undefined
        commands.push({
          id: `node:${group.name}:${index}`,
          section: nodes,
          label: member.ref.name,
          detail: [group.name, provider, memberDetails(member)?.type]
            .filter(Boolean)
            .join(' · '),
          keywords: 'node proxy 节点',
          selected: group.now === member.ref.name,
          node: { group, member },
        })
      }
    }
  }

  const pages = [
    ['/', t('redesign.connection', { defaultValue: '连接' })],
    ['/proxies', nodes],
    ['/activity', t('redesign.activity', { defaultValue: '活动' })],
    ['/profile', subscription],
    ['/settings', t('layout.components.navigation.tabs.settings')],
    ['/unlock', t('layout.components.navigation.tabs.unlock')],
  ]
  for (const [path, label] of pages) {
    commands.push({
      id: `page:${path}`,
      label,
      section: t('redesign.palette.navigation', { defaultValue: '页面' }),
      keywords: `page navigation ${path}`,
      run: () => navigate(path),
    })
  }

  const terms = query.trim().toLocaleLowerCase().split(/\s+/)
  const filtered = commands.filter((command) => {
    const text = [
      command.label,
      command.section,
      command.detail,
      command.keywords,
    ]
      .join(' ')
      .toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
  const matches = filtered.slice(0, 100)
  const activeIndex = Math.min(selectedIndex, Math.max(0, matches.length - 1))
  const active = matches[activeIndex]

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, query])

  const execute = async (command: Command) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    if (command.node) {
      const { group, member } = command.node
      configureGroupTestUrl(
        profiles?.current,
        group,
        verge?.default_latency_test,
      )
      changeProxy(
        group.name,
        member.ref.name,
        group.now ?? undefined,
        group.fixed ?? undefined,
      )
      return
    }
    try {
      if ((await command.run?.()) !== false) onClose()
    } catch (error) {
      showNotice.error(error)
    } finally {
      release()
    }
  }

  const testNode = async (command: Command) => {
    if (!command.node || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const { group, member } = command.node
      configureGroupTestUrl(
        profiles?.current,
        group,
        verge?.default_latency_test,
      )
      const timeout = verge?.default_latency_timeout || 10000
      await delayManager.checkDelay(member, group.name, timeout)
      setMeasurement({
        id: command.id,
        text: delayManager.formatDelay(
          delayManager.getDelayFix(member, group.name),
          timeout,
        ),
      })
    } catch (error) {
      showNotice.error(error)
    } finally {
      release()
    }
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.25,
          minHeight: 64,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <SearchRounded sx={{ color: 'text.secondary', fontSize: 20 }} />
        <Box
          component="input"
          ref={inputRef}
          role="combobox"
          aria-label={t('redesign.palette.search', {
            defaultValue: '搜索节点、命令或订阅',
          })}
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-activedescendant={
            active ? `${listId}-${activeIndex}` : undefined
          }
          value={query}
          placeholder={t('redesign.palette.placeholder', {
            defaultValue: '切换节点、模式、订阅，或执行命令…',
          })}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const step = event.key === 'ArrowDown' ? 1 : -1
              setSelectedIndex(
                matches.length
                  ? (activeIndex + step + matches.length) % matches.length
                  : 0,
              )
            } else if (event.key === 'Enter' && active) {
              event.preventDefault()
              void execute(active)
            } else if (event.key === 'Tab' && !event.shiftKey && active?.node) {
              event.preventDefault()
              void testNode(active)
            }
          }}
          sx={{
            width: '100%',
            minWidth: 0,
            color: 'text.primary',
            bgcolor: 'transparent',
            border: 0,
            font: 'inherit',
            fontSize: 16,
            py: 2,
            '&::placeholder': { color: 'text.secondary', opacity: 1 },
          }}
        />
        {busy ? (
          <CircularProgress size={18} />
        ) : (
          <Button
            size="small"
            variant="outlined"
            onClick={onClose}
            sx={{ minWidth: 36, py: 0, fontSize: 11 }}
          >
            Esc
          </Button>
        )}
      </Box>
      <Box
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t('redesign.palette.results', { defaultValue: '搜索结果' })}
        aria-busy={busy}
        sx={{ p: 1, maxHeight: 'min(470px, 55vh)', overflowY: 'auto' }}
      >
        {filtered.length > matches.length && (
          <Typography
            role="status"
            sx={{ px: 1.5, py: 1, fontSize: 12, color: 'text.secondary' }}
          >
            {t('redesign.palette.refine', {
              defaultValue: '找到 {{count}} 项，请继续输入以缩小范围',
              count: filtered.length,
            })}
          </Typography>
        )}
        {matches.length === 0 && (
          <Typography
            role="status"
            sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}
          >
            {t('redesign.palette.empty', { defaultValue: '没有匹配项' })}
          </Typography>
        )}
        {matches.map((command, index) => (
          <Box key={command.id}>
            {(index === 0 ||
              command.section !== matches[index - 1].section) && (
              <Typography
                sx={{
                  px: 1.5,
                  pt: 1.25,
                  pb: 0.5,
                  fontSize: 12,
                  color: 'text.secondary',
                }}
              >
                {command.section}
              </Typography>
            )}
            <Box
              component="button"
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={busy}
              tabIndex={-1}
              onMouseMove={() => setSelectedIndex(index)}
              onClick={() => void execute(command)}
              sx={{
                width: '100%',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                border: 0,
                borderRadius: '10px',
                px: 1.5,
                py: 1,
                bgcolor:
                  index === activeIndex ? 'action.selected' : 'transparent',
                color: 'text.primary',
                textAlign: 'left',
                cursor: busy ? 'wait' : 'pointer',
                font: 'inherit',
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  bgcolor: 'action.hover',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {command.selected ? (
                  <CheckRounded sx={{ fontSize: 17, color: 'primary.main' }} />
                ) : command.node ? (
                  <BoltRounded sx={{ fontSize: 17 }} />
                ) : (
                  <ArrowForwardRounded sx={{ fontSize: 17 }} />
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 14 }}>
                  {command.label}
                </Typography>
                {command.detail && (
                  <Typography
                    noWrap
                    sx={{ fontSize: 11, color: 'text.secondary' }}
                  >
                    {command.detail}
                  </Typography>
                )}
              </Box>
              {measurement?.id === command.id && (
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: 'primary.main',
                  }}
                >
                  {measurement.text}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          px: 2.25,
          py: 1.25,
          borderTop: 1,
          borderColor: 'divider',
          color: 'text.secondary',
          fontSize: 12,
        }}
      >
        <span>{t('redesign.palette.choose', { defaultValue: '↑↓ 选择' })}</span>
        <span>{t('redesign.palette.execute', { defaultValue: '↵ 执行' })}</span>
        {active?.node && (
          <span>
            {t('redesign.palette.test', { defaultValue: 'Tab 测速当前' })}
          </span>
        )}
      </Box>
    </>
  )
}

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-label={t('redesign.palette.title', { defaultValue: '搜索与命令' })}
      slotProps={{
        transition: { onEntered: () => inputRef.current?.focus() },
        paper: {
          sx: {
            borderRadius: '18px',
            border: 1,
            borderColor: 'divider',
            maxWidth: 640,
            alignSelf: 'flex-start',
            mt: 'min(110px, 14vh)',
          },
        },
        backdrop: { sx: { bgcolor: 'rgba(6, 8, 10, .72)' } },
      }}
    >
      {open && <PaletteContent onClose={onClose} inputRef={inputRef} />}
    </Dialog>
  )
}
