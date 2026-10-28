import { OpenInNewRounded, PowerSettingsNewRounded } from '@mui/icons-material'
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Divider,
  MenuItem,
  Select,
  Stack,
  Switch,
  ThemeProvider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NoticeManager } from '@/components/layout/notice-manager'
import { canSelectGroupMember } from '@/components/proxy/node-selection'
import { useGroupDelays } from '@/hooks/use-group-delays'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useVerge } from '@/hooks/use-verge'
import { useVisibility } from '@/hooks/use-visibility'
import { useCustomTheme } from '@/pages/_layout/hooks/use-custom-theme'
import { useLoadingOverlay } from '@/pages/_layout/hooks/use-loading-overlay'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { useEventBus } from '@/services/bus'
import { exitApp, patchClashMode } from '@/services/cmds'
import delayManager from '@/services/delay'
import { configureGroupTestUrl } from '@/services/group-test-url'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { revalidateQueries } from '@/services/query-client'
import { hideTrayPanel, openMainWindow } from '@/services/tray'
import { isInteractableMember, resolveMember } from '@/types/proxy-view'
import { classifyDelay } from '@/utils/delay'
import parseTraffic from '@/utils/parse-traffic'

const modes = ['rule', 'global', 'direct'] as const

export default function TrayPage() {
  const { theme } = useCustomTheme()
  useLoadingOverlay(Boolean(theme))
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()
  const { profiles } = useProfiles()
  const { indicator, toggleSystemProxy } = useSystemProxyState()
  const { isTunModeAvailable, runState, isLoading } = useSystemState()
  const { proxyView, isProxyViewPending } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const { refreshProxy, refreshClashConfig, refreshAll } = useAppRefreshers()
  const visible = useVisibility()
  const {
    response: { data: traffic },
  } = useTrafficData({ enabled: visible })
  const [selectedGroup, setSelectedGroup] = useState('')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const lastCaptureRef = useRef<{ system: boolean; tun: boolean } | null>(null)
  const tunEnabled = Boolean(verge?.enable_tun_mode && isTunModeAvailable)
  const connected = indicator || tunEnabled
  useEffect(() => {
    if (!busy && connected) {
      lastCaptureRef.current = { system: indicator, tun: tunEnabled }
    }
  }, [busy, connected, indicator, tunEnabled])
  const mode = clashConfig?.mode?.toLowerCase()
  const groups =
    mode === 'global'
      ? proxyView?.global
        ? [proxyView.global]
        : []
      : (proxyView?.groups.filter((group) => !group.hidden) ?? [])
  const group = groups.find((item) => item.name === selectedGroup) ?? groups[0]
  const resolvedMembers =
    proxyView && group
      ? group.members
          .map((member) => resolveMember(proxyView, member))
          .filter(isInteractableMember)
      : []
  const members = [
    ...new Map(
      resolvedMembers.map((member) => [member.ref.name, member]),
    ).values(),
  ]
  const delays = useGroupDelays(group?.name ?? null)

  const handleNotice = useCallback(([status, message]: [string, string]) => {
    if (message && (status === 'error' || status.endsWith('::error')))
      showNotice.error(message)
  }, [])
  useEventBus(handleNotice)

  useEffect(() => {
    if (visible) void refreshAll().catch(showNotice.error)
  }, [visible, refreshAll])

  const { handleProxyGroupChange } = useProxySelection({
    onSuccess: () => {
      void refreshProxy()
    },
    onError: showNotice.error,
  })

  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (error) {
      showNotice.error(error)
    } finally {
      setBusy(false)
    }
  }

  const toggleConnection = async (enabled: boolean) => {
    const capture = lastCaptureRef.current ?? {
      system: !verge?.enable_tun_mode,
      tun: Boolean(verge?.enable_tun_mode),
    }
    if (enabled && capture.tun && !isTunModeAvailable) {
      showNotice.error('home.components.proxyTun.status.tunModeServiceRequired')
      return
    }
    if (enabled && runState.mode === 'NotRunning') {
      showNotice.error('settings.feedback.errors.sysproxy.coreNotReady')
      return
    }
    try {
      if (enabled) {
        if (capture.tun) await patchVerge({ enable_tun_mode: true })
        if (capture.system) await toggleSystemProxy(true)
      } else {
        lastCaptureRef.current = { system: indicator, tun: tunEnabled }
        if (tunEnabled) await patchVerge({ enable_tun_mode: false })
        if (indicator) await toggleSystemProxy(false)
      }
    } finally {
      await revalidateQueries([
        ['getVergeConfig'],
        ['getSystemProxy'],
        ['getAutoProxy'],
      ]).catch((error) => {
        console.warn('[tray] Failed to refresh connection state:', error)
      })
    }
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void hideTrayPanel().catch(showNotice.error)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        void openMainWindow().catch(showNotice.error)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])

  const testGroup = async () => {
    if (!group || testing) return
    setTesting(true)
    try {
      configureGroupTestUrl(
        profiles?.current,
        group,
        verge?.default_latency_test,
      )
      await delayManager.checkListDelay(
        members,
        group.name,
        verge?.default_latency_timeout ?? 10000,
      )
    } catch (error) {
      showNotice.error(error)
    } finally {
      setTesting(false)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <NoticeManager position="bottom-right" />
      <Stack
        sx={{
          height: '100vh',
          boxSizing: 'border-box',
          p: 2,
          gap: 1.75,
          bgcolor: 'background.paper',
          color: 'text.primary',
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Box>
            <Typography
              sx={{
                fontSize: 17,
                fontWeight: 700,
                color: connected ? 'primary.main' : 'text.primary',
              }}
            >
              {t(
                connected
                  ? 'redesign.tray.connected'
                  : 'redesign.tray.disconnected',
              )}
            </Typography>
            <Typography
              sx={{
                mt: 0.5,
                fontSize: 12,
                fontFamily: 'monospace',
                color: 'text.secondary',
              }}
            >
              ↓ {traffic ? parseTraffic(traffic.down).join(' ') + '/s' : '—'} ·
              ↑ {traffic ? parseTraffic(traffic.up).join(' ') + '/s' : '—'}
            </Typography>
          </Box>
          <Switch
            checked={connected}
            disabled={
              busy ||
              isLoading ||
              (!connected && runState.mode === 'NotRunning')
            }
            slotProps={{
              input: { 'aria-label': t('redesign.tray.connection') },
            }}
            onChange={(_, checked) =>
              void perform(() => toggleConnection(checked))
            }
          />
        </Stack>

        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode ?? null}
          disabled={busy || !clashConfig}
          aria-label={t('redesign.tray.proxyMode')}
          onChange={(_, value: (typeof modes)[number] | null) => {
            if (!value) return
            void perform(async () => {
              await mutate(() => patchClashMode(value), {
                id: 'patch-clash-mode',
                errorNotice: false,
              })
              await refreshClashConfig()
            })
          }}
          sx={{
            bgcolor: 'background.default',
            '& .MuiToggleButton-root': {
              flex: 1,
              textTransform: 'none',
              py: 0.75,
            },
          }}
        >
          {modes.map((value) => (
            <ToggleButton key={value} value={value}>
              {t(`redesign.tray.${value}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 0,
          }}
        >
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {t('redesign.tray.selectNode')}
          </Typography>
          <Button
            size="small"
            disabled={!group || testing || mode === 'direct'}
            onClick={() => void testGroup()}
          >
            {testing ? (
              <CircularProgress size={14} />
            ) : (
              t('redesign.tray.testLatency')
            )}
          </Button>
        </Stack>
        {groups.length > 0 && mode !== 'direct' && (
          <Select
            size="small"
            value={group?.name ?? ''}
            inputProps={{ 'aria-label': t('redesign.tray.proxyGroup') }}
            onChange={(event) => setSelectedGroup(event.target.value)}
            sx={{ fontSize: 13, mt: -1 }}
          >
            {groups.map((item) => (
              <MenuItem key={item.name} value={item.name}>
                {item.name}
              </MenuItem>
            ))}
          </Select>
        )}
        <Box
          role="radiogroup"
          aria-label={t('redesign.tray.selectOutbound')}
          sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        >
          {mode === 'direct' ? (
            <Typography
              color="text.secondary"
              sx={{ py: 3, textAlign: 'center', fontSize: 13 }}
            >
              {t('redesign.tray.directHint')}
            </Typography>
          ) : isProxyViewPending ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress size={22} />
            </Box>
          ) : members.length === 0 ? (
            <Typography
              color="text.secondary"
              sx={{ py: 3, textAlign: 'center', fontSize: 13 }}
            >
              {t('redesign.tray.empty')}
            </Typography>
          ) : (
            members.map((member) => {
              const delay = delays.of(member)
              const state = classifyDelay(
                delay,
                verge?.default_latency_timeout ?? 10000,
              )
              const selected = group?.now === member.ref.name
              return (
                <ButtonBase
                  key={member.ref.name}
                  role="radio"
                  aria-checked={selected}
                  disabled={
                    busy || !group || !canSelectGroupMember(group, member.ref)
                  }
                  onClick={() =>
                    group &&
                    handleProxyGroupChange(group, { name: member.ref.name })
                  }
                  sx={{
                    display: 'flex',
                    width: '100%',
                    textAlign: 'left',
                    gap: 1.25,
                    px: 1.25,
                    minHeight: 42,
                    borderRadius: 1.25,
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-focusVisible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      flexShrink: 0,
                      borderRadius: '50%',
                      border: 1,
                      borderColor: selected ? 'primary.main' : 'text.disabled',
                      bgcolor: selected ? 'primary.main' : 'transparent',
                    }}
                  />
                  <Typography noWrap sx={{ flex: 1, fontSize: 13 }}>
                    {member.ref.name}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color:
                        state === 'measured'
                          ? delay < 150
                            ? 'success.main'
                            : 'warning.main'
                          : 'text.secondary',
                    }}
                  >
                    {state === 'measured'
                      ? `${delay} ms`
                      : state === 'testing'
                        ? '…'
                        : state === 'timeout' || state === 'error'
                          ? t('redesign.tray.timeout')
                          : '—'}
                  </Typography>
                </ButtonBase>
              )
            })
          )}
        </Box>
        <Divider />
        <Stack sx={{ gap: 0.5 }}>
          <Tooltip
            title={
              !isTunModeAvailable
                ? t('home.components.proxyTun.status.tunModeServiceRequired')
                : ''
            }
          >
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.25,
              }}
            >
              <Typography sx={{ fontSize: 13 }}>
                {t('redesign.tray.tun')}
              </Typography>
              <Switch
                size="small"
                checked={tunEnabled}
                disabled={busy || (!isTunModeAvailable && !tunEnabled)}
                slotProps={{ input: { 'aria-label': 'TUN' } }}
                onChange={(_, enabled) =>
                  void perform(() => patchVerge({ enable_tun_mode: enabled }))
                }
              />
            </Stack>
          </Tooltip>
          <Button
            fullWidth
            color="inherit"
            startIcon={<OpenInNewRounded />}
            onClick={() => void perform(openMainWindow)}
            sx={{ justifyContent: 'flex-start', fontSize: 13, py: 0.75 }}
          >
            {t('redesign.tray.openMain')}
          </Button>
          <Button
            fullWidth
            color="error"
            startIcon={<PowerSettingsNewRounded />}
            disabled={busy}
            onClick={() =>
              void perform(() =>
                mutate(exitApp, { id: 'exit-app', errorNotice: false }),
              )
            }
            sx={{ justifyContent: 'flex-start', fontSize: 13, py: 0.75 }}
          >
            {t('redesign.tray.quit')}
          </Button>
        </Stack>
      </Stack>
    </ThemeProvider>
  )
}
