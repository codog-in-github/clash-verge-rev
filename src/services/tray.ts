import { getCurrentWindow } from '@tauri-apps/api/window'

import { openMainWindow as showMainWindow } from '@/services/cmds'
import { mutate } from '@/services/mutate'

export const hideTrayPanel = () => getCurrentWindow().hide()

export const openMainWindow = async () => {
  await mutate(showMainWindow, {
    id: 'open-main-window',
    errorNotice: false,
  })
  await hideTrayPanel()
}
