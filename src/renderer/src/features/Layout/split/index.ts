/**
 * Split-View System Barrel (`features/Layout/split/index.ts`)
 *
 * Isolates all multi-pane split tree rendering, drag-to-split geometry,
 * and split-pane styling from the main application shell.
 */

export { SplitNodeRenderer } from './SplitNodeRenderer'
export type { SplitNodeRendererProps } from './SplitNodeRenderer'
export {
  useTabDragStore,
  resolveDropZoneInRect,
  computePaneDropTarget,
  type DropZonePosition,
  type TabDropTarget
} from '../tabDragDrop'
