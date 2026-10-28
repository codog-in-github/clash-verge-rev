import {
  DeleteForeverRounded,
  PauseRounded,
  PlayArrowRounded,
  TableChartRounded,
  TableRowsRounded,
  ViewColumnRounded,
} from '@mui/icons-material'
import {
  Box,
  Button,
  ButtonGroup,
  Fab,
  IconButton,
  MenuItem,
  Tooltip,
  Zoom,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { closeAllConnections } from 'tauri-plugin-mihomo-api'

import {
  BaseEmpty,
  BasePage,
  BaseSearchBox,
  BaseStyledSelect,
  type SearchState,
  VirtualList,
} from '@/components/base'
import {
  ConnectionDetail,
  ConnectionDetailRef,
} from '@/components/connection/connection-detail'
import { ConnectionInspector } from '@/components/connection/connection-inspector'
import { ConnectionRowItem } from '@/components/connection/connection-row-item'
import {
  getConnectionStartTime,
  useConnectionRowViews,
} from '@/components/connection/connection-row-view'
import { ConnectionTable } from '@/components/connection/connection-table'
import { useConnectionData } from '@/hooks/use-connection-data'
import { useConnectionSetting } from '@/hooks/use-connection-setting'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useVisibility } from '@/hooks/use-visibility'
import { mutate } from '@/services/mutate'
import parseTraffic from '@/utils/parse-traffic'

type OrderFunc = (list: IConnectionsItem[]) => IConnectionsItem[]

const ORDER_OPTIONS = [
  {
    id: 'default',
    labelKey: 'connections.components.order.default',
    fn: (list: IConnectionsItem[]) =>
      list.sort(
        (a, b) => getConnectionStartTime(b) - getConnectionStartTime(a),
      ),
  },
  {
    id: 'uploadSpeed',
    labelKey: 'connections.components.order.uploadSpeed',
    fn: (list: IConnectionsItem[]) =>
      list.sort((a, b) => (b.curUpload ?? 0) - (a.curUpload ?? 0)),
  },
  {
    id: 'downloadSpeed',
    labelKey: 'connections.components.order.downloadSpeed',
    fn: (list: IConnectionsItem[]) =>
      list.sort((a, b) => (b.curDownload ?? 0) - (a.curDownload ?? 0)),
  },
] as const

type OrderKey = (typeof ORDER_OPTIONS)[number]['id']

const orderFunctionMap = ORDER_OPTIONS.reduce<Record<OrderKey, OrderFunc>>(
  (acc, option) => {
    acc[option.id] = option.fn
    return acc
  },
  {} as Record<OrderKey, OrderFunc>,
)

const EMPTY_CONNECTIONS: IConnectionsItem[] = []
const ConnectionsPage = () => {
  const { t } = useTranslation()
  const pageVisible = useVisibility()
  const wide = useMediaQuery('(min-width: 1100px)')
  const [selectedConnection, setSelectedConnection] =
    useState<IConnectionsItem | null>(null)
  const [match, setMatch] = useState<(input: string) => boolean>(
    () => () => true,
  )
  const [hasSearch, setHasSearch] = useState(false)
  const [curOrderOpt, setCurOrderOpt] = useState<OrderKey>('default')
  const [connectionsType, setConnectionsType] = useState<'active' | 'closed'>(
    'active',
  )

  const {
    response: { data: connections },
    clearClosedConnections,
  } = useConnectionData({ enabled: pageVisible })
  const {
    response: { data: traffic },
  } = useTrafficData({ enabled: pageVisible })

  const [pausedSnapshot, setPausedSnapshot] = useState<
    typeof connections | null
  >(null)
  const visibleConnections = pausedSnapshot ?? connections
  const activeDetail =
    selectedConnection &&
    visibleConnections?.activeConnections.find(
      ({ id }) => id === selectedConnection.id,
    )
  const closedDetail =
    selectedConnection &&
    visibleConnections?.closedConnections.find(
      ({ id }) => id === selectedConnection.id,
    )
  const detail = activeDetail || closedDetail || selectedConnection
  const detailClosed = !activeDetail
  const [setting, setSetting] = useConnectionSetting()

  const isTableLayout = setting.layout === 'table'

  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false)

  const selectedConnections =
    connectionsType === 'active'
      ? (visibleConnections?.activeConnections ?? EMPTY_CONNECTIONS)
      : (visibleConnections?.closedConnections ?? EMPTY_CONNECTIONS)

  const filterConn = useMemo(() => {
    const orderFunc = orderFunctionMap[curOrderOpt]

    if (isTableLayout && !hasSearch) return selectedConnections
    if (!hasSearch) return orderFunc([...selectedConnections])

    const matchConns = selectedConnections.filter((conn) => {
      const { host, destinationIP, process } = conn.metadata
      return (
        match(host || '') ||
        match(destinationIP || '') ||
        match(process || '') ||
        match(conn.rule) ||
        match(conn.rulePayload ?? '') ||
        match(conn.chains.join(' '))
      )
    })

    return orderFunc ? orderFunc(matchConns) : matchConns
  }, [selectedConnections, isTableLayout, hasSearch, match, curOrderOpt])

  const displayRows = useConnectionRowViews(
    isTableLayout ? EMPTY_CONNECTIONS : filterConn,
  )

  const detailRef = useRef<ConnectionDetailRef>(null!)

  const selectConnectionsType = useCallback(
    (type: 'active' | 'closed') => {
      if (type === connectionsType) return
      detailRef.current?.close()
      setSelectedConnection(null)
      setIsColumnManagerOpen(false)
      setConnectionsType(type)
    },
    [connectionsType],
  )

  const showDetailById = useCallback(
    (id: string) => {
      const connection = filterConn.find((item) => item.id === id)
      if (connection) {
        setSelectedConnection(connection)
        if (!wide)
          detailRef.current?.open(connection, connectionsType === 'closed')
      }
    },
    [connectionsType, filterConn, wide],
  )

  const onCloseAll = useLockFn(() =>
    mutate(() => closeAllConnections(), {
      id: 'close-all-connections',
      errorNotice: false,
    }),
  )

  const handleSearch = useCallback(
    (match: (content: string) => boolean, state: SearchState) => {
      setMatch(() => match)
      setHasSearch(state.text.length > 0)
    },
    [],
  )
  const hasTableData = filterConn.length > 0

  return (
    <BasePage
      full
      title={
        <span style={{ whiteSpace: 'nowrap' }}>
          {t('connections.page.title')}
        </span>
      }
      contentStyle={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '8px',
        minHeight: 0,
      }}
      header={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ mx: 1 }}>
            {t('shared.labels.downloaded')}:{' '}
            {parseTraffic(traffic?.downTotal || 0)}
          </Box>
          <Box sx={{ mx: 1 }}>
            {t('shared.labels.uploaded')}: {parseTraffic(traffic?.upTotal || 0)}
          </Box>
          <IconButton
            color="inherit"
            size="small"
            onClick={() =>
              setSetting((o) =>
                o?.layout !== 'table'
                  ? { ...o, layout: 'table' }
                  : { ...o, layout: 'list' },
              )
            }
          >
            {isTableLayout ? (
              <TableRowsRounded titleAccess={t('shared.actions.listView')} />
            ) : (
              <TableChartRounded titleAccess={t('shared.actions.tableView')} />
            )}
          </IconButton>
          <Button size="small" variant="contained" onClick={onCloseAll}>
            <span style={{ whiteSpace: 'nowrap' }}>
              {t('shared.actions.closeAll')}
            </span>
          </Button>
        </Box>
      }
    >
      <Box
        sx={{
          pt: 1,
          mb: 0.5,
          mx: '10px',
          minHeight: '36px',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          userSelect: 'text',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <ButtonGroup sx={{ mr: 1, flexBasis: 'content' }}>
          <Button
            size="small"
            variant={connectionsType === 'active' ? 'contained' : 'outlined'}
            onClick={() => selectConnectionsType('active')}
          >
            {t('connections.components.actions.active')}{' '}
            {visibleConnections?.activeConnections.length}
          </Button>
          <Button
            size="small"
            variant={connectionsType === 'closed' ? 'contained' : 'outlined'}
            onClick={() => selectConnectionsType('closed')}
          >
            {t('connections.components.actions.closed')}{' '}
            {visibleConnections?.closedConnections.length}
          </Button>
        </ButtonGroup>
        {!isTableLayout && (
          <BaseStyledSelect
            value={curOrderOpt}
            onChange={(e) => setCurOrderOpt(e.target.value as OrderKey)}
          >
            {ORDER_OPTIONS.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                <span style={{ fontSize: 14 }}>{t(option.labelKey)}</span>
              </MenuItem>
            ))}
          </BaseStyledSelect>
        )}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            '& > *': {
              flex: 1,
            },
          }}
        >
          <BaseSearchBox onSearch={handleSearch} />
        </Box>
        <IconButton
          aria-label={t(
            pausedSnapshot ? 'shared.actions.resume' : 'shared.actions.pause',
          )}
          title={t(
            pausedSnapshot ? 'shared.actions.resume' : 'shared.actions.pause',
          )}
          onClick={() =>
            setPausedSnapshot((current) => (current ? null : connections))
          }
        >
          {pausedSnapshot ? <PlayArrowRounded /> : <PauseRounded />}
        </IconButton>
        {isTableLayout && hasTableData && (
          <Tooltip title={t('connections.components.columnManager.title')}>
            <IconButton
              size="small"
              aria-label={t('connections.components.columnManager.title')}
              onClick={() => setIsColumnManagerOpen(true)}
              sx={{ flex: '0 0 auto' }}
            >
              <ViewColumnRounded fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 2.25,
          p: { xs: 1.25, md: 2.5 },
          pt: 1.5,
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '16px',
          }}
        >
          {!hasTableData ? (
            <BaseEmpty />
          ) : isTableLayout ? (
            <ConnectionTable
              connections={filterConn}
              onShowDetail={showDetailById}
              selectedId={selectedConnection?.id}
              columnManagerOpen={isColumnManagerOpen}
              onCloseColumnManager={() => setIsColumnManagerOpen(false)}
            />
          ) : (
            <VirtualList
              key={connectionsType}
              count={displayRows.length}
              estimateSize={56}
              renderItem={(i) => (
                <ConnectionRowItem
                  row={displayRows[i]}
                  selected={displayRows[i].id === selectedConnection?.id}
                  closed={connectionsType === 'closed'}
                  onShowDetail={showDetailById}
                />
              )}
              style={{
                flex: 1,
                borderRadius: '8px',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            />
          )}
        </Box>
        {wide && (
          <Box
            sx={{
              flex: '0 0 320px',
              minHeight: 0,
              overflowY: 'auto',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '16px',
            }}
          >
            {detail ? (
              <ConnectionInspector
                key={detail.id}
                data={detail}
                closed={detailClosed}
                onClose={() => setSelectedConnection(null)}
              />
            ) : (
              <Typography color="text.secondary" sx={{ p: 2.5, fontSize: 13 }}>
                {t('redesign.selectConnection')}
              </Typography>
            )}
          </Box>
        )}
      </Box>
      <ConnectionDetail ref={detailRef} />
      <Zoom
        in={connectionsType === 'closed' && filterConn.length > 0}
        unmountOnExit
      >
        <Fab
          size="medium"
          variant="extended"
          sx={{
            position: 'absolute',
            right: 16,
            bottom: isTableLayout ? 70 : 16,
          }}
          color="primary"
          onClick={() => {
            clearClosedConnections()
            setPausedSnapshot((current) =>
              current ? { ...current, closedConnections: [] } : null,
            )
            setSelectedConnection(null)
          }}
        >
          <DeleteForeverRounded sx={{ mr: 1 }} fontSize="small" />
          {t('shared.actions.clear')}
        </Fab>
      </Zoom>
    </BasePage>
  )
}

export default ConnectionsPage
