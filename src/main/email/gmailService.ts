import { net, ipcMain, dialog, Notification, BrowserWindow, app } from 'electron'
import SettingsManager from '../settings'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'

// Declare __dirname if TypeScript environment doesn't have it natively in module scope
declare const __dirname: string

/**
 * Authenticated Google User representation
 */
export interface GmailUser {
  email: string
  name?: string
  token: string
  refreshToken?: string
  clientId?: string
  picture?: string
  [key: string]: unknown
}

/**
 * Email Attachment structure
 */
export interface EmailAttachment {
  filename: string
  mimeType: string
  size: number
  attachmentId?: string | null
  base64Content?: string
}

/**
 * Parameters for building an RFC 2822 MIME message
 */
export interface MimeMessageParams {
  from: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject?: string
  bodyHtml?: string
  attachments?: EmailAttachment[]
  inReplyTo?: string
  references?: string
}

/**
 * Summary of an email for list display
 */
export interface MessageSummary {
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

/**
 * Full details of a single email message
 */
export interface MessageDetails {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  from: string
  to: string
  cc: string
  subject: string
  date: string
  timestamp: number
  bodyHtml: string
  attachments: EmailAttachment[]
  isUnread: boolean
  isStarred: boolean
  messageIdHeader: string
  referencesHeader: string
}

/**
 * Parameters for listing messages
 */
export interface ListMessagesParams {
  labelIds?: string[]
  q?: string
  maxResults?: number
  pageToken?: string | null
}

/**
 * Parameters for sending a message
 */
export interface SendMessageParams {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject?: string
  bodyHtml?: string
  attachments?: EmailAttachment[]
  threadId?: string | null
  inReplyTo?: string
  references?: string
}

/**
 * Parameters for modifying message labels
 */
export interface ModifyLabelsParams {
  id: string
  addLabelIds?: string[]
  removeLabelIds?: string[]
}

/**
 * Gmail Label representation
 */
export interface GmailLabel {
  id: string
  name: string
  type?: 'system' | 'user' | string
  messageListVisibility?: string
  labelListVisibility?: string
  messagesTotal?: number
  messagesUnread?: number
  threadsTotal?: number
  threadsUnread?: number
  color?: {
    textColor?: string
    backgroundColor?: string
  }
}

/**
 * Gmail API payload headers & parts interfaces
 */
interface GmailHeader {
  name: string
  value: string
}

interface GmailPayloadPart {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: {
    size?: number
    data?: string
    attachmentId?: string
  }
  parts?: GmailPayloadPart[]
}

interface GmailMessagePayload extends GmailPayloadPart {
  headers?: GmailHeader[]
}

interface GmailRawMessageDetail {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate: string
  payload?: GmailMessagePayload
}

/**
 * Retrieves the currently authenticated Google user with Gmail token.
 */
export async function getGmailUser(): Promise<GmailUser> {
  const user = (await SettingsManager.get('googleUser')) as GmailUser | null
  if (!user || !user.token) {
    throw new Error('Not logged in to Google. Please connect your Google account in Settings.')
  }
  return user
}

/**
 * Refreshes the Google OAuth token using the refresh token.
 */
export async function refreshAccessToken(user: GmailUser): Promise<string> {
  if (!user.refreshToken || !user.clientId) {
    throw new Error('Missing refresh token or client ID. Please reconnect your Google account.')
  }

  const response = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: user.clientId,
      client_secret: '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',
      refresh_token: user.refreshToken,
      grant_type: 'refresh_token'
    }).toString()
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Google access token. Please re-login.')
  }

  const data = (await response.json()) as { access_token: string }
  user.token = data.access_token
  await SettingsManager.set('googleUser', user)
  return user.token
}

/**
 * Helper to perform authenticated fetch to Gmail API with auto-refresh on 401.
 */
export async function gmailFetch(url: string, options: RequestInit = {}, user: GmailUser): Promise<Response> {
  const makeHeaders = (token: string): Headers => {
    const h = new Headers(options.headers || {})
    h.set('Authorization', `Bearer ${token}`)
    return h
  }

  let response = await fetch(url, {
    ...options,
    headers: makeHeaders(user.token)
  })

  if (response.status === 401) {
    console.info('[Gmail] Access token expired, refreshing...')
    const newToken = await refreshAccessToken(user)
    response = await fetch(url, {
      ...options,
      headers: makeHeaders(newToken)
    })
  }

  return response
}

/**
 * Parse headers into key-value map.
 */
function extractHeaders(headers: GmailHeader[] = []): Record<string, string> {
  const map: Record<string, string> = {}
  for (const h of headers) {
    map[h.name.toLowerCase()] = h.value
  }
  return map
}

/**
 * Recursively decode body parts from payload.
 */
function extractMessageBody(payload?: GmailMessagePayload): string {
  let html = ''
  let text = ''

  function walk(part?: GmailPayloadPart): void {
    if (!part) return
    const mime = part.mimeType || ''

    if (part.body && part.body.data) {
      // Decode Base64URL
      const decoded = Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
      if (mime === 'text/html') {
        html = decoded
      } else if (mime === 'text/plain' && !html) {
        text = decoded
      }
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const p of part.parts) {
        walk(p)
      }
    }
  }

  walk(payload)
  return html || text.replace(/\n/g, '<br/>') || '(No message content)'
}

/**
 * Extract attachments metadata.
 */
function extractAttachments(payload?: GmailMessagePayload): EmailAttachment[] {
  const attachments: EmailAttachment[] = []

  function walk(part?: GmailPayloadPart): void {
    if (!part) return
    if (part.filename && part.body) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId || null
      })
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const p of part.parts) {
        walk(p)
      }
    }
  }

  walk(payload)
  return attachments
}

/**
 * Encode raw RFC 2822 email message with support for attachments.
 */
function buildRawMimeMessage({
  from,
  to,
  cc,
  bcc,
  subject,
  bodyHtml,
  attachments = [],
  inReplyTo = '',
  references = ''
}: MimeMessageParams): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const lines: string[] = []

  lines.push(`From: ${from}`)
  lines.push(`To: ${Array.isArray(to) ? to.join(', ') : to}`)
  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`)
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`)
  lines.push(`Subject: =?utf-8?B?${Buffer.from(subject || 'No Subject').toString('base64')}?=`)
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`)
  if (references) lines.push(`References: ${references}`)
  lines.push('MIME-Version: 1.0')

  if (attachments.length > 0) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(bodyHtml || '').toString('base64'))

    for (const att of attachments) {
      lines.push(`--${boundary}`)
      const filenameBase64 = Buffer.from(att.filename || 'attachment').toString('base64')
      lines.push(`Content-Type: ${att.mimeType || 'application/octet-stream'}; name="=?utf-8?B?${filenameBase64}?="`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="=?utf-8?B?${filenameBase64}?="`)
      lines.push('')
      lines.push(att.base64Content || '')
    }

    lines.push(`--${boundary}--`)
  } else {
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(Buffer.from(bodyHtml || '').toString('base64'))
  }

  const raw = lines.join('\r\n')
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Registers all Gmail IPC handlers on Electron's ipcMain.
 */
export function setupGmailIpc(): void {
  // 1. List emails
  ipcMain.handle(
    'email:listMessages',
    async (
      _,
      { labelIds = ['INBOX'], q = '', maxResults = 30, pageToken = null }: ListMessagesParams = {}
    ): Promise<
      | { messages: MessageSummary[]; nextPageToken: string | null; resultSizeEstimate: number }
      | { error: string }
    > => {
      try {
        const user = await getGmailUser()
        let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`
        if (labelIds && labelIds.length > 0 && !labelIds.includes('ALL')) {
          for (const label of labelIds) {
            url += `&labelIds=${encodeURIComponent(label)}`
          }
        }
        if (q) {
          url += `&q=${encodeURIComponent(q)}`
        }
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`
        }

        const res = await gmailFetch(url, {}, user)
        if (!res.ok) {
          const text = await res.text()
          return { error: `Gmail API error (${res.status}): ${text}` }
        }

        const data = (await res.json()) as {
          messages?: Array<{ id: string; threadId: string }>
          nextPageToken?: string
          resultSizeEstimate?: number
        }
        const messageSummaries: MessageSummary[] = []

        // Fetch metadata/previews in batch (limit first 25 for instant rendering)
        if (data.messages && data.messages.length > 0) {
          const batch = data.messages.slice(0, 25)
          const detailsPromises = batch.map(async (msg) => {
            try {
              const detailRes = await gmailFetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
                {},
                user
              )
              if (!detailRes.ok) return null
              const detail = (await detailRes.json()) as GmailRawMessageDetail
              const headers = extractHeaders(detail.payload?.headers || [])

              return {
                id: detail.id,
                threadId: detail.threadId,
                labelIds: detail.labelIds || [],
                snippet: detail.snippet || '',
                from: headers['from'] || 'Unknown Sender',
                subject: headers['subject'] || '(No Subject)',
                date: headers['date'] || new Date(parseInt(detail.internalDate, 10)).toLocaleString(),
                timestamp: parseInt(detail.internalDate, 10) || Date.now(),
                isUnread: detail.labelIds?.includes('UNREAD') || false,
                isStarred: detail.labelIds?.includes('STARRED') || false
              } as MessageSummary
            } catch {
              return null
            }
          })

          const resolved = await Promise.all(detailsPromises)
          for (const item of resolved) {
            if (item) messageSummaries.push(item)
          }
        }

        return {
          messages: messageSummaries,
          nextPageToken: data.nextPageToken || null,
          resultSizeEstimate: data.resultSizeEstimate || messageSummaries.length
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message }
      }
    }
  )

  // 2. Get single email full details
  ipcMain.handle(
    'email:getMessageDetails',
    async (
      _,
      { id }: { id: string }
    ): Promise<MessageDetails | { error: string }> => {
      try {
        const user = await getGmailUser()
        const res = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {}, user)
        if (!res.ok) {
          const text = await res.text()
          return { error: `Failed to fetch message details: ${text}` }
        }

        const detail = (await res.json()) as GmailRawMessageDetail & { to?: string; cc?: string }
        const headers = extractHeaders(detail.payload?.headers || [])
        const bodyHtml = extractMessageBody(detail.payload)
        const attachments = extractAttachments(detail.payload)

        return {
          id: detail.id,
          threadId: detail.threadId,
          labelIds: detail.labelIds || [],
          snippet: detail.snippet || '',
          from: headers['from'] || 'Unknown Sender',
          to: headers['to'] || '',
          cc: headers['cc'] || '',
          subject: headers['subject'] || '(No Subject)',
          date: headers['date'] || new Date(parseInt(detail.internalDate, 10)).toLocaleString(),
          timestamp: parseInt(detail.internalDate, 10) || Date.now(),
          bodyHtml,
          attachments,
          isUnread: detail.labelIds?.includes('UNREAD') || false,
          isStarred: detail.labelIds?.includes('STARRED') || false,
          messageIdHeader: headers['message-id'] || '',
          referencesHeader: headers['references'] || headers['in-reply-to'] || ''
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message }
      }
    }
  )

  // 3. Send email with attachments (and support replying in thread)
  ipcMain.handle(
    'email:sendMessage',
    async (
      _,
      {
        to,
        cc,
        bcc,
        subject,
        bodyHtml,
        attachments = [],
        threadId = null,
        inReplyTo = '',
        references = ''
      }: SendMessageParams
    ): Promise<{ success: true; messageId: string; threadId?: string } | { error: string }> => {
      try {
        const user = await getGmailUser()
        const raw = buildRawMimeMessage({
          from: user.email,
          to,
          cc,
          bcc,
          subject,
          bodyHtml,
          attachments,
          inReplyTo,
          references
        })

        const payload: { raw: string; threadId?: string } = { raw }
        if (threadId) {
          payload.threadId = threadId
        }

        const res = await gmailFetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          },
          user
        )

        if (!res.ok) {
          const text = await res.text()
          return { error: `Failed to send email: ${text}` }
        }

        const data = (await res.json()) as { id: string; threadId?: string }
        return { success: true, messageId: data.id, threadId: data.threadId }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message }
      }
    }
  )

  // 4. Modify labels (star, mark read/unread, archive, trash)
  ipcMain.handle(
    'email:modifyLabels',
    async (
      _,
      { id, addLabelIds = [], removeLabelIds = [] }: ModifyLabelsParams
    ): Promise<{ success: true } | { error: string }> => {
      try {
        const user = await getGmailUser()
        const res = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addLabelIds, removeLabelIds })
          },
          user
        )

        if (!res.ok) {
          const text = await res.text()
          return { error: text }
        }
        return { success: true }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message }
      }
    }
  )

  // 4b. Trash / Delete email (Gmail trash action)
  ipcMain.handle(
    'email:trashMessage',
    async (_, { id }: { id: string }): Promise<{ success: true } | { error: string }> => {
      try {
        const user = await getGmailUser()
        const res = await gmailFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`,
          {
            method: 'POST'
          },
          user
        )

        if (!res.ok) {
          const text = await res.text()
          return { error: text }
        }
        return { success: true }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message }
      }
    }
  )

  // 5. Pick local files as attachments
  ipcMain.handle(
    'email:pickAttachments',
    async (): Promise<{ attachments: EmailAttachment[] } | { error: string }> => {
      try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          title: 'Select Attachments',
          buttonLabel: 'Attach',
          properties: ['openFile', 'multiSelections']
        })

        if (canceled || !filePaths || filePaths.length === 0) {
          return { attachments: [] }
        }

        const attachments: EmailAttachment[] = []
        for (const fp of filePaths) {
          const buf = await fs.readFile(fp)
          const filename = path.basename(fp)
          const ext = path.extname(fp).toLowerCase()

          let mimeType = 'application/octet-stream'
          if (ext === '.pdf') mimeType = 'application/pdf'
          else if (ext === '.png') mimeType = 'image/png'
          else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
          else if (ext === '.txt' || ext === '.md') mimeType = 'text/plain'
          else if (ext === '.json') mimeType = 'application/json'
          else if (ext === '.zip') mimeType = 'application/zip'

          attachments.push({
            filename,
            mimeType,
            size: buf.length,
            base64Content: buf.toString('base64')
          })
        }

        return { attachments }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return { error: message }
      }
    }
  )

  // 6. Get unread email count for inbox & show notification if new
  ipcMain.handle(
    'email:getUnreadCount',
    async (): Promise<{ count: number; total?: number }> => {
      try {
        const user = await getGmailUser()
        // First try label info
        const res = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', {}, user)
        if (res.ok) {
          const data = (await res.json()) as { messagesUnread?: number; messagesTotal?: number }
          return {
            count: typeof data.messagesUnread === 'number' ? data.messagesUnread : 0,
            total: data.messagesTotal || 0
          }
        }

        // Fallback: direct query estimate
        const qRes = await gmailFetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label%3AINBOX+is%3Aunread&maxResults=1',
          {},
          user
        )
        if (qRes.ok) {
          const qData = (await qRes.json()) as { resultSizeEstimate?: number; messages?: unknown[] }
          return {
            count: qData.resultSizeEstimate || (qData.messages ? qData.messages.length : 0),
            total: 0
          }
        }

        return { count: 0 }
      } catch {
        return { count: 0 }
      }
    }
  )

  // 7. Show native OS notification for new emails
  ipcMain.handle(
    'email:showNotification',
    async (_, { title, body }: { title?: string; body?: string } = {}): Promise<
      { success: true } | { supported: false } | { error: string }
    > => {
      try {
        let icon: string | undefined = undefined
        try {
          const iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'resources/icon.png')
            : path.join(__dirname, '../../resources/icon.png')
          if (fsSync.existsSync(iconPath)) {
            icon = iconPath
          }
        } catch {}

        if (Notification.isSupported()) {
          const notif = new Notification({
            title: title || 'New Email',
            body: body || 'New Email',
            icon,
            silent: false
          })

          notif.on('click', () => {
            const allWindows = BrowserWindow.getAllWindows()
            if (allWindows.length > 0) {
              const win = allWindows[0]
              if (win.isMinimized()) win.restore()
              win.show()
              win.focus()
              win.webContents.send('open-email')
            }
          })

          notif.show()
          return { success: true }
        }
        return { supported: false }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[email:showNotification] error:', message)
        return { error: message }
      }
    }
  )

  // 8. List all Gmail labels (custom user labels and system categories)
  ipcMain.handle(
    'email:listLabels',
    async (): Promise<{ labels: GmailLabel[] } | { error: string }> => {
      try {
        const user = await getGmailUser()
        const res = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {}, user)
        if (!res.ok) {
          const text = await res.text()
          return { error: text }
        }
        const data = (await res.json()) as { labels?: GmailLabel[] }
        return { labels: data.labels || [] }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[email:listLabels] error:', message)
        return { error: message }
      }
    }
  )
}
