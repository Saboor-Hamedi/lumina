/**
 * Link & YouTube Card user customization configuration (`linkCardConfig.ts`).
 * Applies lightweight `data-link-card-*` DOM attributes for instant zero-lag CSS updates.
 */

export type LinkCardStyle = 'strip' | 'card' | 'minimal'
export type LinkCardWidth = 'full' | 'medium' | 'compact'
export type LinkCardSize = 'compact' | 'default' | 'large'
export type LinkCardThumbnailPosition = 'right' | 'left' | 'hidden'
export type LinkCardColumns = 1 | 2 | 3

export interface LinkCardSettings {
  linkCardsEnabled: boolean
  linkCardStyle: LinkCardStyle
  linkCardWidth: LinkCardWidth
  linkCardSize: LinkCardSize
  linkCardThumbnailPosition: LinkCardThumbnailPosition
  linkCardColumns: LinkCardColumns
  linkCardShowDescription: boolean
  youtubeOpenInModal: boolean
}

export const DEFAULT_LINK_CARD_SETTINGS: LinkCardSettings = {
  linkCardsEnabled: true,
  linkCardStyle: 'strip',
  linkCardWidth: 'full',
  linkCardSize: 'default',
  linkCardThumbnailPosition: 'right',
  linkCardColumns: 1,
  linkCardShowDescription: true,
  youtubeOpenInModal: true
}

export const LINK_CARDS_CONFIG_EVENT = 'lumina-link-cards-config-changed'

export function resolveLinkCardSettings(
  raw?: Partial<Record<string, any>> | null
): LinkCardSettings {
  const style = raw?.linkCardStyle
  const width = raw?.linkCardWidth
  const size = raw?.linkCardSize
  const thumb = raw?.linkCardThumbnailPosition
  const cols = Number(raw?.linkCardColumns)

  return {
    linkCardsEnabled:
      typeof raw?.linkCardsEnabled === 'boolean'
        ? raw.linkCardsEnabled
        : DEFAULT_LINK_CARD_SETTINGS.linkCardsEnabled,
    linkCardStyle:
      style === 'strip' || style === 'card' || style === 'minimal'
        ? style
        : DEFAULT_LINK_CARD_SETTINGS.linkCardStyle,
    linkCardWidth:
      width === 'full' || width === 'medium' || width === 'compact'
        ? width
        : DEFAULT_LINK_CARD_SETTINGS.linkCardWidth,
    linkCardSize:
      size === 'compact' || size === 'default' || size === 'large'
        ? size
        : DEFAULT_LINK_CARD_SETTINGS.linkCardSize,
    linkCardThumbnailPosition:
      thumb === 'right' || thumb === 'left' || thumb === 'hidden'
        ? thumb
        : DEFAULT_LINK_CARD_SETTINGS.linkCardThumbnailPosition,
    linkCardColumns:
      cols === 1 || cols === 2 || cols === 3
        ? (cols as LinkCardColumns)
        : cols > 3
          ? 3
          : DEFAULT_LINK_CARD_SETTINGS.linkCardColumns,
    linkCardShowDescription:
      typeof raw?.linkCardShowDescription === 'boolean'
        ? raw.linkCardShowDescription
        : DEFAULT_LINK_CARD_SETTINGS.linkCardShowDescription,
    youtubeOpenInModal:
      typeof raw?.youtubeOpenInModal === 'boolean'
        ? raw.youtubeOpenInModal
        : DEFAULT_LINK_CARD_SETTINGS.youtubeOpenInModal
  }
}

export function applyLinkCardDomAttributes(
  raw?: Partial<Record<string, any>> | null
): void {
  if (typeof document === 'undefined') return
  const cfg = resolveLinkCardSettings(raw)
  const root = document.documentElement
  root.setAttribute('data-link-card-style', cfg.linkCardStyle)
  root.setAttribute('data-link-card-width', cfg.linkCardWidth)
  root.setAttribute('data-link-card-size', cfg.linkCardSize)
  root.setAttribute('data-link-card-thumb', cfg.linkCardThumbnailPosition)
  root.setAttribute('data-link-card-desc', cfg.linkCardShowDescription ? 'show' : 'hide')
}
