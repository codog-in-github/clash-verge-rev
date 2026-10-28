import { BoltRounded, ArrowForwardRounded } from '@mui/icons-material'
import {
  Box,
  Button,
  ButtonBase,
  MenuItem,
  Select,
  Typography,
  alpha,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import {
  canSelectGroupMember,
  isUnambiguousGroupMember,
} from '@/components/proxy/node-selection'
import { useGroupDelays } from '@/hooks/use-group-delays'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useVerge } from '@/hooks/use-verge'
import { useAppRefreshers } from '@/providers/app-data-context'
import delayManager from '@/services/delay'
import { configureGroupTestUrl } from '@/services/group-test-url'
import { showNotice } from '@/services/notice-service'
import {
  isInteractableMember,
  memberDetails,
  resolveMember,
  type ProxyGroupView,
  type ProxyViewV1,
} from '@/types/proxy-view'
import { classifyDelay, compareByDelay } from '@/utils/delay'

interface Props {
  view?: ProxyViewV1
  group?: ProxyGroupView | null
  groups: ProxyGroupView[]
  onGroupChange: (name: string) => void
}

export const QuickNodes = ({
  view,
  group: requestedGroup,
  groups,
  onGroupChange,
}: Props) => {
  const selectableGroups = groups.filter((item) =>
    ['Selector', 'URLTest', 'Fallback'].includes(item.type),
  )
  const group = selectableGroups.find(
    (item) => item.name === requestedGroup?.name,
  )
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { verge } = useVerge()
  const { profiles } = useProfiles()
  const { refreshProxy } = useAppRefreshers()
  const { handleProxyGroupChange } = useProxySelection({
    onSuccess: () => void refreshProxy(),
    onError: showNotice.error,
  })
  const delays = useGroupDelays(group?.name ?? null)
  const [testing, setTesting] = useState(false)
  const members =
    view && group
      ? group.members.map((ref, index) => ({
          member: resolveMember(view, ref),
          index,
        }))
      : []
  const profileUid = profiles?.current
  useEffect(() => {
    if (group)
      configureGroupTestUrl(profileUid, group, verge?.default_latency_test)
  }, [group, profileUid, verge?.default_latency_test])
  const timeout = verge?.default_latency_timeout || 10000
  const delayOf = (member: (typeof members)[number]['member']) =>
    group && isUnambiguousGroupMember(group, member.ref)
      ? delays.of(member)
      : -1
  const sorted = [...members].sort((a, b) =>
    compareByDelay(delayOf(a.member), delayOf(b.member), timeout),
  )
  const testGroup = useLockFn(async () => {
    if (!group) return
    setTesting(true)
    try {
      await delayManager.checkListDelay(
        members
          .map(({ member }) => member)
          .filter(isInteractableMember)
          .filter((member) => isUnambiguousGroupMember(group, member.ref)),
        group.name,
        timeout,
      )
    } catch (error) {
      showNotice.error(error)
    } finally {
      setTesting(false)
    }
  })

  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: '16px',
        p: 2.25,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
          {t('redesign.quickNodes')}
        </Typography>
        {group && (
          <Select
            size="small"
            value={group.name}
            onChange={(event) => onGroupChange(event.target.value)}
            inputProps={{
              'aria-label': t('home.components.currentProxy.labels.group'),
            }}
            sx={{ fontSize: 13, height: 34, maxWidth: 220 }}
          >
            {selectableGroups.map((item) => (
              <MenuItem key={item.name} value={item.name}>
                {item.name}
              </MenuItem>
            ))}
          </Select>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<BoltRounded />}
          disabled={!group || testing}
          onClick={testGroup}
        >
          {t(
            testing
              ? 'home.components.currentProxy.status.testing'
              : 'redesign.testGroup',
          )}
        </Button>
        <Button
          size="small"
          endIcon={<ArrowForwardRounded />}
          onClick={() =>
            navigate(
              group
                ? `/proxies?group=${encodeURIComponent(group.name)}`
                : '/proxies',
            )
          }
        >
          {t('redesign.allNodes')}
        </Button>
      </Box>
      {group && sorted.length > 0 ? (
        <Box
          role="group"
          aria-label={t('redesign.quickNodes')}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 1.25,
          }}
        >
          {sorted.slice(0, 6).map(({ member, index }) => {
            const delay = delayOf(member)
            const selectable = canSelectGroupMember(group, member.ref)
            const selected = selectable && group.now === member.ref.name
            return (
              <ButtonBase
                key={`${group.name}:${index}`}
                disabled={!selectable}
                aria-pressed={selected}
                onClick={() => {
                  if (canSelectGroupMember(group, member.ref))
                    handleProxyGroupChange(group, { name: member.ref.name })
                }}
                sx={(theme) => ({
                  textAlign: 'left',
                  justifyContent: 'space-between',
                  gap: 1,
                  p: 1.75,
                  minWidth: 0,
                  borderRadius: '12px',
                  border: 1,
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected
                    ? alpha(theme.palette.primary.main, 0.1)
                    : 'background.default',
                  '&:hover': { borderColor: 'primary.main' },
                })}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                    {member.ref.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {memberDetails(member)?.type ?? '—'}
                  </Typography>
                </Box>
                <Typography
                  component="span"
                  className="dashboard-mono"
                  sx={{
                    fontSize: 12,
                    flexShrink: 0,
                    color:
                      delayManager.formatDelayColor(delay, timeout) ||
                      'text.secondary',
                  }}
                >
                  {delayManager.formatDelay(delay, timeout)}
                  {classifyDelay(delay, timeout) === 'measured' ? ' ms' : ''}
                </Typography>
              </ButtonBase>
            )
          })}
        </Box>
      ) : (
        <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
          {t('home.components.currentProxy.labels.noActiveNode')}
        </Typography>
      )}
    </Box>
  )
}
