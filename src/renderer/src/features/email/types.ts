export interface EmailAttachment {
  filename: string
  mimeType: string
  size: number
  attachmentId?: string | null
  base64Content?: string
}

export interface EmailMessageSummary {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  from: string
  subject: string
  date: string
  timestamp: number
  isUnread: boolean
  isStarred: boolean
}

export interface EmailMessageDetails extends EmailMessageSummary {
  to: string
  cc: string
  bodyHtml: string
  attachments: EmailAttachment[]
  messageIdHeader?: string
  referencesHeader?: string
}

export type EmailFolder =
  | 'INBOX'
  | 'ALL'
  | 'STARRED'
  | 'IMPORTANT'
  | 'SENT'
  | 'DRAFT'
  | 'CATEGORY_PROMOTIONS'
  | 'CATEGORY_SOCIAL'
  | 'CATEGORY_UPDATES'
  | 'CATEGORY_FORUMS'
  | 'SPAM'
  | 'TRASH'
  | string

export interface EmailLabelItem {
  id: string
  name: string
  type: 'system' | 'user'
  messagesTotal?: number
  messagesUnread?: number
  color?: {
    textColor?: string
    backgroundColor?: string
  }
}

export interface EmailComposeDraft {
  to: string
  cc: string
  bcc: string
  subject: string
  bodyHtml: string
  attachments: EmailAttachment[]
  threadId?: string | null
  inReplyTo?: string
  references?: string
  quotedText?: string
}
