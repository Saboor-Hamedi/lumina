import React, { useCallback, useMemo } from 'react'
import {
  ExternalLink,
  Edit2,
  Copy,
  Scissors,
  Clipboard,
  Star,
  Trash2,
  FilePlus,
  FolderPlus,
  FolderOpen,
  Palette,
  X,
  Sparkles,
  CloudUpload,
  Download,
  Upload
} from 'lucide-react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { useShallow } from 'zustand/react/shallow'
import { summarizeNotes } from '../../AI/services/summarizeNotes'

export interface ContextMenuCallbacks {
  onOpen?: () => void
  onRename?: () => void
  onChangeIcon?: () => void
  onTogglePin?: () => void
  onDelete?: () => void
  onCloseNote?: () => void
  onCreateNote?: () => void
  onCreateFolder?: () => void
  onExport?: () => void
  onImport?: () => void
  onSummary?: () => void
  onClose?: () => void
  isFolderPinned?: boolean
}

export interface UseContextMenuProps {
  item: any
  type: 'file' | 'folder' | 'body'
  callbacks: ContextMenuCallbacks
}

export function useContextMenu({ item, type, callbacks }: UseContextMenuProps) {
  const effectiveType = type === 'folder' && !item ? 'body' : type
  const { saveSnippet, clipboard, setClipboard, snippets, folderColors, setFolderColor, loadWorkspace } =
    useWorkspaceStore(
      useShallow((state: any) => ({
        saveSnippet: state.saveNote || state.saveSnippet,
        clipboard: state.clipboard,
        setClipboard: state.setClipboard,
        snippets: state.notes || state.snippets || [],
        folderColors: state.folderColors || {},
        setFolderColor: state.setFolderColor,
        loadWorkspace: state.loadWorkspace
      }))
    )

  const { togglePinnedFolder, googleUser } = useSettingsStore(
    useShallow((state: any) => ({
      togglePinnedFolder: state.togglePinnedFolder,
      googleUser: state.settings?.googleUser
    }))
  )

  const handleCopy = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (effectiveType === 'file' && item) {
        setClipboard({ action: 'copy', item })
        callbacks.onClose?.()
      } else if (effectiveType === 'folder' && item) {
        setClipboard({ action: 'copy', item: { itemType: 'folder', folderId: item } })
        callbacks.onClose?.()
      }
    },
    [effectiveType, item, setClipboard, callbacks]
  )

  const handleCut = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (effectiveType === 'file' && item) {
        setClipboard({ action: 'cut', item })
        callbacks.onClose?.()
      }
    },
    [effectiveType, item, setClipboard, callbacks]
  )

  const handlePaste = useCallback(
    async (e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (!clipboard?.item) return

      try {
        const targetFolderId = effectiveType === 'folder' ? item : effectiveType === 'file' ? item.folderId : null

        if (clipboard.action === 'copy') {
          const generateId = () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
            return Math.random().toString(36).substring(2, 15)
          }

          let newTitle = `${clipboard.item.title || 'Note'} (Copy)`
          let counter = 1
          while (snippets.some((s: any) => s.title === newTitle && s.folderId === targetFolderId)) {
            newTitle = `${clipboard.item.title || 'Note'} (Copy ${++counter})`
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
    [clipboard, effectiveType, item, snippets, saveSnippet, setClipboard, callbacks]
  )

  const handleDefaultImport = useCallback(async () => {
    const targetFolderId = effectiveType === 'folder' ? item : effectiveType === 'file' ? item?.folderId : null
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.style.display = 'none'
    input.onchange = async (e: any) => {
      const files: File[] = Array.from(e.target?.files || [])
      if (files.length === 0) return
      try {
        const api = (window as any).api
        const paths = files
          .map((f: any) => api?.getPathForFile?.(f) || (f as any).path)
          .filter(Boolean)
        if (paths.length > 0 && api?.importExternalPaths) {
          await api.importExternalPaths(paths, targetFolderId || null)
        } else {
          for (const file of files) {
            const text = await file.text()
            const title = file.name.replace(/\.[^/.]+$/, '')
            await saveSnippet({
              id:
                typeof crypto !== 'undefined' && crypto.randomUUID
                  ? crypto.randomUUID()
                  : Math.random().toString(36).slice(2),
              title,
              code: text,
              folderId: targetFolderId || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            })
          }
        }
        await loadWorkspace?.()
      } catch (err) {
        console.error('Import failed:', err)
      }
    }
    document.body.appendChild(input)
    input.click()
    setTimeout(() => input.remove(), 1000)
    callbacks.onClose?.()
  }, [effectiveType, item, saveSnippet, loadWorkspace, callbacks])

  const colorPickerOption = useMemo(() => {
    let currentCol: string | null = null
    if (effectiveType === 'file' && item) {
      currentCol = item.color || null
    } else if (effectiveType === 'folder' && item) {
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
          if (effectiveType === 'file' && item) {
            await saveSnippet({ ...item, color: c.id })
          } else if (effectiveType === 'folder' && item) {
            setFolderColor(item, c.id)
          }
          callbacks.onClose?.()
        }
      }))
    }
  }, [effectiveType, item, folderColors, saveSnippet, setFolderColor, callbacks])

  const options = useMemo(() => {
    // ── File / Note Menu ────────────────────────────────────────────────────
    if (effectiveType === 'file') {
      return [
        {
          label: 'Open',
          shortcut: 'Enter',
          icon: <ExternalLink size={14} />,
          onClick: () => {
            const api = (window as any).api
            if (api?.openFile) {
              api.openFile()
            }
            callbacks.onOpen?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'Summary',
          icon: <Sparkles size={14} className="text-primary" />,
          onClick: () => {
            callbacks.onClose?.()
            if (callbacks.onSummary) {
              callbacks.onSummary()
            } else {
              summarizeNotes(item)
            }
          }
        },
        { type: 'divider' },
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
          label: 'Copy',
          shortcut: 'Ctrl+C',
          icon: <Copy size={14} />,
          onClick: handleCopy
        },
        {
          label: 'Cut',
          shortcut: 'Ctrl+X',
          icon: <Scissors size={14} />,
          onClick: handleCut
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          icon: <Clipboard size={14} />,
          disabled: !clipboard,
          onClick: handlePaste
        },
        { type: 'divider' },
        {
          label: 'Reveal in File Explorer',
          shortcut: 'Ctrl+Shift+E',
          icon: <FolderOpen size={14} />,
          onClick: () => {
            const api = (window as any).api
            if (api?.openVaultFolder) {
              const relativePath = (item?.folderId ? item.folderId + '/' : '') + (item?.fileName || '')
              api.openVaultFolder(relativePath)
            }
            callbacks.onClose?.()
          }
        },
        { type: 'divider' },
        colorPickerOption,
        {
          label: 'Export',
          icon: <Download size={14} />,
          onClick: () => {
            callbacks.onExport?.()
            callbacks.onClose?.()
          }
        },
        ...(googleUser
          ? [
              {
                label: 'Push to Google Drive',
                icon: <CloudUpload size={14} />,
                onClick: async () => {
                  callbacks.onClose?.()
                  const noteName = item?.title || item?.fileName || 'note'
                  try {
                    window.dispatchEvent(
                      new CustomEvent('show-toast', {
                        detail: { message: `Pushing "${noteName}" to Google Drive...`, type: 'info' }
                      })
                    )
                    const api = (window as any).api
                    const res = await api?.backupFile(item)
                    if (res?.success) {
                      window.dispatchEvent(
                        new CustomEvent('show-toast', {
                          detail: { message: 'Successfully backed up', type: 'success' }
                        })
                      )
                    } else {
                      window.dispatchEvent(
                        new CustomEvent('show-toast', {
                          detail: { message: `❌ ${res?.error || 'Push failed'}`, type: 'error' }
                        })
                      )
                    }
                  } catch (err: any) {
                    window.dispatchEvent(
                      new CustomEvent('show-toast', {
                        detail: { message: `❌ ${err?.message || 'Push failed'}`, type: 'error' }
                      })
                    )
                  }
                }
              }
            ]
          : []),
        { type: 'divider' },
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

    // ── Folder Menu ─────────────────────────────────────────────────────────
    if (effectiveType === 'folder') {
      return [
        {
          label: 'New Note',
          shortcut: 'Ctrl+N',
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
          label: 'Rename',
          shortcut: 'Ctrl+R',
          icon: <Edit2 size={14} />,
          onClick: () => {
            callbacks.onRename?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'Copy',
          shortcut: 'Ctrl+C',
          icon: <Copy size={14} />,
          onClick: handleCopy
        },
        {
          label: 'Paste',
          shortcut: 'Ctrl+V',
          icon: <Clipboard size={14} />,
          disabled: !clipboard,
          onClick: handlePaste
        },
        { type: 'divider' },
        {
          label: 'Reveal in File Explorer',
          shortcut: 'Ctrl+Shift+E',
          icon: <FolderOpen size={14} />,
          onClick: () => {
            const api = (window as any).api
            if (api?.openVaultFolder) {
              api.openVaultFolder(item)
            }
            callbacks.onClose?.()
          }
        },
        {
          label: 'Summary',
          icon: <Sparkles size={14} className="text-primary" />,
          onClick: () => {
            callbacks.onSummary?.()
            callbacks.onClose?.()
          }
        },
        { type: 'divider' },
        colorPickerOption,
        {
          label: 'Export',
          icon: <Download size={14} />,
          onClick: () => {
            callbacks.onExport?.()
            callbacks.onClose?.()
          }
        },
        {
          label: 'Import',
          icon: <Upload size={14} />,
          onClick: () => {
            if (callbacks.onImport) {
              callbacks.onImport()
            } else {
              handleDefaultImport()
            }
          }
        },
        { type: 'divider' },
        {
          label: 'Delete',
          shortcut: 'Ctrl+Shift+D',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => {
            callbacks.onDelete?.()
            callbacks.onClose?.()
          }
        }
      ]
    }

    // ── Body / Root Background Menu ─────────────────────────────────────────
    if (effectiveType === 'body') {
      return [
        {
          label: 'New Note',
          shortcut: 'Ctrl+N',
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
          label: 'Paste',
          shortcut: 'Ctrl+V',
          icon: <Clipboard size={14} />,
          disabled: !clipboard,
          onClick: handlePaste
        },
        { type: 'divider' },
        {
          label: 'Reveal in File Explorer',
          shortcut: 'Ctrl+Shift+E',
          icon: <FolderOpen size={14} />,
          onClick: () => {
            const api = (window as any).api
            if (api?.openVaultFolder) {
              api.openVaultFolder(undefined)
            }
            callbacks.onClose?.()
          }
        },
        { type: 'divider' },
        {
          label: 'Import',
          icon: <Upload size={14} />,
          onClick: () => {
            if (callbacks.onImport) {
              callbacks.onImport()
            } else {
              handleDefaultImport()
            }
          }
        }
      ]
    }

    return []
  }, [
    effectiveType,
    item,
    clipboard,
    handleCopy,
    handleCut,
    handlePaste,
    handleDefaultImport,
    callbacks,
    colorPickerOption,
    googleUser
  ])

  return options
}

export default useContextMenu
