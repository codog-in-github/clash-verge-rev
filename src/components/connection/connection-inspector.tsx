import { CloseRounded, ContentCopyRounded } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { useLockFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { closeConnection } from 'tauri-plugin-mihomo-api'

import { useProfiles } from '@/hooks/use-profiles'
import { useAppRefreshers, useProxiesData } from '@/providers/app-data-context'
import {
  enhanceProfiles,
  getProfiles,
  readProfileFile,
  saveProfileFile,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import parseTraffic from '@/utils/parse-traffic'

import { exactHostRule, prependHostRule } from './connection-rule'

export const ConnectionInspector = ({
  data,
  closed,
  onClose,
}: {
  data: IConnectionsItem
  closed: boolean
  onClose: () => void
}) => {
  const { t } = useTranslation()
  const { profiles } = useProfiles()
  const { proxyView } = useProxiesData()
  const { refreshRules } = useAppRefreshers()
  const { metadata } = data
  const host =
    metadata.host || metadata.destinationIP || metadata.remoteDestination || '—'
  const chain = [...data.chains].reverse()
  const policies = [
    ...new Set([
      'DIRECT',
      ...(proxyView?.groups.map(({ name }) => name) ?? []),
      'REJECT',
    ]),
  ].filter((name) => !/[,\r\n]/u.test(name))
  const [target, setTarget] = useState(
    policies.includes(chain[0]) ? chain[0] : 'DIRECT',
  )
  const [saving, setSaving] = useState(false)
  const [savedNotApplied, setSavedNotApplied] = useState(false)
  const [disconnected, setDisconnected] = useState(false)
  const policy = policies.includes(target) ? target : 'DIRECT'
  const rule = exactHostRule(metadata.host, policy)
  const profile = profiles?.items?.find(({ uid }) => uid === profiles.current)
  const rulesUid = profile?.option?.rules

  const addRule = useLockFn(async () => {
    if (!rule || !rulesUid || !profile?.uid) return
    const profileUid = profile.uid
    setSaving(true)
    setSavedNotApplied(false)
    let saved = false
    let appliedSuccessfully = false
    try {
      const result = await mutate(
        async () => {
          if ((await getProfiles()).current !== profileUid)
            throw new Error(t('redesign.profileChanged'))
          const source = await readProfileFile(rulesUid)
          return saveProfileFile(rulesUid, prependHostRule(source, rule))
        },
        { id: `save-profile-file:${rulesUid}`, errorNotice: false },
      )
      if (!result.ok || result.value !== true) return
      saved = true
      const applied = await mutate(
        async () => {
          if ((await getProfiles()).current !== profileUid)
            throw new Error(t('redesign.profileChanged'))
          return enhanceProfiles()
        },
        { id: 'enhance-profiles', errorNotice: false },
      )
      if (!applied.ok || applied.value !== true) {
        setSavedNotApplied(true)
        return
      }
      appliedSuccessfully = true
      await refreshRules()
      showNotice.success('shared.feedback.notifications.saved')
    } catch (error) {
      setSavedNotApplied(saved && !appliedSuccessfully)
      showNotice.error(error)
    } finally {
      setSaving(false)
    }
  })

  const disconnect = useLockFn(async () => {
    try {
      const result = await mutate(() => closeConnection(data.id), {
        id: `close-connection:${data.id}`,
        errorNotice: false,
      })
      if (result.ok) setDisconnected(true)
    } catch (error) {
      showNotice.error(error)
    }
  })
  const copyHost = useLockFn(async () => {
    try {
      await mutate(() => writeText(host), {
        id: 'copy-connection-host',
        errorNotice: false,
      })
    } catch (error) {
      showNotice.error(error)
    }
  })

  return (
    <Box
      component="aside"
      aria-label={t('redesign.connectionDetails')}
      sx={{
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        userSelect: 'text',
        minWidth: 0,
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography color="text.secondary" sx={{ fontSize: 12, flex: 1 }}>
            {t('redesign.connectionDetails')}
          </Typography>
          <IconButton
            size="small"
            aria-label={t('shared.actions.close')}
            onClick={onClose}
          >
            <CloseRounded fontSize="small" />
          </IconButton>
        </Box>
        <Typography
          component="h2"
          sx={{
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: 600,
            overflowWrap: 'anywhere',
          }}
        >
          {host}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
          {metadata.process || '—'} · {metadata.network} · {metadata.type}
        </Typography>
      </Box>
      <Box
        sx={{
          bgcolor: 'background.default',
          borderRadius: '12px',
          p: 1.75,
          overflowWrap: 'anywhere',
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: 12, mb: 1 }}>
          {t('redesign.routeReason')}
        </Typography>
        <Typography sx={{ fontFamily: 'monospace', fontSize: 13 }}>
          {data.rule}
          {data.rulePayload ? `,${data.rulePayload}` : ''}
        </Typography>
        <Typography sx={{ fontSize: 13, mt: 1, color: 'primary.main' }}>
          {chain.length ? `→ ${chain.join(' → ')}` : '—'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
          {t('redesign.futureHostRoute')}
        </Typography>
        <Select
          size="small"
          value={policy}
          onChange={(event) => setTarget(event.target.value)}
          inputProps={{ 'aria-label': t('redesign.ruleTarget') }}
        >
          {policies.map((name) => (
            <MenuItem key={name} value={name}>
              {name === 'DIRECT'
                ? t('proxies.page.modes.direct')
                : name === 'REJECT'
                  ? t('redesign.block')
                  : name}
            </MenuItem>
          ))}
        </Select>
        {rule && (
          <Typography
            sx={{
              fontFamily: 'monospace',
              fontSize: 11,
              overflowWrap: 'anywhere',
              color: 'text.secondary',
            }}
          >
            {rule}
          </Typography>
        )}
        <Button
          variant="contained"
          disabled={!rule || !rulesUid}
          loading={saving}
          onClick={addRule}
        >
          {t('redesign.addRule')}
        </Button>
        <Typography color="text.secondary" sx={{ fontSize: 12 }}>
          {t(
            rule && rulesUid
              ? 'redesign.rulePersistence'
              : 'redesign.ruleUnavailable',
            { name: profile?.name ?? '' },
          )}
        </Typography>
        {savedNotApplied && (
          <Alert severity="warning">{t('redesign.ruleSavedNotApplied')}</Alert>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<ContentCopyRounded />}
          onClick={copyHost}
          sx={{ flex: 1 }}
        >
          {t('redesign.copyHost')}
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={closed || disconnected}
          onClick={disconnect}
          sx={{ flex: 1 }}
        >
          {t(
            closed || disconnected
              ? 'connections.components.actions.closed'
              : 'connections.components.actions.closeConnection',
          )}
        </Button>
      </Box>
      <Box
        component="details"
        sx={{ fontSize: 12, color: 'text.secondary', overflowWrap: 'anywhere' }}
      >
        <Box component="summary" sx={{ cursor: 'pointer', mb: 1 }}>
          {t('shared.actions.showDetails')}
        </Box>
        <div>
          {t('connections.components.fields.source')}: {metadata.sourceIP}:
          {metadata.sourcePort}
        </div>
        <div>
          {t('connections.components.fields.destination')}:{' '}
          {metadata.destinationIP || metadata.remoteDestination}:
          {metadata.destinationPort}
        </div>
        <div>
          {t('connections.components.fields.process')}:{' '}
          {metadata.processPath || metadata.process || '—'}
        </div>
        <div>
          {t('shared.labels.downloaded')}:{' '}
          {parseTraffic(data.download).join(' ')}
        </div>
        <div>
          {t('shared.labels.uploaded')}: {parseTraffic(data.upload).join(' ')}
        </div>
        <div>
          {t('connections.components.fields.dlSpeed')}:{' '}
          {parseTraffic(data.curDownload ?? 0).join(' ')}/s
        </div>
        <div>
          {t('connections.components.fields.ulSpeed')}:{' '}
          {parseTraffic(data.curUpload ?? 0).join(' ')}/s
        </div>
        <div>
          {t('connections.components.fields.time')}: {data.start}
        </div>
      </Box>
    </Box>
  )
}
