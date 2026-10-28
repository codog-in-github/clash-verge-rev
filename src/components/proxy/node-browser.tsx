import { BoltRounded, CheckRounded, SearchRounded } from '@mui/icons-material'
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLockFn } from 'ahooks'
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { BaseEmpty } from '@/components/base'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxyDelayState } from '@/hooks/use-proxy-delay-state'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useVerge } from '@/hooks/use-verge'
import { useAppRefreshers, useProxiesData } from '@/providers/app-data-context'
import delayManager from '@/services/delay'
import { configureGroupTestUrl } from '@/services/group-test-url'
import { showNotice } from '@/services/notice-service'
import {
  isInteractableMember,
  memberDetails,
  resolveMember,
  type ProxyGroupView,
  type ResolvedProxyMember,
} from '@/types/proxy-view'

import {
  canSelectGroupMember,
  isUnambiguousGroupMember,
} from './node-selection'
import { filterSort, type ProxySortType } from './use-filter-sort'

const NodeCard = ({
  group,
  member,
  onSelect,
}: {
  group: ProxyGroupView
  member: ResolvedProxyMember
  onSelect: (group: ProxyGroupView, member: ResolvedProxyMember) => void
}) => {
  const { t } = useTranslation()
  const { delayValue, isPreset, timeout, onDelay } = useProxyDelayState(
    member,
    group.name,
  )
  const details = memberDetails(member)
  const unambiguous = isUnambiguousGroupMember(group, member.ref)
  const selected = unambiguous && group.now === member.ref.name
  const selectable = canSelectGroupMember(group, member.ref)

  return (
    <Box
      sx={(theme) => ({
        position: 'relative',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: '12px',
        bgcolor: selected
          ? alpha(theme.palette.primary.main, 0.12)
          : 'background.paper',
        minWidth: 0,
        height: 80,
        boxSizing: 'border-box',
      })}
    >
      <ButtonBase
        disabled={!selectable}
        aria-pressed={selected}
        onClick={() => onSelect(group, member)}
        sx={{
          width: '100%',
          height: '100%',
          px: 1.75,
          py: 1.25,
          display: 'flex',
          alignItems: 'flex-start',
          flexDirection: 'column',
          borderRadius: 'inherit',
          gap: 1,
        }}
      >
        <Typography
          noWrap
          title={member.ref.name}
          sx={{ fontWeight: 600, fontSize: 14, maxWidth: 'calc(100% - 65px)' }}
        >
          {member.ref.name}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            alignItems: 'center',
            maxWidth: '100%',
          }}
        >
          <Chip
            size="small"
            label={details?.type ?? member.kind}
            sx={{ height: 20, fontSize: 11, borderRadius: '5px' }}
          />
          {details?.udp && (
            <Chip
              size="small"
              label="UDP"
              sx={{ height: 20, fontSize: 11, borderRadius: '5px' }}
            />
          )}
          {member.kind === 'group' && (
            <Typography variant="caption" noWrap color="text.secondary">
              {member.group.now}
            </Typography>
          )}
          {selected && (
            <CheckRounded
              sx={{ fontSize: 16, color: 'primary.main', ml: 'auto' }}
            />
          )}
        </Box>
      </ButtonBase>
      {!isPreset && unambiguous && (
        <Button
          size="small"
          title={t('proxies.page.tooltips.delayCheck')}
          aria-label={`${t('proxies.page.tooltips.delayCheck')} ${member.ref.name}`}
          disabled={delayValue === -2}
          onClick={() => {
            void onDelay().catch(showNotice.error)
          }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 7,
            minWidth: 44,
            fontSize: 12,
            fontFamily: 'monospace',
            color:
              delayValue >= 0
                ? delayManager.formatDelayColor(delayValue, timeout)
                : 'text.secondary',
          }}
        >
          {delayValue === -2 ? (
            <CircularProgress size={14} />
          ) : delayValue < 0 ? (
            '—'
          ) : (
            delayManager.formatDelay(delayValue, timeout)
          )}
        </Button>
      )}
    </Box>
  )
}

export const NodeBrowser = ({ mode }: { mode: string }) => {
  const { t } = useTranslation()
  const { proxyView } = useProxiesData()
  const { refreshProxy } = useAppRefreshers()
  const { verge } = useVerge()
  const { profiles } = useProfiles()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedGroup = searchParams.get('group')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ProxySortType>(0)
  const [testing, setTesting] = useState(false)
  const [delayRevision, refreshDelays] = useReducer(
    (value: number) => value + 1,
    0,
  )
  const [columns, setColumns] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => {
    if (!proxyView) return []
    return (
      mode === 'global' && proxyView.global
        ? [proxyView.global]
        : proxyView.groups
    ).filter((group) => !group.hidden)
  }, [mode, proxyView])
  const group = groups.find(({ name }) => name === selectedGroup) ?? groups[0]
  const groupName = group?.name ?? ''
  const profileUid = profiles?.current
  useEffect(() => {
    if (group)
      configureGroupTestUrl(profileUid, group, verge?.default_latency_test)
  }, [group, profileUid, verge?.default_latency_test])
  const timeout = verge?.default_latency_timeout || 10000
  const members = useMemo(
    () =>
      proxyView && group
        ? group.members.map((ref, memberIndex) => ({
            memberIndex,
            member: resolveMember(proxyView, ref),
          }))
        : [],
    [proxyView, group],
  )
  const filtered = useMemo(() => {
    void delayRevision
    const search = query.trim().toLocaleLowerCase()
    const matching = members.filter(
      ({ member }) =>
        !search ||
        `${member.ref.name} ${memberDetails(member)?.type ?? ''}`
          .toLocaleLowerCase()
          .includes(search),
    )
    return filterSort(matching, groupName, '', sort, timeout)
  }, [members, groupName, query, sort, timeout, delayRevision])
  const virtualizer = useVirtualizer({
    count: Math.ceil(filtered.length / columns),
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 90,
    overscan: 5,
  })

  useEffect(
    () => delayManager.addGroupListener(groupName, refreshDelays),
    [groupName],
  )
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) =>
      setColumns(Math.max(1, Math.floor((entry.contentRect.width + 10) / 210))),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [groupName])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [groupName, query, sort])

  const { handleProxyGroupChange } = useProxySelection({
    onSuccess: () => {
      void refreshProxy()
    },
    onError: showNotice.error,
  })
  const selectMember = (
    targetGroup: ProxyGroupView,
    member: ResolvedProxyMember,
  ) => {
    if (canSelectGroupMember(targetGroup, member.ref))
      handleProxyGroupChange(targetGroup, { name: member.ref.name })
  }
  const checkGroup = useLockFn(async () => {
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
      refreshDelays()
    } catch (error) {
      showNotice.error(error)
    } finally {
      setTesting(false)
    }
  })

  if (!group)
    return <BaseEmpty textKey="proxies.page.empty.noAvailableGroups" />

  return (
    <Box
      className="node-browser"
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2.25,
        p: { xs: 1.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      <Box
        component="nav"
        aria-label={t('proxies.page.title.default')}
        sx={{
          width: { xs: '100%', md: 230 },
          flexShrink: 0,
          overflow: 'auto',
          maxHeight: { xs: 180, md: '100%' },
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '16px',
          p: 1,
          boxSizing: 'border-box',
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: 12, p: 1 }}>
          {t('proxies.page.title.default')}
        </Typography>
        {groups.map((item) => (
          <ButtonBase
            key={item.name}
            aria-pressed={item.name === group.name}
            onClick={() =>
              setSearchParams({ group: item.name }, { replace: true })
            }
            sx={(theme) => ({
              width: '100%',
              display: 'flex',
              textAlign: 'left',
              justifyContent: 'space-between',
              gap: 1,
              px: 1.25,
              py: 1.5,
              borderRadius: '10px',
              bgcolor:
                item.name === group.name
                  ? alpha(theme.palette.primary.main, 0.12)
                  : 'transparent',
              color: item.name === group.name ? 'primary.main' : 'text.primary',
            })}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
                {item.name}
              </Typography>
              <Typography noWrap color="text.secondary" sx={{ fontSize: 12 }}>
                {item.type} → {item.now ?? '—'}
              </Typography>
            </Box>
            <Typography
              color="text.secondary"
              sx={{ fontFamily: 'monospace', fontSize: 12 }}
            >
              {item.members.length}
            </Typography>
          </ButtonBase>
        ))}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          minHeight: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.75,
        }}
      >
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography
                component="h2"
                noWrap
                sx={{ fontSize: 18, fontWeight: 700 }}
              >
                {group.name}
              </Typography>
              <Chip
                label={group.type}
                size="small"
                sx={{ borderRadius: '6px', fontSize: 11 }}
              />
            </Box>
            <Typography
              noWrap
              color="text.secondary"
              sx={{ fontSize: 12, mt: 0.5 }}
            >
              {t('proxies.page.tooltips.locate')} · {group.now ?? '—'}
            </Typography>
          </Box>
          <TextField
            size="small"
            placeholder={t('redesign.searchNodes', {
              defaultValue: '搜索节点、地区、协议',
            })}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ flex: '1 1 180px' }}
            slotProps={{
              htmlInput: { 'aria-label': t('proxies.page.tooltips.filter') },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={sort}
            onChange={(_, value: ProxySortType | null) => {
              if (value !== null) setSort(value)
            }}
            aria-label={t('redesign.sortNodes', { defaultValue: '节点排序' })}
          >
            <ToggleButton
              value={0}
              title={t('proxies.page.tooltips.sortDefault')}
            >
              {t('redesign.sortDefault', { defaultValue: '默认' })}
            </ToggleButton>
            <ToggleButton
              value={1}
              title={t('proxies.page.tooltips.sortDelay')}
            >
              {t('redesign.sortDelay', { defaultValue: '延迟' })}
            </ToggleButton>
            <ToggleButton value={2} title={t('proxies.page.tooltips.sortName')}>
              {t('shared.labels.name')}
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            startIcon={<BoltRounded />}
            loading={testing}
            onClick={checkGroup}
          >
            {t('redesign.testGroup', { defaultValue: '测速本组' })}
          </Button>
        </Box>
        <Box ref={scrollRef} sx={{ flex: 1, minHeight: 120, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <BaseEmpty textKey="proxies.page.empty.noProxies" />
          ) : (
            <Box
              sx={{
                height: virtualizer.getTotalSize(),
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((row) => (
                <Box
                  key={row.key}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${row.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap: '10px',
                  }}
                >
                  {filtered
                    .slice(row.index * columns, (row.index + 1) * columns)
                    .map(({ member, memberIndex }) => (
                      <NodeCard
                        key={`${group.name}:${memberIndex}`}
                        group={group}
                        member={member}
                        onSelect={selectMember}
                      />
                    ))}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}
