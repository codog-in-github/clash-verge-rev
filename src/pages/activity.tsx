import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

import ConnectionsPage from './connections'
import LogsPage from './logs'
import RulesPage from './rules'

const ActivityPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const requested =
    pathname === '/activity' ? params.get('tab') : pathname.slice(1)
  const tab =
    requested === 'logs' || requested === 'rules' ? requested : 'connections'

  return (
    <Box
      className="activity-page"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <Box
        component="header"
        data-tauri-drag-region="true"
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          px: 3,
          py: 2,
        }}
      >
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 700 }}>
          {t('redesign.activity')}
        </Typography>
        <Tabs
          value={tab}
          onChange={(_, value: string) => navigate(`/activity?tab=${value}`)}
          aria-label={t('redesign.activity')}
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            minHeight: 40,
            p: '3px',
            '& .MuiTabs-indicator': { display: 'none' },
            '& .MuiTab-root': {
              minHeight: 34,
              py: 0.5,
              minWidth: 72,
              borderRadius: 1,
              '&.Mui-selected': {
                bgcolor: 'action.selected',
                color: 'text.primary',
              },
            },
          }}
        >
          <Tab
            id="activity-connections"
            aria-controls="activity-panel"
            value="connections"
            label={t('connections.page.title')}
          />
          <Tab
            id="activity-logs"
            aria-controls="activity-panel"
            value="logs"
            label={t('logs.page.title')}
          />
          <Tab
            id="activity-rules"
            aria-controls="activity-panel"
            value="rules"
            label={t('rules.page.title')}
          />
        </Tabs>
      </Box>
      <Box
        id="activity-panel"
        role="tabpanel"
        aria-labelledby={`activity-${tab}`}
        className="activity-content"
        sx={{ flex: 1, minHeight: 0 }}
      >
        {tab === 'connections' ? (
          <ConnectionsPage />
        ) : tab === 'logs' ? (
          <LogsPage />
        ) : (
          <RulesPage />
        )}
      </Box>
    </Box>
  )
}

export default ActivityPage
