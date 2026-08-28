import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const MOBILE_BREAKPOINT_PX = 960
const PORTAL_STATE_STORAGE_KEY = 'communityportal.portal-state.v1'
const API_BASE_URL_STORAGE_KEY = 'communityportal.api-base-url.v1'
const BACKUP_TYPE = 'communityportal-sync-backup'
const BACKUP_VERSION = 1

type UserRole = 'resident' | 'admin'
type PageId = 'overview' | 'announcements' | 'documents' | 'comments' | 'join' | 'admin'
type AnnouncementAudience = 'all' | 'board'
type SyncMode = 'replace' | 'merge' | 'missing'

interface Announcement {
  id: string
  title: string
  summary: string
  date: string
  audience: AnnouncementAudience
}

interface PortalDocument {
  id: string
  title: string
  category: string
  updatedAt: string
  href: string
}

interface CommentEntry {
  id: string
  author: string
  message: string
  createdAt: string
  pinned: boolean
}

interface PortalSnapshot {
  announcements: Announcement[]
  documents: PortalDocument[]
  comments: CommentEntry[]
}

interface PortalBackup {
  backupType: string
  version: number
  exportedAt: string
  payload: PortalSnapshot
}

const NAV_ITEMS: Array<{ id: PageId; label: string; adminOnly?: boolean }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'documents', label: 'Documents' },
  { id: 'comments', label: 'Comments' },
  { id: 'join', label: 'Get Involved' },
  { id: 'admin', label: 'Admin Center', adminOnly: true },
]

const PAGE_TITLES: Record<PageId, string> = {
  overview: 'Community Overview',
  announcements: 'Community Announcements',
  documents: 'Resident Documents',
  comments: 'Community Comments',
  join: 'Get Involved',
  admin: 'Admin Center',
}

const SYNC_MODE_OPTIONS: Array<{ value: SyncMode; label: string }> = [
  { value: 'replace', label: 'Replace local with remote' },
  { value: 'merge', label: 'Merge remote into local' },
  { value: 'missing', label: 'Fill local missing only' },
]

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'September board session',
    summary: 'Board meeting agenda and packet are now posted for resident review.',
    date: '2026-09-08',
    audience: 'all',
  },
  {
    id: 'a2',
    title: 'Landscape contract review',
    summary: 'Board-only draft review before resident Q&A publication.',
    date: '2026-09-14',
    audience: 'board',
  },
]

const INITIAL_DOCUMENTS: PortalDocument[] = [
  {
    id: 'd1',
    title: 'Community Covenant Summary',
    category: 'Governing docs',
    updatedAt: '2026-08-20',
    href: '#',
  },
  {
    id: 'd2',
    title: 'Board Meeting Minutes - August',
    category: 'Meeting minutes',
    updatedAt: '2026-08-29',
    href: '#',
  },
  {
    id: 'd3',
    title: 'Resident Newcomer Guide',
    category: 'Resident onboarding',
    updatedAt: '2026-08-16',
    href: '#',
  },
]

const INITIAL_COMMENTS: CommentEntry[] = [
  {
    id: 'c1',
    author: 'Lot 36 Resident',
    message: 'Would love to see a shared events calendar with volunteer signup links.',
    createdAt: '2026-08-27T10:15:00.000Z',
    pinned: true,
  },
  {
    id: 'c2',
    author: 'Board Secretary',
    message: 'Document archive structure looks good. Next step: map categories to permissions.',
    createdAt: '2026-08-27T14:05:00.000Z',
    pinned: false,
  },
]

const DEFAULT_SNAPSHOT: PortalSnapshot = {
  announcements: INITIAL_ANNOUNCEMENTS,
  documents: INITIAL_DOCUMENTS,
  comments: INITIAL_COMMENTS,
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sanitizeAnnouncement(value: unknown): Announcement | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Partial<Announcement>
  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.summary !== 'string' ||
    typeof row.date !== 'string'
  ) {
    return null
  }

  const audience = row.audience === 'board' ? 'board' : 'all'
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    date: row.date,
    audience,
  }
}

function sanitizeDocument(value: unknown): PortalDocument | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Partial<PortalDocument>
  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.category !== 'string' ||
    typeof row.updatedAt !== 'string' ||
    typeof row.href !== 'string'
  ) {
    return null
  }

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    updatedAt: row.updatedAt,
    href: row.href,
  }
}

function sanitizeComment(value: unknown): CommentEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const row = value as Partial<CommentEntry>
  if (
    typeof row.id !== 'string' ||
    typeof row.author !== 'string' ||
    typeof row.message !== 'string' ||
    typeof row.createdAt !== 'string' ||
    typeof row.pinned !== 'boolean'
  ) {
    return null
  }

  return {
    id: row.id,
    author: row.author,
    message: row.message,
    createdAt: row.createdAt,
    pinned: row.pinned,
  }
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  const byId = new Map<string, T>()
  rows.forEach((row) => {
    if (!row.id) {
      return
    }
    byId.set(row.id, row)
  })
  return [...byId.values()]
}

function sanitizeSnapshot(value: unknown): PortalSnapshot {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SNAPSHOT
  }

  const raw = value as Partial<PortalSnapshot>
  const announcements = Array.isArray(raw.announcements)
    ? dedupeById(raw.announcements.map(sanitizeAnnouncement).filter((row): row is Announcement => Boolean(row)))
    : DEFAULT_SNAPSHOT.announcements
  const documents = Array.isArray(raw.documents)
    ? dedupeById(raw.documents.map(sanitizeDocument).filter((row): row is PortalDocument => Boolean(row)))
    : DEFAULT_SNAPSHOT.documents
  const comments = Array.isArray(raw.comments)
    ? dedupeById(raw.comments.map(sanitizeComment).filter((row): row is CommentEntry => Boolean(row)))
    : DEFAULT_SNAPSHOT.comments

  return { announcements, documents, comments }
}

function loadSnapshotFromLocalStorage() {
  if (typeof window === 'undefined') {
    return DEFAULT_SNAPSHOT
  }

  const raw = window.localStorage.getItem(PORTAL_STATE_STORAGE_KEY)
  if (!raw) {
    return DEFAULT_SNAPSHOT
  }

  try {
    return sanitizeSnapshot(JSON.parse(raw))
  } catch {
    return DEFAULT_SNAPSHOT
  }
}

function loadApiBaseUrl() {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.localStorage.getItem(API_BASE_URL_STORAGE_KEY) || ''
}

function normalizeApiBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '')
}

function buildApiUrl(baseUrl: string, path: string) {
  const suffix = path.startsWith('/') ? path : `/${path}`
  const base = normalizeApiBaseUrl(baseUrl)
  return base ? `${base}${suffix}` : suffix
}

function createBackup(snapshot: PortalSnapshot): PortalBackup {
  return {
    backupType: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    payload: snapshot,
  }
}

function mergeByMode<T extends { id: string }>(localRows: T[], incomingRows: T[], mode: SyncMode) {
  if (mode === 'replace') {
    return dedupeById(incomingRows)
  }

  const merged = new Map<string, T>()
  localRows.forEach((row) => merged.set(row.id, row))

  if (mode === 'merge') {
    incomingRows.forEach((row) => merged.set(row.id, row))
  } else {
    incomingRows.forEach((row) => {
      if (!merged.has(row.id)) {
        merged.set(row.id, row)
      }
    })
  }

  return [...merged.values()]
}

function mergeSnapshots(localSnapshot: PortalSnapshot, incomingSnapshot: PortalSnapshot, mode: SyncMode): PortalSnapshot {
  return {
    announcements: mergeByMode(localSnapshot.announcements, incomingSnapshot.announcements, mode),
    documents: mergeByMode(localSnapshot.documents, incomingSnapshot.documents, mode),
    comments: mergeByMode(localSnapshot.comments, incomingSnapshot.comments, mode),
  }
}

async function requestApiJson<T>(baseUrl: string, endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(baseUrl, endpoint), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    throw new Error(`Server returned a non-JSON response (${response.status}).`)
  }

  if (!response.ok) {
    const errorMessage =
      typeof (json as { error?: unknown })?.error === 'string'
        ? (json as { error: string }).error
        : `Request failed (${response.status}).`
    throw new Error(errorMessage)
  }

  return json as T
}

function App() {
  const [role, setRole] = useState<UserRole>('resident')
  const [page, setPage] = useState<PageId>('overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )
  const [snapshot, setSnapshot] = useState<PortalSnapshot>(loadSnapshotFromLocalStorage)
  const [apiBaseUrl, setApiBaseUrl] = useState(loadApiBaseUrl)
  const [syncMode, setSyncMode] = useState<SyncMode>('merge')
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [syncError, setSyncError] = useState('')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  const { announcements, documents, comments } = snapshot

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateViewport = () => setViewportWidth(window.innerWidth)
    updateViewport()
    window.addEventListener('resize', updateViewport)

    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(PORTAL_STATE_STORAGE_KEY, JSON.stringify(snapshot))
  }, [snapshot])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, apiBaseUrl)
  }, [apiBaseUrl])

  const isMobile = viewportWidth <= MOBILE_BREAKPOINT_PX
  const effectivePage = role === 'resident' && page === 'admin' ? 'overview' : page

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin')
  }, [role])

  const visibleAnnouncements = useMemo(() => {
    return announcements.filter((announcement) => role === 'admin' || announcement.audience === 'all')
  }, [announcements, role])

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [comments])

  const navigateTo = (nextPage: PageId) => {
    setPage(nextPage)
    setMobileNavOpen(false)
  }

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole)
    if (nextRole === 'resident' && page === 'admin') {
      setPage('overview')
    }
  }

  const handleAddAnnouncement = (input: { title: string; summary: string; audience: AnnouncementAudience }) => {
    const next: Announcement = {
      id: createId(),
      title: input.title,
      summary: input.summary,
      audience: input.audience,
      date: new Date().toISOString().slice(0, 10),
    }
    setSnapshot((current) => ({ ...current, announcements: [next, ...current.announcements] }))
  }

  const handleAddDocument = (input: { title: string; category: string; href: string }) => {
    const next: PortalDocument = {
      id: createId(),
      title: input.title,
      category: input.category,
      href: input.href,
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    setSnapshot((current) => ({ ...current, documents: [next, ...current.documents] }))
  }

  const handleAddComment = (input: { author: string; message: string }) => {
    const next: CommentEntry = {
      id: createId(),
      author: input.author,
      message: input.message,
      pinned: false,
      createdAt: new Date().toISOString(),
    }
    setSnapshot((current) => ({ ...current, comments: [next, ...current.comments] }))
  }

  const handleTogglePinComment = (id: string) => {
    setSnapshot((current) => ({
      ...current,
      comments: current.comments.map((comment) => (comment.id === id ? { ...comment, pinned: !comment.pinned } : comment)),
    }))
  }

  const handleDeleteComment = (id: string) => {
    setSnapshot((current) => ({ ...current, comments: current.comments.filter((comment) => comment.id !== id) }))
  }

  const handleTestConnection = async () => {
    setSyncBusy(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const response = await requestApiJson<{ ok: boolean; service?: string; now?: string }>(
        apiBaseUrl,
        '/api/portal/health',
      )
      setSyncMessage(`Connected to ${response.service || 'portal API'} at ${response.now || 'current time'}.`)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Connection test failed.')
    } finally {
      setSyncBusy(false)
    }
  }

  const handleSyncToBackend = async () => {
    setSyncBusy(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const response = await requestApiJson<{
        ok: boolean
        message?: string
        result?: { mode?: string; counts?: Record<string, number> }
      }>(apiBaseUrl, '/api/portal/sync', {
        method: 'POST',
        body: JSON.stringify({
          backup: createBackup(snapshot),
          mode: syncMode,
          scopes: {
            announcements: true,
            documents: true,
            comments: true,
          },
        }),
      })
      const countLabel = response.result?.counts
        ? `${response.result.counts.announcements || 0} announcements, ${response.result.counts.documents || 0} documents, ${response.result.counts.comments || 0} comments`
        : 'portal records'
      setSyncMessage(response.message ? `${response.message} (${countLabel}).` : `Sync completed (${countLabel}).`)
      setLastSyncAt(new Date().toISOString())
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setSyncBusy(false)
    }
  }

  const handlePullFromBackend = async () => {
    setSyncBusy(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const response = await requestApiJson<{ ok: boolean; backup?: { payload?: unknown } }>(apiBaseUrl, '/api/portal/export')
      const incoming = sanitizeSnapshot(response.backup?.payload)
      setSnapshot((current) => mergeSnapshots(current, incoming, syncMode))
      setSyncMessage(
        `Loaded data from backend using "${syncMode}" mode (${incoming.announcements.length} announcements, ${incoming.documents.length} documents, ${incoming.comments.length} comments received).`,
      )
      setLastSyncAt(new Date().toISOString())
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Load from backend failed.')
    } finally {
      setSyncBusy(false)
    }
  }

  return (
    <div className="portal-shell">
      {isMobile && mobileNavOpen && (
        <button
          aria-label="Close navigation overlay"
          className="portal-overlay"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      )}

      <aside className={`portal-sidebar ${isMobile ? 'mobile' : ''} ${mobileNavOpen ? 'open' : ''}`}>
        <div className="portal-brand">
          <p className="brand-kicker">CommunityPortal</p>
          <h1>Falling Waters One Community</h1>
          <p>Resident communications, projects, and shared updates.</p>
        </div>

        <nav className="portal-nav" aria-label="Primary">
          {visibleNavItems.map((item) => (
            <button
              className={effectivePage === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => navigateTo(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <div className="topbar-left">
            {isMobile && (
              <button
                aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
                className="menu-toggle"
                onClick={() => setMobileNavOpen((current) => !current)}
                type="button"
              >
                {mobileNavOpen ? 'Close' : 'Menu'}
              </button>
            )}
            <h2>{PAGE_TITLES[effectivePage]}</h2>
          </div>
          <div className="topbar-controls">
            <label htmlFor="role-select">View mode</label>
            <select
              id="role-select"
              value={role}
              onChange={(event) => handleRoleChange(event.target.value as UserRole)}
            >
              <option value="resident">Resident</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </header>

        <main className="portal-content">
          {effectivePage === 'overview' && (
            <OverviewPage
              announcementsCount={visibleAnnouncements.length}
              commentsCount={comments.length}
              documentsCount={documents.length}
              role={role}
            />
          )}
          {effectivePage === 'announcements' && (
            <AnnouncementsPage
              announcements={visibleAnnouncements}
              role={role}
              onAddAnnouncement={handleAddAnnouncement}
            />
          )}
          {effectivePage === 'documents' && (
            <DocumentsPage documents={documents} onAddDocument={handleAddDocument} role={role} />
          )}
          {effectivePage === 'comments' && (
            <CommentsPage
              key={role}
              comments={sortedComments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onTogglePinComment={handleTogglePinComment}
              role={role}
            />
          )}
          {effectivePage === 'join' && <JoinPage />}
          {effectivePage === 'admin' && (
            <AdminPage
              announcements={announcements}
              comments={comments}
              documents={documents}
              apiBaseUrl={apiBaseUrl}
              syncBusy={syncBusy}
              syncError={syncError}
              syncMessage={syncMessage}
              syncMode={syncMode}
              lastSyncAt={lastSyncAt}
              onApiBaseUrlChange={setApiBaseUrl}
              onPullFromBackend={handlePullFromBackend}
              onSyncModeChange={setSyncMode}
              onSyncToBackend={handleSyncToBackend}
              onTestConnection={handleTestConnection}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function OverviewPage({
  role,
  announcementsCount,
  documentsCount,
  commentsCount,
}: {
  role: UserRole
  announcementsCount: number
  documentsCount: number
  commentsCount: number
}) {
  return (
    <>
      <section className="card hero-card">
        <p className="eyebrow">Welcome</p>
        <h3>CommunityPortal module starter</h3>
        <p>
          Announcements, documents, and comments are active now. Admin mode can publish and moderate while resident
          mode presents community-facing views only.
        </p>
        <p className="helper-text">Current mode: {role === 'admin' ? 'Admin controls enabled' : 'Resident view'}</p>
      </section>

      <section className="stat-grid">
        <article className="card stat-card">
          <p className="stat-number">{announcementsCount}</p>
          <p className="stat-label">Visible announcements</p>
        </article>
        <article className="card stat-card">
          <p className="stat-number">{documentsCount}</p>
          <p className="stat-label">Published documents</p>
        </article>
        <article className="card stat-card">
          <p className="stat-number">{commentsCount}</p>
          <p className="stat-label">Community comments</p>
        </article>
      </section>
    </>
  )
}

function AnnouncementsPage({
  role,
  announcements,
  onAddAnnouncement,
}: {
  role: UserRole
  announcements: Announcement[]
  onAddAnnouncement: (input: { title: string; summary: string; audience: AnnouncementAudience }) => void
}) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('all')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !summary.trim()) {
      return
    }
    onAddAnnouncement({
      title: title.trim(),
      summary: summary.trim(),
      audience,
    })
    setTitle('')
    setSummary('')
    setAudience('all')
  }

  return (
    <section className="card-list">
      {role === 'admin' && (
        <article className="card">
          <h3>Post announcement</h3>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Title</span>
              <input onChange={(event) => setTitle(event.target.value)} value={title} />
            </label>
            <label className="field">
              <span>Summary</span>
              <textarea onChange={(event) => setSummary(event.target.value)} rows={3} value={summary} />
            </label>
            <label className="field">
              <span>Audience</span>
              <select
                onChange={(event) => setAudience(event.target.value as AnnouncementAudience)}
                value={audience}
              >
                <option value="all">All residents</option>
                <option value="board">Board only</option>
              </select>
            </label>
            <button className="button" type="submit">
              Publish announcement
            </button>
          </form>
        </article>
      )}

      {announcements.map((announcement) => (
        <article className="card" key={announcement.id}>
          <div className="row-between">
            <h3>{announcement.title}</h3>
            <span className={`pill ${announcement.audience === 'all' ? 'soft' : 'gold'}`}>
              {announcement.audience === 'all' ? 'Resident notice' : 'Board notice'}
            </span>
          </div>
          <p>{announcement.summary}</p>
          <p className="helper-text">Posted {formatDate(announcement.date)}</p>
        </article>
      ))}
    </section>
  )
}

function DocumentsPage({
  role,
  documents,
  onAddDocument,
}: {
  role: UserRole
  documents: PortalDocument[]
  onAddDocument: (input: { title: string; category: string; href: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [href, setHref] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !category.trim() || !href.trim()) {
      return
    }

    onAddDocument({
      title: title.trim(),
      category: category.trim(),
      href: href.trim(),
    })
    setTitle('')
    setCategory('')
    setHref('')
  }

  return (
    <section className="card-list">
      {role === 'admin' && (
        <article className="card">
          <h3>Add document link</h3>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Title</span>
              <input onChange={(event) => setTitle(event.target.value)} value={title} />
            </label>
            <label className="field">
              <span>Category</span>
              <input onChange={(event) => setCategory(event.target.value)} value={category} />
            </label>
            <label className="field">
              <span>URL</span>
              <input
                onChange={(event) => setHref(event.target.value)}
                placeholder="https://example.com/doc.pdf"
                value={href}
              />
            </label>
            <button className="button" type="submit">
              Save document
            </button>
          </form>
        </article>
      )}

      {documents.map((document) => (
        <article className="card" key={document.id}>
          <div className="row-between">
            <h3>{document.title}</h3>
            <span className="pill soft">{document.category}</span>
          </div>
          <p className="helper-text">Updated {formatDate(document.updatedAt)}</p>
          <a className="button secondary inline" href={document.href} rel="noreferrer" target="_blank">
            Open document
          </a>
        </article>
      ))}
    </section>
  )
}

function CommentsPage({
  role,
  comments,
  onAddComment,
  onTogglePinComment,
  onDeleteComment,
}: {
  role: UserRole
  comments: CommentEntry[]
  onAddComment: (input: { author: string; message: string }) => void
  onTogglePinComment: (id: string) => void
  onDeleteComment: (id: string) => void
}) {
  const [author, setAuthor] = useState(() => (role === 'admin' ? 'Board moderator' : ''))
  const [message, setMessage] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!author.trim() || !message.trim()) {
      return
    }
    onAddComment({
      author: author.trim(),
      message: message.trim(),
    })
    setMessage('')
  }

  return (
    <section className="card-list">
      <article className="card">
        <h3>Share a comment</h3>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input onChange={(event) => setAuthor(event.target.value)} value={author} />
          </label>
          <label className="field">
            <span>Comment</span>
            <textarea onChange={(event) => setMessage(event.target.value)} rows={4} value={message} />
          </label>
          <button className="button" type="submit">
            Post comment
          </button>
        </form>
      </article>

      {comments.map((comment) => (
        <article className="card" key={comment.id}>
          <div className="row-between">
            <div>
              <h3>{comment.author}</h3>
              <p className="helper-text">{formatDateTime(comment.createdAt)}</p>
            </div>
            <div className="inline-actions">
              {comment.pinned && <span className="pill gold">Pinned</span>}
              {role === 'admin' && (
                <>
                  <button className="button secondary inline" onClick={() => onTogglePinComment(comment.id)} type="button">
                    {comment.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button className="button danger inline" onClick={() => onDeleteComment(comment.id)} type="button">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
          <p>{comment.message}</p>
        </article>
      ))}
    </section>
  )
}

function AdminPage({
  announcements,
  documents,
  comments,
  apiBaseUrl,
  syncMode,
  syncBusy,
  syncMessage,
  syncError,
  lastSyncAt,
  onApiBaseUrlChange,
  onSyncModeChange,
  onTestConnection,
  onSyncToBackend,
  onPullFromBackend,
}: {
  announcements: Announcement[]
  documents: PortalDocument[]
  comments: CommentEntry[]
  apiBaseUrl: string
  syncMode: SyncMode
  syncBusy: boolean
  syncMessage: string
  syncError: string
  lastSyncAt: string | null
  onApiBaseUrlChange: (value: string) => void
  onSyncModeChange: (mode: SyncMode) => void
  onTestConnection: () => Promise<void>
  onSyncToBackend: () => Promise<void>
  onPullFromBackend: () => Promise<void>
}) {
  const boardOnlyCount = announcements.filter((announcement) => announcement.audience === 'board').length
  const pinnedCount = comments.filter((comment) => comment.pinned).length

  return (
    <section className="card-list">
      <article className="card">
        <p className="eyebrow">Admin snapshot</p>
        <h3>Moderation and publishing overview</h3>
        <div className="stat-grid compact">
          <div className="mini-stat">
            <strong>{announcements.length}</strong>
            <span>Total announcements</span>
          </div>
          <div className="mini-stat">
            <strong>{boardOnlyCount}</strong>
            <span>Board-only notices</span>
          </div>
          <div className="mini-stat">
            <strong>{documents.length}</strong>
            <span>Document links</span>
          </div>
          <div className="mini-stat">
            <strong>{pinnedCount}</strong>
            <span>Pinned comments</span>
          </div>
        </div>
      </article>

      <article className="card">
        <p className="eyebrow">Shared data sync</p>
        <h3>Backend synchronization panel</h3>
        <p className="helper-text">
          Use a hosted API URL (or keep blank for same-origin). For local testing with the included API server, use
          <code>http://localhost:8787</code>.
        </p>
        <div className="form-stack">
          <label className="field">
            <span>Database API base URL</span>
            <input
              onChange={(event) => onApiBaseUrlChange(event.target.value)}
              placeholder="https://your-api-host.example.com"
              value={apiBaseUrl}
            />
          </label>
          <label className="field">
            <span>Sync mode</span>
            <select
              onChange={(event) => onSyncModeChange(event.target.value as SyncMode)}
              value={syncMode}
            >
              {SYNC_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sync-actions">
            <button className="button secondary" disabled={syncBusy} onClick={() => void onTestConnection()} type="button">
              Test connection
            </button>
            <button className="button" disabled={syncBusy} onClick={() => void onSyncToBackend()} type="button">
              {syncBusy ? 'Working…' : 'Sync local data to backend'}
            </button>
            <button className="button secondary" disabled={syncBusy} onClick={() => void onPullFromBackend()} type="button">
              {syncBusy ? 'Working…' : 'Load data from backend'}
            </button>
          </div>
          {syncMessage && <p className="status-message success">{syncMessage}</p>}
          {syncError && <p className="status-message error">{syncError}</p>}
          {lastSyncAt && <p className="helper-text">Last sync action: {formatDateTime(lastSyncAt)}</p>}
        </div>
      </article>
    </section>
  )
}

function JoinPage() {
  return (
    <section className="card">
      <h3>Help shape CommunityPortal</h3>
      <p>
        The portal now has role-gated publishing modules plus backend sync hooks. Next passes can layer in resident
        authentication and full PostgreSQL-powered persistence.
      </p>
      <ol>
        <li>Connect login sessions and role assignment to backend records.</li>
        <li>Add attachment upload and document metadata management.</li>
        <li>Implement audit history for moderation and content changes.</li>
      </ol>
    </section>
  )
}

function formatDate(dateValue: string) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateValue: string) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return dateValue
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default App
