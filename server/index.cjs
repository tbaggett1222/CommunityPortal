const fs = require('node:fs/promises')
const path = require('node:path')
const express = require('express')
const cors = require('cors')

const PORT = Number(process.env.PORT) || 8787
const STATE_FILE = process.env.PORTAL_STATE_FILE || path.join(process.cwd(), '.portal-api-state.json')
const BACKUP_TYPE = 'communityportal-sync-backup'
const BACKUP_VERSION = 1
const SCOPES = ['announcements', 'documents', 'comments']

const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const EMPTY_PAYLOAD = {
  announcements: [],
  documents: [],
  comments: [],
}

const app = express()
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`Origin not allowed: ${origin}`))
    },
  }),
)
app.use(express.json({ limit: '10mb' }))

function normalizeString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeDateOnly(value) {
  const parsed = new Date(String(value || ''))
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return parsed.toISOString().slice(0, 10)
}

function normalizeDateTime(value) {
  const parsed = new Date(String(value || ''))
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }
  return parsed.toISOString()
}

function sanitizeAnnouncement(value) {
  if (!value || typeof value !== 'object') return null
  const row = value
  const id = normalizeString(row.id, 120)
  const title = normalizeString(row.title, 200)
  const summary = normalizeString(row.summary, 2000)
  if (!id || !title || !summary) return null
  return {
    id,
    title,
    summary,
    date: normalizeDateOnly(row.date),
    audience: row.audience === 'board' ? 'board' : 'all',
  }
}

function sanitizeDocument(value) {
  if (!value || typeof value !== 'object') return null
  const row = value
  const id = normalizeString(row.id, 120)
  const title = normalizeString(row.title, 200)
  const category = normalizeString(row.category, 120)
  const href = normalizeString(row.href, 2000)
  if (!id || !title || !category || !href) return null
  return {
    id,
    title,
    category,
    href,
    updatedAt: normalizeDateOnly(row.updatedAt),
  }
}

function sanitizeComment(value) {
  if (!value || typeof value !== 'object') return null
  const row = value
  const id = normalizeString(row.id, 120)
  const author = normalizeString(row.author, 120)
  const message = normalizeString(row.message, 4000)
  if (!id || !author || !message) return null
  return {
    id,
    author,
    message,
    pinned: Boolean(row.pinned),
    createdAt: normalizeDateTime(row.createdAt),
  }
}

function dedupeById(rows) {
  const byId = new Map()
  rows.forEach((row) => {
    if (!row?.id) return
    byId.set(row.id, row)
  })
  return [...byId.values()]
}

function sanitizeSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ...EMPTY_PAYLOAD }
  }

  const safePayload = payload
  const announcements = Array.isArray(safePayload.announcements)
    ? dedupeById(safePayload.announcements.map(sanitizeAnnouncement).filter(Boolean))
    : []
  const documents = Array.isArray(safePayload.documents)
    ? dedupeById(safePayload.documents.map(sanitizeDocument).filter(Boolean))
    : []
  const comments = Array.isArray(safePayload.comments)
    ? dedupeById(safePayload.comments.map(sanitizeComment).filter(Boolean))
    : []

  return { announcements, documents, comments }
}

function normalizeMode(mode) {
  return mode === 'replace' || mode === 'merge' || mode === 'missing' ? mode : 'replace'
}

function normalizeScopes(inputScopes) {
  const normalized = {
    announcements: true,
    documents: true,
    comments: true,
  }
  if (!inputScopes || typeof inputScopes !== 'object') {
    return normalized
  }

  SCOPES.forEach((scope) => {
    if (Object.prototype.hasOwnProperty.call(inputScopes, scope)) {
      normalized[scope] = inputScopes[scope] !== false
    }
  })
  return normalized
}

async function ensureStateFile() {
  const parentDir = path.dirname(STATE_FILE)
  await fs.mkdir(parentDir, { recursive: true })
  try {
    await fs.access(STATE_FILE)
  } catch {
    const seed = {
      backupType: BACKUP_TYPE,
      version: BACKUP_VERSION,
      updatedAt: new Date().toISOString(),
      payload: { ...EMPTY_PAYLOAD },
    }
    await fs.writeFile(STATE_FILE, JSON.stringify(seed, null, 2), 'utf8')
  }
}

async function readStateRecord() {
  await ensureStateFile()
  const raw = await fs.readFile(STATE_FILE, 'utf8')
  try {
    const parsed = JSON.parse(raw)
    const payload = sanitizeSnapshot(parsed?.payload || parsed)
    return {
      backupType: BACKUP_TYPE,
      version: BACKUP_VERSION,
      updatedAt: normalizeDateTime(parsed?.updatedAt),
      payload,
    }
  } catch {
    return {
      backupType: BACKUP_TYPE,
      version: BACKUP_VERSION,
      updatedAt: new Date().toISOString(),
      payload: { ...EMPTY_PAYLOAD },
    }
  }
}

async function writeStateRecord(payload) {
  const nextRecord = {
    backupType: BACKUP_TYPE,
    version: BACKUP_VERSION,
    updatedAt: new Date().toISOString(),
    payload: sanitizeSnapshot(payload),
  }
  await fs.writeFile(STATE_FILE, JSON.stringify(nextRecord, null, 2), 'utf8')
  return nextRecord
}

function mergeRows(localRows, incomingRows, mode) {
  if (mode === 'replace') {
    return dedupeById(incomingRows)
  }

  const byId = new Map(localRows.map((row) => [row.id, row]))
  if (mode === 'merge') {
    incomingRows.forEach((row) => byId.set(row.id, row))
  } else {
    incomingRows.forEach((row) => {
      if (!byId.has(row.id)) {
        byId.set(row.id, row)
      }
    })
  }
  return [...byId.values()]
}

function applySync(localPayload, incomingPayload, mode, scopes) {
  const next = {
    announcements: localPayload.announcements,
    documents: localPayload.documents,
    comments: localPayload.comments,
  }

  if (scopes.announcements) {
    next.announcements = mergeRows(localPayload.announcements, incomingPayload.announcements, mode)
  }
  if (scopes.documents) {
    next.documents = mergeRows(localPayload.documents, incomingPayload.documents, mode)
  }
  if (scopes.comments) {
    next.comments = mergeRows(localPayload.comments, incomingPayload.comments, mode)
  }

  return next
}

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'communityportal-sync-api',
    health: '/api/portal/health',
    export: '/api/portal/export',
    sync: '/api/portal/sync',
  })
})

app.get('/api/portal/health', async (_req, res) => {
  try {
    await ensureStateFile()
    res.json({
      ok: true,
      service: 'communityportal-sync-api',
      now: new Date().toISOString(),
      stateFile: STATE_FILE,
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || 'Health check failed.',
    })
  }
})

app.get('/api/portal/summary', async (_req, res) => {
  try {
    const record = await readStateRecord()
    res.json({
      ok: true,
      summary: {
        updatedAt: record.updatedAt,
        announcements: record.payload.announcements.length,
        documents: record.payload.documents.length,
        comments: record.payload.comments.length,
      },
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || 'Could not fetch summary.',
    })
  }
})

app.get('/api/portal/records/:scope', async (req, res) => {
  try {
    const scope = String(req.params.scope || '')
    if (!SCOPES.includes(scope)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid scope "${scope}". Valid scopes: ${SCOPES.join(', ')}`,
      })
    }
    const record = await readStateRecord()
    return res.json({
      ok: true,
      scope,
      records: record.payload[scope],
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Could not fetch scope records.',
    })
  }
})

app.get('/api/portal/export', async (_req, res) => {
  try {
    const record = await readStateRecord()
    res.json({
      ok: true,
      backup: {
        backupType: BACKUP_TYPE,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        payload: record.payload,
      },
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error?.message || 'Could not export portal data.',
    })
  }
})

app.post('/api/portal/sync', async (req, res) => {
  try {
    const mode = normalizeMode(req.body?.mode)
    const scopes = normalizeScopes(req.body?.scopes)
    const incomingSnapshot = sanitizeSnapshot(req.body?.backup?.payload)

    const currentRecord = await readStateRecord()
    const nextPayload = applySync(currentRecord.payload, incomingSnapshot, mode, scopes)
    const nextRecord = await writeStateRecord(nextPayload)

    res.json({
      ok: true,
      message: 'Portal sync completed.',
      result: {
        mode,
        scopes,
        updatedAt: nextRecord.updatedAt,
        counts: {
          announcements: nextRecord.payload.announcements.length,
          documents: nextRecord.payload.documents.length,
          comments: nextRecord.payload.comments.length,
        },
      },
    })
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error?.message || 'Could not sync portal data.',
    })
  }
})

app.use((error, _req, res, _next) => {
  if (error?.message?.startsWith('Origin not allowed:')) {
    return res.status(403).json({ ok: false, error: error.message })
  }
  return res.status(500).json({ ok: false, error: error?.message || 'Unexpected server error.' })
})

app.listen(PORT, async () => {
  await ensureStateFile()
  // eslint-disable-next-line no-console
  console.log(`CommunityPortal sync API listening on port ${PORT}`)
})
