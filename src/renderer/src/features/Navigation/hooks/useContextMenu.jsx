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
  Check,
  X
} from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useShallow } from 'zustand/react/shallow'

export function useContextMenu({ item, type, callbacks }) {
  const {
    saveSnippet,
    clipboard,
    setClipboard,
    snippets,
    folderColors,
    setFolderColor
  } = useVaultStore(
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
        const targetFolderId = type === 'folder' ? item : (type === 'file' ? item.folderId : null)

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

  const renderColorPicker = useCallback(
    (onClose) => {
      let currentCol = null
      if (type === 'file' && item) {
        currentCol = item.color || null
      } else if (type === 'folder' && item) {
        currentCol = folderColors[item] || null
      }

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            gap: '6px'
          }}
        >
          {[
            {
              id: null,
              bg: 'var(--bg-panel)',
              border: '1px dashed var(--border-main)',
              title: 'Default Color (Reset)'
            },
            { id: 'rgba(59, 130, 246, 0.2)', bg: 'rgba(59, 130, 246, 0.5)', title: 'Blue' },
            { id: 'rgba(168, 85, 247, 0.2)', bg: 'rgba(168, 85, 247, 0.5)', title: 'Purple' },
            { id: 'rgba(239, 68, 68, 0.2)', bg: 'rgba(239, 68, 68, 0.5)', title: 'Red' },
            { id: 'rgba(34, 197, 94, 0.2)', bg: 'rgba(34, 197, 94, 0.5)', title: 'Green' },
            { id: 'rgba(249, 115, 22, 0.2)', bg: 'rgba(249, 115, 22, 0.5)', title: 'Orange' }
          ].map((c, idx) => {
            const isSelected = currentCol === c.id
            return (
              <div
                key={idx}
                onClick={async (e) => {
                  e.stopPropagation()
                  if (type === 'file' && item) {
                    await saveSnippet({ ...item, color: c.id })
                  } else if (type === 'folder' && item) {
                    setFolderColor(item, c.id)
                  }
                  onClose()
                  callbacks.onClose?.()
                }}
                title={c.title}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  background: c.bg,
                  border: isSelected
                    ? '2px solid #10b981'
                    : c.border || '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {isSelected ? (
                  <Check size={12} color="#10b981" strokeWidth={3} />
                ) : (
                  c.id === null && <X size={12} color="var(--text-faint)" />
                )}
              </div>
            )
          })}
        </div>
      )
    },
    [type, item, folderColors, saveSnippet, setFolderColor, callbacks]
  )

  const options = useMemo(() => {
    if (type === 'file') {
      return [
        {
          label: 'Open',
          icon: <ExternalLink size={14} />,
          onClick: (e) => {
            callbacks.onOpen?.(e)
            callbacks.onClose?.()
          }
        },
        {
          label: 'Rename',
          icon: <Edit2 size={14} />,
          onClick: () => {
            callbacks.onRename?.()
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
          icon: item?.isPinned ? <StarOff size={14} /> : <Star size={14} />,
          onClick: () => {
            callbacks.onTogglePin?.()
            callbacks.onClose?.()
          }
        },
        { type: 'divider' },
        {
          label: 'Delete',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => {
            callbacks.onDelete?.()
            callbacks.onClose?.()
          }
        },
        { type: 'divider' },
        {
          type: 'custom',
          render: renderColorPicker
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
        ...(isFolder
          ? [
              {
                label: 'Rename',
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
                icon: callbacks.isFolderPinned ? <StarOff size={14} /> : <Star size={14} />,
                onClick: () => {
                  togglePinnedFolder(item)
                  callbacks.onClose?.()
                }
              },
              { type: 'divider' },
              {
                label: 'Delete',
                icon: <Trash2 size={14} />,
                danger: true,
                onClick: () => {
                  callbacks.onDelete?.()
                  callbacks.onClose?.()
                }
              },
              { type: 'divider' },
              {
                type: 'custom',
                render: renderColorPicker
              }
            ]
          : [])
      ]
    }

    return []
  }, [type, item, clipboard, handleCopy, handleCut, handlePaste, callbacks, togglePinnedFolder, renderColorPicker])

  return options
}
