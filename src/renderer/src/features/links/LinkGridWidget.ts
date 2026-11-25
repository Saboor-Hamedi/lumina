/**
 * Backwards-compatible re-export for `LinkWrapperWidget` (`LinkGridWidget.ts`).
 * Both standalone URLs and ` ```links ` grids share the unified `LinkWrapper`.
 */

export {
  LinkWrapperWidget as LinkGridWidget,
  createLinkWrapperElement,
  type LinkWrapperItem as LinkGridItem,
  type CreateLinkWrapperOptions
} from './LinkWrapper'
