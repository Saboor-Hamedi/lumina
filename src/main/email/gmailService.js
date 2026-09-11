import { net, ipcMain, dialog } from 'electron'
import SettingsManager from '../SettingsManager'
import fs from 'fs/promises'
import path from 'path'

/**
 * Retrieves the currently authenticated Google user with Gmail token.
 */
export async function getGmailUser() {
  const user = await SettingsManager.get('googleUser')
  if (!user || !user.token) {
    throw new Error('Not logged in to Google. Please connect your Google account in Settings.')
  }
  return user
}

/**
 * Refreshes the Google OAuth token using the refresh token.
 */
export async function refreshAccessToken(user) {
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

  const data = await response.json()
  user.token = data.access_token
  await SettingsManager.set('googleUser', user)
  return user.token
}

/**
 * Helper to perform authenticated fetch to Gmail API with auto-refresh on 401.
 */
export async function gmailFetch(url, options = {}, user) {
  const makeHeaders = (token) => {
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
function extractHeaders(headers = []) {
  const map = {}
  for (const h of headers) {
    map[h.name.toLowerCase()] = h.value
  }
  return map
}

/**
 * Recursively decode body parts from payload.
 */
function extractMessageBody(payload) {
  let html = ''
  let text = ''

  function walk(part) {
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
function extractAttachments(payload) {
  const attachments = []

  function walk(part) {
    if (!part) return
    if (part.filename && part.body) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
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
function buildRawMimeMessage({ from, to, cc, bcc, subject, bodyHtml, attachments = [] }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const lines = []

  lines.push(`From: ${from}`)
  lines.push(`To: ${Array.isArray(to) ? to.join(', ') : to}`)
  if (cc) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`)
  if (bcc) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`)
  lines.push(`Subject: =?utf-8?B?${Buffer.from(subject || 'No Subject').toString('base64')}?=`)
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
      lines.push(att.base64Content)
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

export function setupGmailIpc() {
  // 1. List emails
  ipcMain.handle('email:listMessages', async (_, { labelIds = ['INBOX'], q = '', maxResults = 30, pageToken = null } = {}) => {
    try {
      const user = await getGmailUser()
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`
      if (labelIds && labelIds.length > 0) {
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

      const data = await res.json()
      const messageSummaries = []

      // Fetch metadata/previews in batch (limit first 20 for instant rendering)
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
            const detail = await detailRes.json()
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
            }
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
    } catch (err) {
      return { error: err.message }
    }
  })

  // 2. Get single email full details
  ipcMain.handle('email:getMessageDetails', async (_, { id }) => {
    try {
      const user = await getGmailUser()
      const res = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {}, user)
      if (!res.ok) {
        const text = await res.text()
        return { error: `Failed to fetch message details: ${text}` }
      }

      const detail = await res.json()
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
        isStarred: detail.labelIds?.includes('STARRED') || false
      }
    } catch (err) {
      return { error: err.message }
    }
  })

  // 3. Send email with attachments
  ipcMain.handle('email:sendMessage', async (_, { to, cc, bcc, subject, bodyHtml, attachments = [] }) => {
    try {
      const user = await getGmailUser()
      const raw = buildRawMimeMessage({
        from: user.email,
        to,
        cc,
        bcc,
        subject,
        bodyHtml,
        attachments
      })

      const res = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw })
      }, user)

      if (!res.ok) {
        const text = await res.text()
        return { error: `Failed to send email: ${text}` }
      }

      const data = await res.json()
      return { success: true, messageId: data.id }
    } catch (err) {
      return { error: err.message }
    }
  })

  // 4. Modify labels (star, mark read/unread, archive, trash)
  ipcMain.handle('email:modifyLabels', async (_, { id, addLabelIds = [], removeLabelIds = [] }) => {
    try {
      const user = await getGmailUser()
      const res = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addLabelIds, removeLabelIds })
      }, user)

      if (!res.ok) {
        const text = await res.text()
        return { error: text }
      }
      return { success: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  // 4b. Trash / Delete email (Gmail trash action)
  ipcMain.handle('email:trashMessage', async (_, { id }) => {
    try {
      const user = await getGmailUser()
      const res = await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/trash`, {
        method: 'POST'
      }, user)

      if (!res.ok) {
        const text = await res.text()
        return { error: text }
      }
      return { success: true }
    } catch (err) {
      return { error: err.message }
    }
  })

  // 5. Pick local files as attachments
  ipcMain.handle('email:pickAttachments', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Select Attachments',
        buttonLabel: 'Attach',
        properties: ['openFile', 'multiSelections']
      })

      if (canceled || !filePaths || filePaths.length === 0) {
        return { attachments: [] }
      }

      const attachments = []
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
    } catch (err) {
      return { error: err.message }
    }
  })
}
