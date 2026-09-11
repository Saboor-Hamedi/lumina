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
}

export type EmailFolder = 'INBOX' | 'SENT' | 'DRAFT' | 'STARRED' | 'TRASH' | 'SPAM'

export interface EmailComposeDraft {
  to: string
  cc: string
  bcc: string
  subject: string
  bodyHtml: string
  attachments: EmailAttachment[]
}
