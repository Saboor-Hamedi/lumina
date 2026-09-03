import React, { useCallback, useMemo } from 'react'
import {
  ExternalLink,
  Edit2,
  Copy,
  Scissors,
  Clipboard,
  Star,
  StarOff,
  Trash2,
  FilePlus,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  Palette,
  Check,
  X
} from 'lucide-react'
import { useVaultStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useShallow } from 'zustand/react/shallow'



export function useContextMenu({ item, type, callbacks }) {
  const { saveSnippet, clipboard, setClipboard, snippets, folderColors, setFolderColor } =
    useVaultStore(
      useShallow((state) => ({
        saveSnippet: state.saveSnippet,
        clipboard: state.clipboard,
        setClipboard: state.setClipboard,
        snippets: state.snippets,
        folderColors: state.folderColors,
        setFolderColor: state.setFolderColor
      }))
    )

  const { togglePinnedFolder } = useSettingsStore(
    useShallow((state) => ({
      togglePinnedFolder: state.togglePinnedFolder
    }))
  )

  const handleCopy = useCallback(
    (e) => {
      e?.stopPropagation()
      if (type === 'file' && item) {
        setClipboard({ action: 'copy', item })
        callbacks.onClose?.()
      }
    },
    [type, item, setClipboard, callbacks]
  )

  const handleCut = useCallback(
    (e) => {
      e?.stopPropagation()
      if (type === 'file' && item) {
        setClipboard({ action: 'cut', item })
        callbacks.onClose?.()
      }
    },
    [type, item, setClipboard, callbacks]
  )

  const handlePaste = useCallback(
    async (e) => {
      e?.stopPropagation()
      if (!clipboard?.item) return

      try {
        const targetFolderId = type === 'folder' ? item : type === 'file' ? item.folderId : null

        if (clipboard.action === 'copy') {
          const generateId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
            return Math.random().toString(36).substring(2, 15)
          }

          let newTitle = `${clipboard.item.title} (Copy)`
          let counter = 1
          while (snippets.some((s) => s.title === newTitle && s.folderId === targetFolderId)) {
            newTitle = `${clipboard.item.title} (Copy ${++counter})`
          }

          const newSnippet = {
            ...clipboard.item,
            id: generateId(),
            title: newTitle,
            folderId: targetFolderId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          await saveSnippet(newSnippet)
        } else if (clipboard.action === 'cut') {
          await saveSnippet({
            ...clipboard.item,
            folderId: targetFolderId
          })
          setClipboard(null)
        }
      } catch (err) {
        console.error('Failed to paste note:', err)
      }
      callbacks.onClose?.()
    },
    [clipboard, type, item, snippets, saveSnippet, setClipboard, callbacks]
  )

  const colorPickerOption = useMemo(() => {
    let currentCol = null
    if (type === 'file' && item) {
      currentCol = item.color || null
    } else if (type === 'folder' && item) {
      currentCol = folderColors[item] || null
    }

    const colors = [
      { id: null, bg: 'var(--bg-panel)', border: '1px dashed var(--border-main)', title: 'Default (Reset)' },
      { id: '#60a5fa', bg: '#60a5fa', title: 'Blue' },
      { id: '#c084fc', bg: '#c084fc', title: 'Purple' },
      { id: '#f87171', bg: '#f87171', title: 'Red' },
      { id: '#4ade80', bg: '#4ade80', title: 'Green' },
      { id: '#fb923c', bg: '#fb923c', title: 'Orange' }
    ]

    return {
      label: 'Background',
      icon: <Palette size={14} />,
      children: colors.map((c) => ({
        id: c.id || 'default',
        label: c.title,
        icon: (
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: c.bg,
              border: c.border || '1px solid rgba(255, 255, 255, 0.1)'
            }}
          />
        ),
        isActive: () => currentCol === c.id,
        onClick: async () => {
          if (type === 'file' && item) {
            await saveSnippet({ ...item, color: c.id })
          } else if (type === 'folder' && item) {
            setFolderColor(item, c.id)
          }
          // Intentionally do not close menu to preview color
        }
      }))
    }
  }, [type, item, folderColors, saveSnippet, setFolderColor])

  const options = useMemo(() => {
    if (type === 'file') {
      return [
        {
          label: 'Open',
          shortcut: 'Ctrl+O',
          icon: <ExternalLink size={14} />,
          onClick: () => {
            if (window.api?.openFile) {
              window.api.openFile()
            }
            callbacks.onClose?.()
          }
        },
        {
          label: 'Reveal in File Explorer',
          shortcut: 'Ctrl+Shift+E',
          icon: <FolderOpen size={14} />,
          onClick: () => {
            if (window.api?.openVaultFolder) {
              const relativePath =
                type === 'file'
                  ? (item?.folderId ? item.folderId + '/' : '') + item?.fileName
                  : type === 'folder'
                    ? item
                    : undefined
              window.api.openVaultFolder(relativePath)
            }
            callbacks.onClose?.()
          }
        },
        {
          label: 'Rename',
          shortcut: 'Ctrl+R',
          icon: <Edit2 size={14} />,
          onClick: () => {
            callbacks.onRename?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'Change Icon',
          shortcut: 'Win + Shift + .',
          icon: <Palette size={14} />,
          onClick: () => {
            callbacks.onChangeIcon?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'Copy',
          icon: <Copy size={14} />,
          onClick: handleCopy
        },
        {
          label: 'Cut',
          icon: <Scissors size={14} />,
          onClick: handleCut
        },
        {
          label: 'Paste',
          icon: <Clipboard size={14} />,
          disabled: !clipboard || clipboard.item.itemType === 'folder',
          onClick: handlePaste
        },
        {
          label: item?.isPinned ? 'Remove from Favorites' : 'Add to Favorites',
          icon: item?.isPinned ? <Star size={14} fill="currentColor" /> : <Star size={14} />,
          onClick: () => {
            callbacks.onTogglePin?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'Delete',
          shortcut: 'Ctrl+Shift+D',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => {
            callbacks.onDelete?.()
            callbacks.onClose?.()
          }
        },
        { type: 'divider' },
        colorPickerOption,
        { type: 'divider' },
        {
          label: 'Close',
          icon: <X size={14} />,
          onClick: () => {
            callbacks.onCloseNote?.()
            callbacks.onClose?.()
          }
        }
      ]
    }

    if (type === 'folder' || type === 'body') {
      const isFolder = !!item // if item exists, it's a folder, otherwise it's the body
      return [
        {
          label: 'New Note',
          icon: <FilePlus size={14} />,
          onClick: () => {
            callbacks.onCreateNote?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'New Folder',
          icon: <FolderPlus size={14} />,
          onClick: () => {
            callbacks.onCreateFolder?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'Reveal in File Explorer',
          shortcut: 'Ctrl+Shift+E',
          icon: <FolderOpen size={14} />,
          onClick: () => {
            if (window.api?.openVaultFolder) {
              const relativePath =
                type === 'file'
                  ? (item?.folderId ? item.folderId + '/' : '') + item?.fileName
                  : type === 'folder'
                    ? item
                    : undefined
              window.api.openVaultFolder(relativePath)
            }
            callbacks.onClose?.()
          }
        },
        ...(isFolder
          ? [
              {
                label: 'Rename',
                shortcut: 'Ctrl+R',
                icon: <Edit2 size={14} />,
                onClick: () => {
                  callbacks.onRename?.()
                  callbacks.onClose?.()
                }
              }
            ]
          : []),
        {
          label: 'Paste',
          icon: <Clipboard size={14} />,
          disabled: !clipboard || clipboard.item.itemType === 'folder',
          onClick: handlePaste
        },
        ...(isFolder
          ? [
              {
                label: callbacks.isFolderPinned ? 'Unpin from Favorites' : 'Pin to Favorites',
                icon: callbacks.isFolderPinned ? (
                  <Star size={14} fill="currentColor" />
                ) : (
                  <Star size={14} />
                ),
                onClick: () => {
                  togglePinnedFolder(item)
                  callbacks.onClose?.()
                }
              },
              {
                label: 'Delete',
                shortcut: 'Ctrl+Shift+D',
                icon: <Trash2 size={14} />,
                danger: true,
                onClick: () => {
                  callbacks.onDelete?.()
                  callbacks.onClose?.()
                }
              },
              { type: 'divider' },
              colorPickerOption
            ]
          : [])
      ]
    }

    return []
  }, [
    type,
    item,
    clipboard,
    handleCopy,
    handleCut,
    handlePaste,
    callbacks,
    togglePinnedFolder,
    colorPickerOption
  ])

  return options
}
