import { Dialog } from '@mui/material'
import { useCallback, useImperativeHandle, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'

import { ConnectionInspector } from './connection-inspector'

export interface ConnectionDetailRef {
  open: (detail: IConnectionsItem, closed: boolean) => void
  close: () => void
}

export function ConnectionDetail({ ref }: { ref?: Ref<ConnectionDetailRef> }) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<IConnectionsItem | null>(null)
  const [closed, setClosed] = useState(false)
  const onClose = useCallback(() => setDetail(null), [])

  useImperativeHandle(ref, () => ({
    open: (detail: IConnectionsItem, closed: boolean) => {
      setDetail(detail)
      setClosed(closed)
    },
    close: onClose,
  }))

  return (
    <Dialog
      open={detail !== null}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-label={t('redesign.connectionDetails')}
    >
      {detail && (
        <ConnectionInspector
          key={detail.id}
          data={detail}
          closed={closed}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}
