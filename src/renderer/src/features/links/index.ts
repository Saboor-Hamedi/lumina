export {
  MAX_URL_LENGTH,
  MAX_PATH_SEGMENTS,
  extractYouTubeId,
  extractYouTubeStartSeconds,
  buildYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  isHttpUrl,
  extractDomain,
  formatDisplayUrl,
  detectLinkPlatform,
  formatHostnameTitle,
  normalizeLinkTitle,
  normalizeSiteName,
  resolveLinkDescription,
  parseStandaloneLinkLine,
  parseGridLinkLine,
  type LinkPlatform,
  type StandaloneLinkMatch
} from './urlParser'

export {
  DEFAULT_LINK_CARD_SETTINGS,
  LINK_CARDS_CONFIG_EVENT,
  resolveLinkCardSettings,
  applyLinkCardDomAttributes,
  type LinkCardSettings,
  type LinkCardStyle,
  type LinkCardWidth,
  type LinkCardSize,
  type LinkCardThumbnailPosition,
  type LinkCardColumns
} from './linkCardConfig'

export {
  fetchLinkMetadata,
  getCachedLinkMetadata,
  clearLinkMetadataCache,
  type LinkMetadata
} from './linkMetadata'

export {
  openYouTubeModal,
  openMediaPeekModal,
  closeYouTubeModal,
  openExternalUrl,
  handleExternalLinkClick,
  type MediaPeekOptions
} from './mediaModal'

export { computeSmartPopoverPosition, inlineLinkHoverExtension } from './linkHoverCard'
export { LinkCardWidget, createLinkCardElement } from './LinkCardWidget'
export {
  LinkWrapperWidget,
  createLinkWrapperElement,
  type LinkWrapperItem,
  type CreateLinkWrapperOptions
} from './LinkWrapper'
export { LinkGridWidget, type LinkGridItem } from './LinkGridWidget'
export { linkEmbedExtension, parseLinkGridHeader } from './linkEmbedExtension'
