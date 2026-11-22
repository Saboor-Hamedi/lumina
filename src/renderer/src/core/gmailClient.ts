import { invoke } from '@tauri-apps/api/core'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function getTokenInfo(): Promise<{ accessToken: string; email?: string; name?: string } | { error: string }> {
  try {
    const res = (await invoke('get_google_access_token')) as any
    if (!res || res.error || !res.accessToken) {
      return { error: res?.error || 'Not logged in to Google' }
    }
    return res
  } catch (err: any) {
    return { error: err?.message || 'Not logged in to Google' }
  }
}

async function gmailFetch(path: string, init: RequestInit = {}): Promise<any> {
  const tokenRes = await getTokenInfo()
  if ('error' in tokenRes) {
    return { error: tokenRes.error }
  }

  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${tokenRes.accessToken}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    let message = `Gmail API error (${res.status}): ${errText}`
    try {
      const errJson = JSON.parse(errText)
      if (errJson?.error?.message) {
        message = `Gmail API error (${res.status}): ${errJson.error.message}`
      }
    } catch {}
    return { error: message }
  }

  return res.json()
}

function decodeBase64Url(data?: string): string {
  if (!data) return ''
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
    const bin = atob(base64 + pad)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i)
    }
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i])
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function bytesToBase64(bytes: number[] | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (let i = 0; i < arr.length; i++) {
    bin += String.fromCharCode(arr[i])
  }
  return btoa(bin)
}

function getHeader(headers: Array<{ name: string; value: string }> = [], name: string): string {
  const target = name.toLowerCase()
  return headers.find((h) => h.name?.toLowerCase() === target)?.value || ''
}

function extractBodyAndAttachments(
  payload: any,
  htmlParts: string[],
  textParts: string[],
  attachments: any[]
): void {
  if (!payload) return
  const mime = (payload.mimeType || '').toLowerCase()
  const filename = payload.filename || ''

  if (filename && (payload.body?.attachmentId || payload.body?.data)) {
    attachments.push({
      filename,
      mimeType: payload.mimeType || 'application/octet-stream',
      size: payload.body?.size || 0,
      attachmentId: payload.body?.attachmentId
    })
  } else if (mime === 'text/html' && payload.body?.data) {
    htmlParts.push(decodeBase64Url(payload.body.data))
  } else if (mime === 'text/plain' && payload.body?.data) {
    textParts.push(decodeBase64Url(payload.body.data))
  }

  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      extractBodyAndAttachments(part, htmlParts, textParts, attachments)
    }
  }
}

export async function listEmails(params: {
  labelIds?: string[]
  q?: string
  maxResults?: number
  pageToken?: string
} = {}): Promise<any> {
  const qs = new URLSearchParams()
  if (Array.isArray(params.labelIds)) {
    for (const lbl of params.labelIds) {
      if (lbl && lbl !== 'ALL') qs.append('labelIds', lbl)
    }
  }
  if (params.q) qs.set('q', params.q)
  qs.set('maxResults', String(params.maxResults || 30))
  if (params.pageToken) qs.set('pageToken', params.pageToken)

  const listRes = await gmailFetch(`/messages?${qs.toString()}`)
  if (listRes?.error) return listRes

  const rawMessages: Array<{ id: string; threadId: string }> = listRes?.messages || []
  const summaries = await Promise.all(
    rawMessages.map(async (m) => {
      const msg = await gmailFetch(
        `/messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      )
      if (!msg || msg.error) return null
      const headers = msg.payload?.headers || []
      const labelIds: string[] = msg.labelIds || []
      const dateStr = getHeader(headers, 'Date')
      const timestamp = Number(msg.internalDate) || (dateStr ? Date.parse(dateStr) : Date.now())
      return {
        id: msg.id,
        threadId: msg.threadId,
        labelIds,
        snippet: msg.snippet || '',
        from: getHeader(headers, 'From'),
        subject: getHeader(headers, 'Subject') || '(No Subject)',
        date: dateStr,
        timestamp,
        isUnread: labelIds.includes('UNREAD'),
        isStarred: labelIds.includes('STARRED')
      }
    })
  )

  return {
    messages: summaries.filter(Boolean),
    nextPageToken: listRes?.nextPageToken
  }
}

export async function getEmailDetails({ id }: { id: string }): Promise<any> {
  const msg = await gmailFetch(`/messages/${encodeURIComponent(id)}?format=full`)
  if (!msg || msg.error) return msg

  const headers = msg.payload?.headers || []
  const labelIds: string[] = msg.labelIds || []
  const htmlParts: string[] = []
  const textParts: string[] = []
  const attachments: any[] = []
  extractBodyAndAttachments(msg.payload, htmlParts, textParts, attachments)

  let bodyHtml = htmlParts.join('<br/>')
  if (!bodyHtml && textParts.length > 0) {
    const escaped = textParts
      .join('\n')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escaped}</pre>`
  }

  const dateStr = getHeader(headers, 'Date')
  const timestamp = Number(msg.internalDate) || (dateStr ? Date.parse(dateStr) : Date.now())

  return {
    id: msg.id,
    threadId: msg.threadId,
    labelIds,
    snippet: msg.snippet || '',
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc'),
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    date: dateStr,
    timestamp,
    bodyHtml,
    attachments,
    isUnread: labelIds.includes('UNREAD'),
    isStarred: labelIds.includes('STARRED'),
    messageIdHeader: getHeader(headers, 'Message-ID') || getHeader(headers, 'Message-Id')
  }
}

export async function sendEmail(params: {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject?: string
  bodyHtml?: string
  attachments?: any[]
  threadId?: string
  inReplyTo?: string
  references?: string
}): Promise<any> {
  const tokenInfo = await getTokenInfo()
  if ('error' in tokenInfo) return { error: tokenInfo.error }

  const formatAddrs = (val?: string | string[]) =>
    Array.isArray(val) ? val.join(', ') : val || ''

  const boundary = `----=_LuminaBoundary_${Date.now().toString(16)}`
  const lines: string[] = []
  if (tokenInfo.email) lines.push(`From: ${tokenInfo.email}`)
  lines.push(`To: ${formatAddrs(params.to)}`)
  if (params.cc && formatAddrs(params.cc).trim()) lines.push(`Cc: ${formatAddrs(params.cc)}`)
  if (params.bcc && formatAddrs(params.bcc).trim()) lines.push(`Bcc: ${formatAddrs(params.bcc)}`)
  lines.push(`Subject: ${params.subject || '(No Subject)'}`)
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`)
  if (params.references) lines.push(`References: ${params.references}`)
  lines.push('MIME-Version: 1.0')

  const atts = Array.isArray(params.attachments) ? params.attachments : []
  if (atts.length === 0) {
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('')
    lines.push(params.bodyHtml || '')
  } else {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset="UTF-8"')
    lines.push('')
    lines.push(params.bodyHtml || '')
    for (const att of atts) {
      const b64 = att.contentBase64 || att.dataBase64 || (att.bytes ? bytesToBase64(att.bytes) : '')
      lines.push(`--${boundary}`)
      lines.push(`Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${att.filename || 'attachment'}"`)
      lines.push('Content-Transfer-Encoding: base64')
      lines.push(`Content-Disposition: attachment; filename="${att.filename || 'attachment'}"`)
      lines.push('')
      lines.push(b64)
    }
    lines.push(`--${boundary}--`)
  }

  const raw = encodeBase64Url(lines.join('\r\n'))
  const payload: any = { raw }
  if (params.threadId) payload.threadId = params.threadId

  return gmailFetch('/messages/send', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function modifyEmailLabels({
  id,
  addLabelIds = [],
  removeLabelIds = []
}: {
  id: string
  addLabelIds?: string[]
  removeLabelIds?: string[]
}): Promise<any> {
  return gmailFetch(`/messages/${encodeURIComponent(id)}/modify`, {
    method: 'POST',
    body: JSON.stringify({ addLabelIds, removeLabelIds })
  })
}

export async function trashEmail({ id }: { id: string }): Promise<any> {
  return gmailFetch(`/messages/${encodeURIComponent(id)}/trash`, {
    method: 'POST'
  })
}

export async function getUnreadEmailCount(): Promise<{ count: number }> {
  const res = await gmailFetch('/labels/INBOX')
  if (res?.error) return { count: 0 }
  return { count: Number(res?.messagesUnread || 0) }
}

export async function listEmailLabels(): Promise<any> {
  const res = await gmailFetch('/labels')
  if (res?.error) return res
  return { labels: res?.labels || [] }
}

export async function pickEmailAttachments(): Promise<{ attachments: any[] }> {
  const res = (await invoke('pick_email_attachments')) as any
  const raw = Array.isArray(res?.attachments) ? res.attachments : []
  return {
    attachments: raw.map((a: any) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      contentBase64: a.bytes ? bytesToBase64(a.bytes) : '',
      size: Array.isArray(a.bytes) ? a.bytes.length : 0
    }))
  }
}

export async function showEmailNotification({ title, body }: { title?: string; body?: string } = {}): Promise<void> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: { message: body ? `${title || 'Email'}: ${body}` : title || 'Notification', type: 'info' }
      })
    )
  }
}
