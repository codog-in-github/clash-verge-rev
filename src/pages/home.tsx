import {
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  ExpandMoreRounded,
  RefreshRounded,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Skeleton,
  Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { BasePage } from '@/components/base'
import { ConnectionControls } from '@/components/home/connection-controls'
import { EnhancedTrafficStats } from '@/components/home/enhanced-traffic-stats'
import { QuickNodes } from '@/components/home/quick-nodes'
import { useProfiles } from '@/hooks/use-profiles'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useTrafficGraphDataEnhanced } from '@/hooks/use-traffic-monitor'
import { useVisibility } from '@/hooks/use-visibility'
import {
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { getIpInfo } from '@/services/api'
import { useQuery } from '@/services/query-client'
import parseTraffic from '@/utils/parse-traffic'

const preloadTestCard = () =>
  import('@/components/home/test-card').then((module) => ({
    default: module.TestCard,
  }))
const preloadClashInfoCard = () =>
  import('@/components/home/clash-info-card').then((module) => ({
    default: module.ClashInfoCard,
  }))
const preloadSystemInfoCard = () =>
  import('@/components/home/system-info-card').then((module) => ({
    default: module.SystemInfoCard,
  }))
const TestCard = lazy(preloadTestCard)
const ClashInfoCard = lazy(preloadClashInfoCard)
const SystemInfoCard = lazy(preloadSystemInfoCard)

// eslint-disable-next-line react-refresh/only-export-components
export const preloadHomePageCards = () =>
  Promise.allSettled([
    preloadTestCard(),
    preloadClashInfoCard(),
    preloadSystemInfoCard(),
  ])

const cardStyle = {
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: '16px',
  p: 2.25,
  minWidth: 0,
} as const

const TrafficCard = () => {
  const { t } = useTranslation()
  const visible = useVisibility()
  const {
    response: { data: traffic, error },
  } = useTrafficData({ enabled: visible })
  const { dataPoints } = useTrafficGraphDataEnhanced()
  const points = dataPoints.slice(-60)
  const max = Math.max(1, ...points.flatMap((point) => [point.down, point.up]))
  const line = (key: 'up' | 'down') =>
    points
      .map(
        (point, index) =>
          `${points.length > 1 ? (index * 240) / (points.length - 1) : 0},${48 - (point[key] * 44) / max}`,
      )
      .join(' ')

  return (
    <Box component="section" sx={cardStyle}>
      <Typography variant="caption" color="text.secondary">
        {t('redesign.liveTraffic')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, my: 1.5 }}>
        {(['down', 'up'] as const).map((direction) => (
          <Box
            key={direction}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            {direction === 'down' ? (
              <ArrowDownwardRounded color="primary" sx={{ fontSize: 18 }} />
            ) : (
              <ArrowUpwardRounded color="secondary" sx={{ fontSize: 18 }} />
            )}
            <Typography
              className="dashboard-mono"
              sx={{ fontSize: 20, fontWeight: 600 }}
            >
              {error ? '—' : parseTraffic(traffic?.[direction] ?? 0).join(' ')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              /s
            </Typography>
          </Box>
        ))}
      </Box>
      <Box
        component="svg"
        viewBox="0 0 240 52"
        width="100%"
        height={52}
        preserveAspectRatio="none"
        aria-hidden="true"
        sx={{ display: 'block' }}
      >
        <Box
          component="polyline"
          points={line('down')}
          fill="none"
          strokeWidth={2}
          sx={{ stroke: 'primary.main' }}
        />
        <Box
          component="polyline"
          points={line('up')}
          fill="none"
          strokeWidth={1.5}
          sx={{ stroke: 'secondary.main' }}
        />
      </Box>
      {error && (
        <Typography variant="caption" color="text.secondary">
          {t('redesign.trafficUnavailable')}
        </Typography>
      )}
    </Box>
  )
}

const ExitCard = () => {
  const { t } = useTranslation()
  const [showIp, setShowIp] = useState(false)
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['cv_ip_info_cache'],
    queryFn: getIpInfo,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })
  return (
    <Box component="section" sx={cardStyle}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {t('redesign.exitIp')}
        </Typography>
        <IconButton
          size="small"
          aria-label={t('redesign.recheckIp')}
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshRounded sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
        <Typography
          className="dashboard-mono"
          sx={{ fontSize: 20, fontWeight: 600, overflowWrap: 'anywhere' }}
        >
          {data
            ? showIp
              ? data.ip
              : '•••.•••.•••.•••'
            : isFetching
              ? '…'
              : '—'}
        </Typography>
        <IconButton
          size="small"
          aria-label={t(showIp ? 'redesign.hideIp' : 'redesign.showIp')}
          onClick={() => setShowIp(!showIp)}
        >
          {showIp ? (
            <VisibilityOffOutlined fontSize="small" />
          ) : (
            <VisibilityOutlined fontSize="small" />
          )}
        </IconButton>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {data
          ? [
              data.country,
              data.city,
              data.asn ? `AS${data.asn}` : data.asn_organization,
            ]
              .filter(Boolean)
              .join(' · ')
          : t(error ? 'redesign.ipUnavailable' : 'redesign.checkingIp')}
      </Typography>
    </Box>
  )
}

const HomePage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profiles, current } = useProfiles()
  const { proxyView } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const [chosenGroup, setChosenGroup] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const mode = clashConfig?.mode?.toLowerCase()
  const groups =
    !proxyView || mode === 'direct'
      ? []
      : mode === 'global'
        ? proxyView.global
          ? [proxyView.global]
          : []
        : proxyView.groups.filter(
            (group) =>
              !group.hidden &&
              ['Selector', 'URLTest', 'Fallback'].includes(group.type),
          )
  const group = groups.find((item) => item.name === chosenGroup) ?? groups[0]
  const extra = current?.extra
  const used = extra ? extra.upload + extra.download : 0
  const usage =
    extra && extra.total > 0 ? Math.min(100, (used / extra.total) * 100) : 0

  return (
    <BasePage
      title={t('redesign.connection')}
      header={
        <Button
          variant="outlined"
          size="small"
          onClick={() => navigate('/profile')}
          sx={{
            borderRadius: '999px',
            borderColor: 'divider',
            color: 'text.secondary',
            maxWidth: 300,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 7,
              height: 7,
              mr: 1,
              borderRadius: '50%',
              bgcolor: current ? 'primary.main' : 'text.disabled',
              flexShrink: 0,
            }}
          />
          <Typography noWrap variant="body2">
            {current?.name ?? t('profiles.page.actions.import')}
          </Typography>
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 2.5 }}>
        <ConnectionControls group={group} />
        <Box className="dashboard-grid">
          <TrafficCard />
          <ExitCard />
          <Box component="section" sx={cardStyle}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 1,
                mb: 1.75,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('redesign.subscriptionUsage')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {extra?.expire
                  ? dayjs(extra.expire * 1000).format('YYYY-MM-DD')
                  : '—'}
              </Typography>
            </Box>
            <Typography
              className="dashboard-mono"
              sx={{ fontSize: 20, fontWeight: 600, mb: 1.75 }}
            >
              {extra ? parseTraffic(used).join(' ') : '—'}{' '}
              <Typography
                component="span"
                color="text.secondary"
                sx={{ fontSize: 13 }}
              >
                /{' '}
                {extra && extra.total > 0
                  ? parseTraffic(extra.total).join(' ')
                  : '—'}
              </Typography>
            </Typography>
            <LinearProgress
              variant="determinate"
              value={usage}
              aria-label={t('redesign.subscriptionUsage')}
              sx={{ height: 8, borderRadius: 4 }}
            />
            {!extra && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1 }}
              >
                {t(current ? 'redesign.noUsage' : 'redesign.noProfile')}
              </Typography>
            )}
          </Box>
        </Box>
        <QuickNodes
          view={proxyView}
          group={group}
          groups={groups}
          onGroupChange={setChosenGroup}
        />
        <Accordion
          expanded={detailsOpen}
          onChange={(_, expanded) => setDetailsOpen(expanded)}
          disableGutters
          sx={{ bgcolor: 'transparent', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: 0 }}>
            <Typography variant="body2" color="text.secondary">
              {t('redesign.diagnostics')}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={`${profiles?.items?.filter((item) => item.type === 'remote' || item.type === 'local').length ?? 0} ${t('profiles.page.title')}`}
              sx={{ ml: 1.5 }}
            />
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {detailsOpen && (
              <Suspense fallback={<Skeleton height={200} />}>
                <EnhancedTrafficStats />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 2,
                    mt: 2,
                  }}
                >
                  <TestCard />
                  <ClashInfoCard />
                  <SystemInfoCard />
                </Box>
              </Suspense>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>
    </BasePage>
  )
}

export default HomePage
