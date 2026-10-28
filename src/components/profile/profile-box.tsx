import { alpha, Box, styled } from '@mui/material'

export const ProfileBox = styled(Box)(
  ({ theme, 'aria-selected': selected }) => ({
    position: 'relative',
    display: 'block',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '16px',
    boxSizing: 'border-box',
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.08)
      : theme.palette.background.paper,
    border: '1px solid',
    borderColor: selected
      ? alpha(theme.palette.primary.main, 0.55)
      : theme.palette.divider,
    borderRadius: '14px',
    color: theme.palette.text.secondary,
    '& h2': { color: theme.palette.text.primary },
  }),
)
