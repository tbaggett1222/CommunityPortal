import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const MOBILE_BREAKPOINT_PX = 960
const COMMENTS_STORAGE_KEY = 'communityportal.comments.v1'

type UserRole = 'resident' | 'admin'
type PageId = 'overview' | 'announcements' | 'documents' | 'comments' | 'join' | 'admin'
type AnnouncementAudience = 'all' | 'board'

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

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadInitialComments() {
  if (typeof window === 'undefined') {
    return INITIAL_COMMENTS
  }

  const raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY)
  if (!raw) {
    return INITIAL_COMMENTS
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return INITIAL_COMMENTS
    }

    return parsed.filter((comment): comment is CommentEntry => {
      return (
        typeof comment?.id === 'string' &&
        typeof comment?.author === 'string' &&
        typeof comment?.message === 'string' &&
        typeof comment?.createdAt === 'string' &&
        typeof comment?.pinned === 'boolean'
      )
    })
  } catch {
    return INITIAL_COMMENTS
  }
}

function App() {
  const [role, setRole] = useState<UserRole>('resident')
  const [page, setPage] = useState<PageId>('overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL_ANNOUNCEMENTS)
  const [documents, setDocuments] = useState<PortalDocument[]>(INITIAL_DOCUMENTS)
  const [comments, setComments] = useState<CommentEntry[]>(loadInitialComments)

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
    window.localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments))
  }, [comments])

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
    setAnnouncements((current) => [next, ...current])
  }

  const handleAddDocument = (input: { title: string; category: string; href: string }) => {
    const next: PortalDocument = {
      id: createId(),
      title: input.title,
      category: input.category,
      href: input.href,
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    setDocuments((current) => [next, ...current])
  }

  const handleAddComment = (input: { author: string; message: string }) => {
    const next: CommentEntry = {
      id: createId(),
      author: input.author,
      message: input.message,
      pinned: false,
      createdAt: new Date().toISOString(),
    }
    setComments((current) => [next, ...current])
  }

  const handleTogglePinComment = (id: string) => {
    setComments((current) =>
      current.map((comment) => (comment.id === id ? { ...comment, pinned: !comment.pinned } : comment)),
    )
  }

  const handleDeleteComment = (id: string) => {
    setComments((current) => current.filter((comment) => comment.id !== id))
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
              comments={sortedComments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onTogglePinComment={handleTogglePinComment}
              role={role}
            />
          )}
          {effectivePage === 'join' && <JoinPage />}
          {effectivePage === 'admin' && <AdminPage announcements={announcements} comments={comments} documents={documents} />}
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
          The portal now includes functional modules for announcements, documents, and comments, with admin-only
          publishing and moderation controls.
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
  const [author, setAuthor] = useState(role === 'admin' ? 'Board moderator' : '')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (role === 'admin' && !author.trim()) {
      setAuthor('Board moderator')
    }
  }, [author, role])

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
}: {
  announcements: Announcement[]
  documents: PortalDocument[]
  comments: CommentEntry[]
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
        <h3>Next integration pass</h3>
        <ol>
          <li>Replace local arrays with API-backed data services.</li>
          <li>Add authenticated resident and admin sessions.</li>
          <li>Attach file upload + database persistence from covenant platform backend patterns.</li>
        </ol>
      </article>
    </section>
  )
}

function JoinPage() {
  return (
    <section className="card">
      <h3>Help shape CommunityPortal</h3>
      <p>
        Early modules are now active. Next passes can focus on connecting this UI to the same shared persistence and
        role controls used in the Community Covenant Platform.
      </p>
      <ol>
        <li>Prioritize launch-ready modules by resident impact.</li>
        <li>Define moderation workflows for comments and announcements.</li>
        <li>Plan migration path from template data to live production records.</li>
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
