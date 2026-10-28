import {
  PowerSettingsNewRounded,
  ArrowForwardRounded,
} from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import {
  useAppRefreshers,
  useClashConfigData,
} from '@/providers/app-data-context'
import { patchClashMode } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { requestService } from '@/services/service-request'
import type { ProxyGroupView } from '@/types/proxy-view'

export const ConnectionControls = ({
  group,
}: {
  group?: ProxyGroupView | null
}) => {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()
  const { indicator, toggleSystemProxy } = useSystemProxyState()
  const { runState, isTunModeAvailable, isLoading } = useSystemState()
  const { clashConfig } = useClashConfigData()
  const { refreshClashConfig } = useAppRefreshers()
  const [preferred, setPreferred] = useState<'system' | 'tun' | 'both'>(() =>
    verge?.enable_tun_mode ? 'tun' : 'system',
  )
  const [busy, setBusy] = useState(false)
  const tunEnabled = !!verge?.enable_tun_mode
  const connected = indicator || (tunEnabled && runState.mode !== 'NotRunning')
  const rawMode = clashConfig?.mode?.toLowerCase()
  const mode =
    rawMode === 'rule' || rawMode === 'global' || rawMode === 'direct'
      ? rawMode
      : undefined

  const changeCapture = useLockFn(async (target: 'system' | 'tun' | 'both') => {
    if (target !== 'system' && !isTunModeAvailable) {
      requestService({
        reason: 'tunNeedsService',
        restore: { enable_tun_mode: true },
      })
      return
    }
    setBusy(true)
    try {
      if (target === 'system') {
        await toggleSystemProxy(true)
        if (tunEnabled) await patchVerge({ enable_tun_mode: false })
      } else {
        await patchVerge({ enable_tun_mode: true })
        if (target === 'both') await toggleSystemProxy(true)
        else if (indicator || verge?.enable_system_proxy)
          await toggleSystemProxy(false)
      }
      setPreferred(target)
    } catch (error) {
      showNotice.error(error)
    } finally {
      setBusy(false)
    }
  })

  const togglePower = useLockFn(async () => {
    if (!connected) {
      if (runState.mode === 'NotRunning') {
        showNotice.error('settings.feedback.errors.sysproxy.coreNotReady')
        return
      }
      await changeCapture(preferred)
      return
    }
    setPreferred(tunEnabled ? (indicator ? 'both' : 'tun') : 'system')
    setBusy(true)
    try {
      if (indicator || verge?.enable_system_proxy)
        await toggleSystemProxy(false)
      if (tunEnabled) await patchVerge({ enable_tun_mode: false })
    } catch (error) {
      showNotice.error(error)
    } finally {
      setBusy(false)
    }
  })

  const changeMode = useLockFn(async (value: 'rule' | 'global' | 'direct') => {
    setBusy(true)
    try {
      await mutate(() => patchClashMode(value), {
        id: 'patch-clash-mode',
        errorNotice: false,
      })
      await refreshClashConfig()
    } catch (error) {
      showNotice.error(error)
    } finally {
      setBusy(false)
    }
  })
  const capture = tunEnabled
    ? 'tun'
    : indicator
      ? 'system'
      : preferred === 'both'
        ? 'tun'
        : preferred
  const captureLabel =
    (indicator && tunEnabled) || (!connected && preferred === 'both')
      ? `${t('settings.sections.system.toggles.systemProxy')} + TUN`
      : t(
          capture === 'tun'
            ? 'settings.sections.system.toggles.tunMode'
            : 'settings.sections.system.toggles.systemProxy',
        )

  return (
    <Box
      component="section"
      aria-label={t('redesign.connection')}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 3,
        p: 3,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '18px',
      }}
    >
      <Button
        aria-label={t(connected ? 'redesign.disconnect' : 'redesign.connect')}
        aria-pressed={connected}
        disabled={busy || isLoading}
        onClick={togglePower}
        sx={(theme) => ({
          width: 96,
          height: 96,
          flexShrink: 0,
          borderRadius: '50%',
          border: 1,
          borderColor: connected ? 'primary.main' : 'divider',
          bgcolor: connected
            ? alpha(theme.palette.primary.main, 0.13)
            : 'background.default',
          color: connected ? 'primary.main' : 'text.secondary',
        })}
      >
        {busy ? (
          <CircularProgress size={36} color="inherit" />
        ) : (
          <PowerSettingsNewRounded sx={{ fontSize: 44 }} />
        )}
      </Button>
      <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
        <Typography
          component="h2"
          sx={{
            fontSize: 26,
            fontWeight: 700,
            color: connected ? 'primary.main' : 'text.secondary',
            mb: 0.5,
          }}
        >
          {t(connected ? 'redesign.connected' : 'redesign.disconnected')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(connected ? 'redesign.captureActive' : 'redesign.captureInactive')}
        </Typography>
        <Box
          aria-label={t('redesign.trafficPath')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 0.75,
          }}
        >
          <Chip size="small" label={captureLabel} />
          <ArrowForwardRounded sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Chip
            size="small"
            label={mode ? t(`home.components.clashMode.labels.${mode}`) : '—'}
          />
          {mode !== 'direct' && group && (
            <>
              <ArrowForwardRounded
                sx={{ fontSize: 14, color: 'text.secondary' }}
              />
              <Chip size="small" label={group.name} />
              <ArrowForwardRounded
                sx={{ fontSize: 14, color: 'text.secondary' }}
              />
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={group.now || '—'}
                sx={{ maxWidth: 240 }}
              />
            </>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          flex: '1 1 260px',
          maxWidth: { xs: '100%', lg: 340 },
          display: 'grid',
          gap: 1.5,
        }}
      >
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ mb: 0.5 }}
          >
            {t('redesign.proxyMode')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={mode ?? null}
            onChange={(_, value) => value && changeMode(value)}
            aria-label={t('redesign.proxyMode')}
            disabled={busy}
          >
            {(['rule', 'global', 'direct'] as const).map((value) => (
              <ToggleButton key={value} value={value}>
                {t(`home.components.clashMode.labels.${value}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ mb: 0.5 }}
          >
            {t('redesign.captureMode')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={capture}
            disabled={busy || isLoading}
            onChange={(_, value: 'system' | 'tun' | null) => {
              if (value) {
                if (connected) void changeCapture(value)
                else setPreferred(value)
              }
            }}
            aria-label={t('redesign.captureMode')}
          >
            <ToggleButton value="system">
              {t('settings.sections.system.toggles.systemProxy')}
            </ToggleButton>
            <ToggleButton value="tun">
              {t('settings.sections.system.toggles.tunMode')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Box>
  )
}
