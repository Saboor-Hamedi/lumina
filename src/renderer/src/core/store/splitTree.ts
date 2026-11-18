/**
 * splitTree.ts
 *
 * Pure binary split-tree helpers for VS Code-style multi-column & multi-row
 * workspace panes.
 */

export type WorkspacePaneId = string
export type SplitOrientation = 'vertical' | 'horizontal'
export type SplitPosition = 'before' | 'after'

export interface PaneState {
  id: WorkspacePaneId
  tabs: string[]
  activeTabId: string | null
}

export type SplitTreeNode =
  | { kind: 'leaf'; paneId: WorkspacePaneId }
  | {
      kind: 'split'
      id: string
      direction: SplitOrientation
      ratio: number
      first: SplitTreeNode
      second: SplitTreeNode
    }

let splitNodeCounter = 0

export function clampSplitRatio(ratio: number): number {
  return Math.min(0.85, Math.max(0.15, ratio))
}

export function collectLeafPaneIds(node: SplitTreeNode): WorkspacePaneId[] {
  if (node.kind === 'leaf') return [node.paneId]
  return [...collectLeafPaneIds(node.first), ...collectLeafPaneIds(node.second)]
}

export function splitLeafInTree(
  node: SplitTreeNode,
  targetPaneId: WorkspacePaneId,
  newPaneId: WorkspacePaneId,
  direction: SplitOrientation,
  position: SplitPosition = 'after'
): SplitTreeNode {
  if (node.kind === 'leaf') {
    if (node.paneId !== targetPaneId) return node
    const targetLeaf: SplitTreeNode = { kind: 'leaf', paneId: targetPaneId }
    const newLeaf: SplitTreeNode = { kind: 'leaf', paneId: newPaneId }
    return {
      kind: 'split',
      id: `split-${++splitNodeCounter}`,
      direction,
      ratio: 0.5,
      first: position === 'before' ? newLeaf : targetLeaf,
      second: position === 'before' ? targetLeaf : newLeaf
    }
  }

  const nextFirst = splitLeafInTree(node.first, targetPaneId, newPaneId, direction, position)
  const nextSecond =
    nextFirst === node.first
      ? splitLeafInTree(node.second, targetPaneId, newPaneId, direction, position)
      : node.second

  if (nextFirst === node.first && nextSecond === node.second) return node
  return { ...node, first: nextFirst, second: nextSecond }
}

export function removeLeafFromTree(
  node: SplitTreeNode,
  targetPaneId: WorkspacePaneId
): SplitTreeNode | null {
  if (node.kind === 'leaf') {
    return node.paneId === targetPaneId ? null : node
  }

  const nextFirst = removeLeafFromTree(node.first, targetPaneId)
  if (nextFirst === null) return node.second

  const nextSecond = removeLeafFromTree(node.second, targetPaneId)
  if (nextSecond === null) return node.first

  if (nextFirst === node.first && nextSecond === node.second) return node
  return { ...node, first: nextFirst, second: nextSecond }
}

export function updateSplitRatioInTree(
  node: SplitTreeNode,
  splitId: string,
  ratio: number
): SplitTreeNode {
  if (node.kind === 'leaf') return node
  const clamped = clampSplitRatio(ratio)
  if (node.id === splitId) {
    return { ...node, ratio: clamped }
  }
  const nextFirst = updateSplitRatioInTree(node.first, splitId, clamped)
  const nextSecond = updateSplitRatioInTree(node.second, splitId, clamped)
  if (nextFirst === node.first && nextSecond === node.second) return node
  return { ...node, first: nextFirst, second: nextSecond }
}

export function toggleSplitDirectionInTree(
  node: SplitTreeNode,
  targetPaneId: WorkspacePaneId
): SplitTreeNode {
  if (node.kind === 'leaf') return node
  const firstLeaves = collectLeafPaneIds(node.first)
  const secondLeaves = collectLeafPaneIds(node.second)
  const containsDirect =
    (node.first.kind === 'leaf' && node.first.paneId === targetPaneId) ||
    (node.second.kind === 'leaf' && node.second.paneId === targetPaneId)

  if (containsDirect) {
    return {
      ...node,
      direction: node.direction === 'vertical' ? 'horizontal' : 'vertical'
    }
  }

  if (firstLeaves.includes(targetPaneId)) {
    return { ...node, first: toggleSplitDirectionInTree(node.first, targetPaneId) }
  }
  if (secondLeaves.includes(targetPaneId)) {
    return { ...node, second: toggleSplitDirectionInTree(node.second, targetPaneId) }
  }
  return node
}
