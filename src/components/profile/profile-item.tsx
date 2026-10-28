import { useSortable } from '@dnd-kit/react/sortable'
import {
  CheckBoxOutlineBlankRounded,
  CheckBoxRounded,
  DragIndicatorRounded,
  EditOutlined,
  MoreHorizRounded,
  RadioButtonCheckedRounded,
  RadioButtonUncheckedRounded,
  RefreshRounded,
} from '@mui/icons-material'
import {
  Box,
  CircularProgress,
  Chip,
  IconButton,
  keyframes,
  LinearProgress,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import {
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { BaseDialog } from '@/components/base'
import { EditorViewer } from '@/components/profile/editor-viewer'
import { GroupsEditorViewer } from '@/components/profile/groups-editor-viewer'
import { RulesEditorViewer } from '@/components/profile/rules-editor-viewer'
import { useEditorDocument } from '@/hooks/use-editor-document'
import {
  getNextUpdateTime,
  readProfileFile,
  saveProfileFile,
  updateProfile,
  viewProfile,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import {
  useProfileLoadingCache,
  useSetProfileLoading,
} from '@/store/app-store-context'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import { debugLog } from '@/utils/debug'
import { isValidUrl } from '@/utils/network'
import { openExternalUrl } from '@/utils/open-external-url'
import parseTraffic from '@/utils/parse-traffic'

import { EnhanceHint } from './enhance-hint'
import { ProfileBox } from './profile-box'
import { ProxiesEditorViewer } from './proxies-editor-viewer'
import { QrViewer } from './qr-viewer'
const round = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

export interface ProfileItemProps {
  id: string
  index: number
  selected: boolean
  activating: boolean
  itemData: IProfileItem
  mutateProfiles: () => Promise<void>
  onSelect: (force: boolean) => void
  onEdit: () => void
  onSave?: (prev?: string, curr?: string) => void
  onDelete: () => void
  batchMode?: boolean
  isSelected?: boolean
  onSelectionChange?: () => void
  timerUpdateRevision: number
  completedUpdateRevision: number
}

const ProfileItemBase = (props: ProfileItemProps) => {
  const {
    id,
    index,
    selected,
    activating,
    itemData,
    mutateProfiles,
    onSelect,
    onEdit,
    onSave,
    onDelete,
    batchMode,
    isSelected,
    onSelectionChange,
    timerUpdateRevision,
    completedUpdateRevision,
  } = props

  const [element, setElement] = useState<Element | null>(null)
  const handleRef = useRef<HTMLButtonElement | null>(null)
  useSortable({
    id,
    index,
    element,
    handle: handleRef,
  })

  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const loadingCache = useProfileLoadingCache()
  const setProfileLoading = useSetProfileLoading()

  const [showNextUpdate, setShowNextUpdate] = useState(false)
  const showNextUpdateRef = useRef(false)
  const [nextUpdateTime, setNextUpdateTime] = useState('')
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const setLoading = useCallback(
    (loading: boolean) => {
      setProfileLoading([itemData.uid!], loading)
    },
    [itemData.uid, setProfileLoading],
  )

  const { uid, name = 'Profile', extra, updated = 0, option } = itemData

  const fetchNextUpdateTimeCallback = useCallback(
    async (forceRefresh = false) => {
      if (
        itemData.option?.update_interval &&
        itemData.option.update_interval > 0
      ) {
        try {
          debugLog(`尝试获取配置 ${itemData.uid} 的下次更新时间`)

          if (forceRefresh) {
            debugLog(`强制刷新定时器任务`)
          }

          const nextUpdate = await getNextUpdateTime(itemData.uid!)
          debugLog(`获取到下次更新时间结果:`, nextUpdate)

          if (nextUpdate) {
            const nextUpdateDate = dayjs(nextUpdate * 1000)
            const now = dayjs()

            if (nextUpdateDate.isBefore(now)) {
              setNextUpdateTime(
                t('profiles.components.profileItem.status.lastUpdateFailed'),
              )
            } else {
              const diffMinutes = nextUpdateDate.diff(now, 'minute')

              if (diffMinutes < 60) {
                if (diffMinutes <= 0) {
                  setNextUpdateTime(
                    `${t('profiles.components.profileItem.status.nextUp')} <1m`,
                  )
                } else {
                  setNextUpdateTime(
                    `${t('profiles.components.profileItem.status.nextUp')} ${diffMinutes}m`,
                  )
                }
              } else {
                const hours = Math.floor(diffMinutes / 60)
                const mins = diffMinutes % 60
                setNextUpdateTime(
                  `${t('profiles.components.profileItem.status.nextUp')} ${hours}h ${mins}m`,
                )
              }
            }
          } else {
            debugLog(`返回的下次更新时间为空`)
            setNextUpdateTime(
              t('profiles.components.profileItem.status.noSchedule'),
            )
          }
        } catch (err) {
          console.error(`获取下次更新时间出错:`, err)
          setNextUpdateTime(t('profiles.components.profileItem.status.unknown'))
        }
      } else {
        debugLog(`该配置未设置更新间隔或间隔为0`)
        setNextUpdateTime(
          t('profiles.components.profileItem.status.autoUpdateDisabled'),
        )
      }
    },
    [itemData.option?.update_interval, itemData.uid, t],
  )
  const fetchNextUpdateTime = useLockFn(fetchNextUpdateTimeCallback)

  const toggleUpdateTimeDisplay = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!showNextUpdate) {
      fetchNextUpdateTime()
    }

    setShowNextUpdate(!showNextUpdate)
  }

  useEffect(() => {
    showNextUpdateRef.current = showNextUpdate
  }, [showNextUpdate])

  useEffect(() => {
    if (showNextUpdate) {
      fetchNextUpdateTime()
    }
  }, [
    fetchNextUpdateTime,
    showNextUpdate,
    itemData.option?.update_interval,
    updated,
  ])

  useEffect(() => {
    if (timerUpdateRevision === 0 || !showNextUpdateRef.current) return

    if (refreshTimeoutRef.current !== undefined) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = window.setTimeout(() => {
      fetchNextUpdateTime(true)
    }, 1000)

    return () => {
      if (refreshTimeoutRef.current !== undefined) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [fetchNextUpdateTime, timerUpdateRevision])

  useEffect(() => {
    if (completedUpdateRevision === 0 || !showNextUpdateRef.current) return
    fetchNextUpdateTime()
  }, [completedUpdateRevision, fetchNextUpdateTime])

  const hasUrl = !!itemData.url
  const hasExtra = !!extra // only subscription url has extra info
  const hasHome = !!itemData.home // only subscription url has home page

  const { upload = 0, download = 0, total = 0 } = extra ?? {}
  const from = parseUrl(itemData.url!)
  const description = itemData.desc
  const expire = parseExpire(extra?.expire)
  const progress = Math.min(
    Math.round(((download + upload) * 100) / (total + 0.01)) + 1,
    100,
  )

  const loading = loadingCache.has(itemData.uid!)

  const [, forceRefresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => {
    if (!hasUrl) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const handler = () => {
      const now = Date.now()
      const lastUpdate = updated! * 1000
      if (now - lastUpdate >= 24 * 36e5) return

      const wait = now - lastUpdate >= 36e5 ? 30e5 : 5e4

      timer = setTimeout(() => {
        forceRefresh()
        handler()
      }, wait)
    }

    handler()

    return () => {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
    }
  }, [forceRefresh, hasUrl, updated])

  const [fileOpen, setFileOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [proxiesOpen, setProxiesOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const loadProfileDocument = useCallback(() => readProfileFile(uid!), [uid])
  const loadMergeDocument = useCallback(
    () => readProfileFile(option?.merge ?? ''),
    [option?.merge],
  )
  const loadScriptDocument = useCallback(
    () => readProfileFile(option?.script ?? ''),
    [option?.script],
  )

  const profileDocument = useEditorDocument({
    open: fileOpen,
    load: loadProfileDocument,
  })
  const mergeDocument = useEditorDocument({
    open: mergeOpen,
    load: loadMergeDocument,
  })
  const scriptDocument = useEditorDocument({
    open: scriptOpen,
    load: loadScriptDocument,
  })

  const onOpenHome = () => {
    setAnchorEl(null)
    if (!itemData.home) return
    void openExternalUrl(itemData.home).catch(showNotice.error)
  }

  const onEditInfo = () => {
    setAnchorEl(null)
    onEdit()
  }

  const onShareQrCode = () => {
    setAnchorEl(null)
    setQrOpen(true)
  }

  const onEditFile = () => {
    setAnchorEl(null)
    setFileOpen(true)
  }

  const onEditRules = () => {
    setAnchorEl(null)
    setRulesOpen(true)
  }

  const onEditProxies = () => {
    setAnchorEl(null)
    setProxiesOpen(true)
  }

  const onEditGroups = () => {
    setAnchorEl(null)
    setGroupsOpen(true)
  }

  const onEditMerge = () => {
    setAnchorEl(null)
    setMergeOpen(true)
  }

  const onEditScript = () => {
    setAnchorEl(null)
    setScriptOpen(true)
  }

  const onForceSelect = () => {
    setAnchorEl(null)
    onSelect(true)
  }

  const onOpenFile = useLockFn(async () => {
    setAnchorEl(null)
    try {
      await mutate(() => viewProfile(itemData.uid!), {
        id: 'view-profile',
        errorNotice: false,
      })
    } catch (err) {
      showNotice.error(err)
    }
  })

  /// 0 不使用任何代理
  /// 1 使用订阅好的代理
  /// 2 至少使用一个代理，根据订阅，如果没订阅，默认使用系统代理
  const onUpdate = useLockFn(async (type: 0 | 1 | 2): Promise<void> => {
    setAnchorEl(null)
    setLoading(true)

    const option: Partial<IProfileOption> = {}
    if (type === 0) {
      option.with_proxy = false
      option.self_proxy = false
    } else if (type === 2) {
      if (itemData.option?.self_proxy) {
        option.with_proxy = false
        option.self_proxy = true
      } else {
        option.with_proxy = true
        option.self_proxy = false
      }
    }

    try {
      const payload = Object.keys(option).length > 0 ? option : undefined
      await mutate(() => updateProfile(itemData.uid!, payload), {
        id: `update-profile:${itemData.uid}`,
        errorNotice: false,
      })

      void mutateProfiles()
    } catch {
    } finally {
      setLoading(false)
    }
  })

  type ContextMenuItem = {
    label: string
    handler: () => void
    disabled: boolean
  }

  const menuLabels: Record<string, TranslationKey> = {
    home: 'profiles.components.menu.home',
    select: 'profiles.components.menu.select',
    shareQrCode: 'profiles.components.menu.shareQrCode',
    editInfo: 'profiles.components.menu.editInfo',
    editFile: 'profiles.components.menu.editFile',
    editRules: 'profiles.components.menu.editRules',
    editProxies: 'profiles.components.menu.editProxies',
    editGroups: 'profiles.components.menu.editGroups',
    extendConfig: 'profiles.components.menu.extendConfig',
    extendScript: 'profiles.components.menu.extendScript',
    openFile: 'profiles.components.menu.openFile',
    update: 'profiles.components.menu.update',
    updateViaProxy: 'profiles.components.menu.updateViaProxy',
    delete: 'shared.actions.delete',
  } as const

  const urlModeMenu: ContextMenuItem[] = [
    ...(hasHome
      ? [
          {
            label: menuLabels.home,
            handler: onOpenHome,
            disabled: false,
          } satisfies ContextMenuItem,
        ]
      : []),
    {
      label: menuLabels.select,
      handler: onForceSelect,
      disabled: false,
    },
    {
      label: menuLabels.shareQrCode,
      handler: onShareQrCode,
      disabled: false,
    },
    {
      label: menuLabels.editInfo,
      handler: onEditInfo,
      disabled: false,
    },
    {
      label: menuLabels.editFile,
      handler: onEditFile,
      disabled: false,
    },
    {
      label: menuLabels.editRules,
      handler: onEditRules,
      disabled: !option?.rules,
    },
    {
      label: menuLabels.editProxies,
      handler: onEditProxies,
      disabled: !option?.proxies,
    },
    {
      label: menuLabels.editGroups,
      handler: onEditGroups,
      disabled: !option?.groups,
    },
    {
      label: menuLabels.extendConfig,
      handler: onEditMerge,
      disabled: !option?.merge,
    },
    {
      label: menuLabels.extendScript,
      handler: onEditScript,
      disabled: !option?.script,
    },
    {
      label: menuLabels.openFile,
      handler: onOpenFile,
      disabled: false,
    },
    {
      label: menuLabels.update,
      handler: () => onUpdate(0),
      disabled: false,
    },
    {
      label: menuLabels.updateViaProxy,
      handler: () => onUpdate(2),
      disabled: false,
    },
    {
      label: menuLabels.delete,
      handler: () => {
        setAnchorEl(null)
        if (batchMode) {
          if (onSelectionChange) {
            onSelectionChange()
          }
        } else {
          setConfirmOpen(true)
        }
      },
      disabled: false,
    },
  ]
  const fileModeMenu: ContextMenuItem[] = [
    {
      label: menuLabels.select,
      handler: onForceSelect,
      disabled: false,
    },
    {
      label: menuLabels.editInfo,
      handler: onEditInfo,
      disabled: false,
    },
    {
      label: menuLabels.editFile,
      handler: onEditFile,
      disabled: false,
    },
    {
      label: menuLabels.editRules,
      handler: onEditRules,
      disabled: !option?.rules,
    },
    {
      label: menuLabels.editProxies,
      handler: onEditProxies,
      disabled: !option?.proxies,
    },
    {
      label: menuLabels.editGroups,
      handler: onEditGroups,
      disabled: !option?.groups,
    },
    {
      label: menuLabels.extendConfig,
      handler: onEditMerge,
      disabled: !option?.merge,
    },
    {
      label: menuLabels.extendScript,
      handler: onEditScript,
      disabled: !option?.script,
    },
    {
      label: menuLabels.openFile,
      handler: onOpenFile,
      disabled: false,
    },
    {
      label: menuLabels.delete,
      handler: () => {
        setAnchorEl(null)
        if (batchMode) {
          if (onSelectionChange) {
            onSelectionChange()
          }
        } else {
          setConfirmOpen(true)
        }
      },
      disabled: false,
    },
  ]

  const handleSaveProfileDocument = useLockFn(async () => {
    const currentValue = profileDocument.value
    const result = await mutate(() => saveProfileFile(uid!, currentValue), {
      id: `save-profile-file:${uid}`,
      errorNotice: false,
    })
    if (!(result.ok && result.value === true)) {
      await profileDocument.reload()
      return
    }
    onSave?.(profileDocument.savedValue, currentValue)
    profileDocument.markSaved(currentValue)
  })

  const handleSaveMergeDocument = useLockFn(async () => {
    const mergeUid = option?.merge ?? ''
    const currentValue = mergeDocument.value
    const result = await mutate(() => saveProfileFile(mergeUid, currentValue), {
      id: `save-profile-file:${mergeUid}`,
      errorNotice: false,
    })
    if (!(result.ok && result.value === true)) {
      await mergeDocument.reload()
      return
    }
    onSave?.(mergeDocument.savedValue, currentValue)
    mergeDocument.markSaved(currentValue)
  })

  const handleSaveScriptDocument = useLockFn(async () => {
    const scriptUid = option?.script ?? ''
    const currentValue = scriptDocument.value
    const result = await mutate(
      () => saveProfileFile(scriptUid, currentValue),
      {
        id: `save-profile-file:${scriptUid}`,
        errorNotice: false,
      },
    )
    if (!(result.ok && result.value === true)) {
      await scriptDocument.reload()
      return
    }
    onSave?.(scriptDocument.savedValue, currentValue)
    scriptDocument.markSaved(currentValue)
  })

  return (
    <Box ref={setElement} sx={{ position: 'relative' }}>
      <ProfileBox
        aria-selected={selected}
        onContextMenu={(event) => {
          setPosition({ top: event.clientY, left: event.clientX })
          setAnchorEl(event.currentTarget)
          event.preventDefault()
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <IconButton
            ref={handleRef}
            size="small"
            aria-label={t('redesign.reorderProfile', {
              defaultValue: '调整订阅顺序',
            })}
            sx={{ cursor: 'grab', color: 'text.disabled', width: 20 }}
          >
            <DragIndicatorRounded fontSize="small" />
          </IconButton>
          <IconButton
            aria-label={`${t('profiles.components.menu.select')} ${name}`}
            aria-pressed={batchMode ? isSelected : selected}
            disabled={activating}
            onClick={() =>
              batchMode ? onSelectionChange?.() : onSelect(false)
            }
            color={selected || isSelected ? 'primary' : 'default'}
            sx={{ width: 40, height: 40 }}
          >
            {activating ? (
              <CircularProgress size={20} />
            ) : batchMode ? (
              isSelected ? (
                <CheckBoxRounded />
              ) : (
                <CheckBoxOutlineBlankRounded />
              )
            ) : selected ? (
              <RadioButtonCheckedRounded />
            ) : (
              <RadioButtonUncheckedRounded />
            )}
          </IconButton>
        </Box>
        <Box
          sx={{
            flex: '1 1 180px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Typography
              component="h2"
              noWrap
              title={name ?? undefined}
              sx={{ fontSize: 15, fontWeight: 600, maxWidth: '100%' }}
            >
              {name}
            </Typography>
            {selected && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={t('redesign.activeProfile', { defaultValue: '使用中' })}
                sx={{ height: 20, fontSize: 11, borderRadius: '6px' }}
              />
            )}
            <Chip
              size="small"
              label={
                hasUrl
                  ? t('redesign.remoteProfile', { defaultValue: '远程' })
                  : t('redesign.localProfile', { defaultValue: '本地' })
              }
              sx={{ height: 20, fontSize: 11, borderRadius: '6px' }}
            />
          </Box>
          {(description || hasUrl) && (
            <Typography
              noWrap
              title={description || from}
              sx={{ fontSize: 12 }}
            >
              {description || from}
            </Typography>
          )}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            {hasExtra && (
              <>
                <span title={t('shared.labels.usedTotal')}>
                  {parseTraffic(upload + download)} / {parseTraffic(total)}
                </span>
                <span title={t('shared.labels.expireTime')}>{expire}</span>
              </>
            )}
            {hasUrl ? (
              <Box
                component="button"
                onClick={toggleUpdateTimeDisplay}
                title={
                  showNextUpdate
                    ? t('profiles.components.profileItem.tooltips.showLast')
                    : t('profiles.components.profileItem.tooltips.showNext')
                }
                sx={{
                  background: 'none',
                  border: 0,
                  p: 0,
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {showNextUpdate
                  ? nextUpdateTime
                  : (updated ?? 0) > 0
                    ? `${t('shared.labels.updateAt')} ${dayjs((updated ?? 0) * 1000).fromNow()}`
                    : '—'}
              </Box>
            ) : (
              <span>{parseExpire(updated ?? 0)}</span>
            )}
          </Box>
          {hasExtra && total > 0 && (
            <LinearProgress
              variant="determinate"
              value={progress}
              color={progress > 70 ? 'warning' : 'primary'}
              sx={{ height: 6, borderRadius: 3, maxWidth: 360, mt: 0.5 }}
            />
          )}
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            ml: 'auto',
            '& .MuiIconButton-root': {
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '10px',
              width: 36,
              height: 36,
            },
          }}
        >
          {hasUrl && (
            <IconButton
              aria-label={`${t('shared.actions.refresh')} ${name}`}
              disabled={loading || activating}
              onClick={() => onUpdate(1)}
              sx={{
                '& svg': {
                  animation: loading ? `1s linear infinite ${round}` : 'none',
                },
              }}
            >
              <RefreshRounded fontSize="small" />
            </IconButton>
          )}
          <IconButton
            aria-label={`${t('shared.actions.edit')} ${name}`}
            onClick={onEditInfo}
          >
            <EditOutlined fontSize="small" />
          </IconButton>
          <IconButton
            aria-label={t('redesign.moreActions', { defaultValue: '更多操作' })}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              setPosition({ top: rect.bottom, left: rect.left })
              setAnchorEl(event.currentTarget)
            }}
          >
            <MoreHorizRounded fontSize="small" />
          </IconButton>
        </Box>
      </ProfileBox>

      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorPosition={position}
        anchorReference="anchorPosition"
        transitionDuration={225}
        slotProps={{ list: { sx: { py: 0.5 } } }}
        onContextMenu={(e) => {
          setAnchorEl(null)
          e.preventDefault()
        }}
      >
        {(hasUrl ? urlModeMenu : fileModeMenu).map((item) => (
          <MenuItem
            key={item.label}
            onClick={item.handler}
            disabled={item.disabled}
            sx={[
              {
                minWidth: 120,
              },
              (theme) => {
                return {
                  color:
                    item.label === menuLabels.delete
                      ? theme.palette.error.main
                      : undefined,
                }
              },
            ]}
            dense
          >
            {t(item.label)}
          </MenuItem>
        ))}
      </Menu>
      {fileOpen && (
        <EditorViewer
          open={true}
          value={profileDocument.value}
          language="yaml"
          path={`profile:${uid}.yaml`}
          loading={profileDocument.loading}
          dirty={profileDocument.dirty}
          onChange={profileDocument.setValue}
          onSave={handleSaveProfileDocument}
          onClose={() => setFileOpen(false)}
        />
      )}
      {rulesOpen && (
        <RulesEditorViewer
          groupsUid={option?.groups ?? ''}
          mergeUid={option?.merge ?? ''}
          profileUid={uid!}
          property={option?.rules ?? ''}
          open={true}
          onSave={onSave}
          onClose={() => setRulesOpen(false)}
        />
      )}
      {proxiesOpen && (
        <ProxiesEditorViewer
          profileUid={uid!}
          property={option?.proxies ?? ''}
          open={true}
          onSave={onSave}
          onClose={() => setProxiesOpen(false)}
        />
      )}
      {groupsOpen && (
        <GroupsEditorViewer
          mergeUid={option?.merge ?? ''}
          proxiesUid={option?.proxies ?? ''}
          profileUid={uid!}
          property={option?.groups ?? ''}
          open={true}
          onSave={onSave}
          onClose={() => {
            setGroupsOpen(false)
          }}
        />
      )}
      {mergeOpen && (
        <EditorViewer
          open={true}
          title={t('profiles.components.menu.extendConfig')}
          description={<EnhanceHint stage="profileMerge" />}
          value={mergeDocument.value}
          language="yaml"
          path={`merge:${option?.merge ?? ''}.yaml`}
          loading={mergeDocument.loading}
          dirty={mergeDocument.dirty}
          onChange={mergeDocument.setValue}
          onSave={handleSaveMergeDocument}
          onClose={() => setMergeOpen(false)}
        />
      )}
      {scriptOpen && (
        <EditorViewer
          open={true}
          title={t('profiles.components.menu.extendScript')}
          description={<EnhanceHint stage="profileScript" />}
          value={scriptDocument.value}
          language="javascript"
          path={`script:${option?.script ?? ''}.js`}
          loading={scriptDocument.loading}
          dirty={scriptDocument.dirty}
          onChange={scriptDocument.setValue}
          onSave={handleSaveScriptDocument}
          onClose={() => setScriptOpen(false)}
        />
      )}

      <BaseDialog
        title={t('profiles.modals.confirmDelete.title')}
        open={confirmOpen}
        okBtn={t('shared.actions.confirm')}
        cancelBtn={t('shared.actions.cancel')}
        contentSx={{ width: { xs: 320, sm: 420 }, userSelect: 'text' }}
        onCancel={() => setConfirmOpen(false)}
        onClose={() => setConfirmOpen(false)}
        onOk={() => {
          onDelete()
          setConfirmOpen(false)
        }}
      >
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {t('profiles.modals.confirmDelete.message')}
        </Typography>
      </BaseDialog>
      {qrOpen && itemData.url && (
        <QrViewer
          open={true}
          value={`${itemData.url}${itemData.url.includes('?') ? '&' : '?'}name=${encodeURIComponent(name!)}`}
          onClose={() => setQrOpen(false)}
        />
      )}
    </Box>
  )
}

export const ProfileItem = memo(ProfileItemBase)

function parseUrl(url?: string) {
  if (!url) return ''
  return isValidUrl(url) ? new URL(url).host : 'local file'
}

function parseExpire(expire?: number) {
  if (!expire) return '-'
  return dayjs(expire * 1000).format('YYYY-MM-DD')
}
