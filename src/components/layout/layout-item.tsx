import {
  alpha,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import type { ReactNode } from 'react'
import {
  useLocation,
  useMatch,
  useNavigate,
  useResolvedPath,
} from 'react-router'

import type { SortableItemRenderProps } from '@/components/base/sortable-item'
import { useVerge } from '@/hooks/use-verge'

interface Props {
  to: string
  children: string
  icon: ReactNode[]
  sortable?: SortableItemRenderProps
}
export const LayoutItem = (props: Props) => {
  const { to, children, icon, sortable } = props
  const { verge } = useVerge()
  const { menu_icon } = verge ?? {}
  const navCollapsed = verge?.collapse_navbar ?? false
  const resolved = useResolvedPath(to)
  const match = useMatch({ path: resolved.pathname, end: true })
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const selected =
    !!match ||
    (to === '/activity' &&
      ['/connections', '/logs', '/rules'].includes(pathname))

  const effectiveMenuIcon =
    navCollapsed && menu_icon === 'disable' ? 'monochrome' : menu_icon

  return (
    <ListItem
      ref={sortable?.ref}
      style={sortable?.style}
      sx={{ py: 0.5, maxWidth: 250, mx: 'auto', padding: '4px 0px' }}
    >
      <ListItemButton
        ref={sortable?.handleRef}
        selected={selected}
        aria-current={selected ? 'page' : undefined}
        sx={[
          {
            borderRadius: 2,
            marginLeft: 1.25,
            paddingLeft: 1,
            paddingRight: 1,
            marginRight: 1.25,
            cursor: 'pointer',
            '& .MuiListItemText-primary': {
              color: 'text.primary',
              fontWeight: selected ? 600 : 400,
            },
          },
          ({ palette: { mode, primary } }) => {
            const bgcolor =
              mode === 'light'
                ? alpha(primary.main, 0.15)
                : alpha(primary.main, 0.08)
            const color = mode === 'light' ? '#1f1f1f' : '#ffffff'
            return {
              '&.Mui-selected': { bgcolor },
              '&.Mui-selected:hover': { bgcolor },
              '&.Mui-selected .MuiListItemText-primary': { color },
            }
          },
        ]}
        title={navCollapsed ? children : undefined}
        aria-label={navCollapsed ? children : undefined}
        onClick={() => navigate(to)}
      >
        {(effectiveMenuIcon === 'monochrome' || !effectiveMenuIcon) && (
          <ListItemIcon
            sx={{
              marginLeft: 0,
              minWidth: 30,
              color: selected ? 'primary.main' : 'text.secondary',
              cursor: 'inherit',
            }}
          >
            {icon[0]}
          </ListItemIcon>
        )}
        {effectiveMenuIcon === 'colorful' && (
          <ListItemIcon sx={{ cursor: 'inherit' }}>{icon[1]}</ListItemIcon>
        )}
        <ListItemText
          sx={{
            textAlign: 'left',
            marginLeft: 0,
          }}
          primary={children}
        />
      </ListItemButton>
    </ListItem>
  )
}
