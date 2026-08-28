import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'

const MOBILE_BREAKPOINT_PX = 920
const MIN_LOGIN_SECRET_LENGTH = 8
const DEFAULT_TOTAL_LOTS = 200
const MAX_TOTAL_LOTS = 500
const MIN_TOTAL_LOTS = 1
const BACKUP_TYPE = 'communityportal-sync-backup'
const BACKUP_VERSION = 1
const ADMIN_ALLOWED_USERS = ['Tracy Baggett']

const STORAGE_KEYS = {
  user: 'fw_user',
  announcements: 'fw_announcements',
  documents: 'fw_documents',
  comments: 'fw_comments',
  voteLedger: 'fw_vote_ledger',
  totalLots: 'fw_total_lots',
  apiBaseUrl: 'fw_db_api_base_url',
}

type AccessRole = 'primary' | 'commentOnly'
type PageId =
  | 'home'
  | 'documents'
  | 'comparison'
  | 'proposed'
  | 'risks'
  | 'str'
  | 'profile'
  | 'comments'
  | 'dashboard'
  | 'admin-votes'
  | 'admin-docs'
type SyncMode = 'replace' | 'merge' | 'missing'
type VoteChoice = 'eliminate' | 'permit' | 'undecided'
type CommentTopic = 'str' | 'acc' | 'general' | 'process'
type CommentStance = 'support' | 'oppose' | 'neutral'
type AnnouncementAudience = 'all' | 'board'

interface PortalUser {
  name: string
  lot: string
  lots: string[]
  isAdmin: boolean
  accessRole: AccessRole
  loginSecret: string
}

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

interface CommunityComment {
  id: string
  lot: string
  name: string
  topic: CommentTopic
  stance: CommentStance
  concern: string
  message: string
  ts: string
}

interface PortalSyncPayload {
  announcements: Announcement[]
  documents: PortalDocument[]
  comments: CommunityComment[]
}

interface NavItem {
  id: PageId
  label: string
  adminOnly?: boolean
  residentOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Overview' },
  { id: 'documents', label: 'CC&R Documents' },
  { id: 'comparison', label: 'Side-by-side compare' },
  { id: 'proposed', label: 'Proposed One CC&R' },
  { id: 'risks', label: 'Risks of inaction' },
  { id: 'str', label: 'STR vote' },
  { id: 'profile', label: 'My profile', residentOnly: true },
  { id: 'comments', label: 'Community comments' },
  { id: 'dashboard', label: 'Campaign dashboard' },
  { id: 'admin-votes', label: 'Admin voting roster', adminOnly: true },
  { id: 'admin-docs', label: 'Admin document tools', adminOnly: true },
]

const PAGE_TITLES: Record<PageId, string> = {
  home: 'Overview',
  documents: 'CC&R Documents',
  comparison: 'Side-by-side comparison',
  proposed: 'Proposed One Community CC&R',
  risks: 'Risks of inaction',
  str: 'Short-Term Rental vote',
  profile: 'Resident profile',
  comments: 'Community comments',
  dashboard: 'Campaign dashboard',
  'admin-votes': 'Admin voting roster',
  'admin-docs': 'Admin document tools',
}

const SYNC_MODE_OPTIONS: Array<{ value: SyncMode; label: string }> = [
  { value: 'replace', label: 'Replace local with remote' },
  { value: 'merge', label: 'Merge remote into local' },
  { value: 'missing', label: 'Fill local missing only' },
]

const TOPIC_LABELS: Record<CommentTopic, string> = {
  str: 'Short-term rentals',
  acc: 'ACC guidelines',
  general: 'General covenants',
  process: 'Process and voting',
}

const STANCE_LABELS: Record<CommentStance, string> = {
  support: 'Supports',
  oppose: 'Requests changes',
  neutral: 'Question / neutral',
}

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'One-community framework rollout',
    summary: 'CommunityPortal now follows the same framework baseline used in the covenant platform.',
    date: '2026-08-28',
    audience: 'all',
  },
  {
    id: 'ann-2',
    title: 'Board prep packet review',
    summary: 'Admin reviewers can validate policy packet wording before resident publication.',
    date: '2026-08-29',
    audience: 'board',
  },
]

const DEFAULT_DOCUMENTS: PortalDocument[] = [
  {
    id: 'doc-2008',
    title: '2008 Master Declaration of CC&Rs',
    category: 'Original',
    updatedAt: '2026-08-20',
    href: '#',
  },
  {
    id: 'doc-2014',
    title: '2014 Declaration of Covenants',
    category: 'Phase II active',
    updatedAt: '2026-08-20',
    href: '#',
  },
  {
    id: 'doc-2021',
    title: '2021 Consolidated Declaration',
    category: 'Disputed',
    updatedAt: '2026-08-20',
    href: '#',
  },
]

const DEFAULT_COMMENTS: CommunityComment[] = [
  {
    id: 'comment-1',
    lot: 'Lot 36',
    name: 'Community Member',
    topic: 'str',
    stance: 'support',
    concern: 'Traffic and parking pressure',
    message: 'I support one clear standard for STR policy across all lots.',
    ts: 'Aug 28, 2026',
  },
]

const COMPARISON_ROWS = [
  {
    topic: 'STR policy',
    c2008: 'Not addressed',
    c2014: 'Not addressed',
    c2021: 'Restrictions disputed by consent-only process',
    guidance: 'Adopt one ratified section across all lots',
  },
  {
    topic: 'ACC standards',
    c2008: 'Limited detail',
    c2014: 'No ACC section',
    c2021: 'Expanded ACC governance language',
    guidance: 'Keep enforceable minimum standards + clear review path',
  },
  {
    topic: 'Lake & wetlands',
    c2008: 'Comprehensive',
    c2014: 'Not addressed',
    c2021: 'Comprehensive updates',
    guidance: 'Retain protections and unify wording',
  },
]

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function parseLotsInput(rawLots: string) {
  const parts = rawLots
    .split(/[,\n]/)
    .map((value) => normalizeLotLabel(value))
    .filter((value): value is string => Boolean(value))
  return [...new Set(parts)]
}

function normalizeLotLabel(value: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase() === 'admin') return 'ADMIN'
  const token = trimmed.replace(/^lot\s*/i, '').replace(/\s+/g, '').toUpperCase()
  if (!token) return null
  return `Lot ${token}`
}

function isAdminName(name: string) {
  const normalized = name.trim().toLowerCase()
  return ADMIN_ALLOWED_USERS.some((entry) => entry.toLowerCase() === normalized)
}

function buildLotLabels(totalLots: number) {
  const count = Math.max(MIN_TOTAL_LOTS, Math.min(MAX_TOTAL_LOTS, Number(totalLots) || DEFAULT_TOTAL_LOTS))
  return Array.from({ length: count }, (_, idx) => `Lot ${idx + 1}`)
}

function formatDate(input: string) {
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    return input
  }
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function computeVoteCounts(ledger: Record<string, VoteChoice>) {
  return Object.values(ledger).reduce(
    (acc, choice) => {
      if (choice === 'eliminate') acc.eliminate += 1
      if (choice === 'permit') acc.permit += 1
      if (choice === 'undecided') acc.undecided += 1
      return acc
    },
    { eliminate: 0, permit: 0, undecided: 0 },
  )
}

function sanitizeAnnouncement(value: unknown): Announcement | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<Announcement>
  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.summary !== 'string' ||
    typeof row.date !== 'string'
  ) {
    return null
  }
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    date: row.date,
    audience: row.audience === 'board' ? 'board' : 'all',
  }
}

function sanitizeDocument(value: unknown): PortalDocument | null {
  if (!value || typeof value !== 'object') return null
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

function sanitizeComment(value: unknown): CommunityComment | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Partial<CommunityComment>
  if (
    typeof row.id !== 'string' ||
    typeof row.lot !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.concern !== 'string' ||
    typeof row.message !== 'string' ||
    typeof row.ts !== 'string'
  ) {
    return null
  }
  return {
    id: row.id,
    lot: row.lot,
    name: row.name,
    topic: row.topic === 'acc' || row.topic === 'process' || row.topic === 'str' ? row.topic : 'general',
    stance: row.stance === 'oppose' || row.stance === 'support' ? row.stance : 'neutral',
    concern: row.concern,
    message: row.message,
    ts: row.ts,
  }
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  const byId = new Map<string, T>()
  rows.forEach((row) => {
    if (!row.id) return
    byId.set(row.id, row)
  })
  return [...byId.values()]
}

function mergeByMode<T extends { id: string }>(localRows: T[], incomingRows: T[], mode: SyncMode) {
  if (mode === 'replace') {
    return dedupeById(incomingRows)
  }
  const byId = new Map(localRows.map((row) => [row.id, row]))
  if (mode === 'merge') {
    incomingRows.forEach((row) => byId.set(row.id, row))
  } else {
    incomingRows.forEach((row) => {
      if (!byId.has(row.id)) byId.set(row.id, row)
    })
  }
  return [...byId.values()]
}

function buildApiUrl(baseUrl: string, path: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return normalized ? `${normalized}${normalizedPath}` : normalizedPath
}

async function requestApiJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(baseUrl, path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const json = (await response.json()) as { error?: string }
  if (!response.ok) {
    throw new Error(json.error || `Request failed (${response.status})`)
  }
  return json as T
}

function App() {
  const [user, setUser] = useState<PortalUser | null>(() => readStored<PortalUser | null>(STORAGE_KEYS.user, null))
  const [page, setPage] = useState<PageId>('home')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )
  const [totalLots, setTotalLots] = useState<number>(() => readStored<number>(STORAGE_KEYS.totalLots, DEFAULT_TOTAL_LOTS))
  const [voteLedger, setVoteLedger] = useState<Record<string, VoteChoice>>(() =>
    readStored<Record<string, VoteChoice>>(STORAGE_KEYS.voteLedger, {}),
  )
  const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
    readStored<Announcement[]>(STORAGE_KEYS.announcements, DEFAULT_ANNOUNCEMENTS),
  )
  const [documents, setDocuments] = useState<PortalDocument[]>(() =>
    readStored<PortalDocument[]>(STORAGE_KEYS.documents, DEFAULT_DOCUMENTS),
  )
  const [comments, setComments] = useState<CommunityComment[]>(() =>
    readStored<CommunityComment[]>(STORAGE_KEYS.comments, DEFAULT_COMMENTS),
  )

  const [apiBaseUrl, setApiBaseUrl] = useState(() => readStored<string>(STORAGE_KEYS.apiBaseUrl, ''))
  const [syncMode, setSyncMode] = useState<SyncMode>('merge')
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [voteMessage, setVoteMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportWidth(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.totalLots, JSON.stringify(totalLots))
  }, [totalLots])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.voteLedger, JSON.stringify(voteLedger))
  }, [voteLedger])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.announcements, JSON.stringify(announcements))
  }, [announcements])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents))
  }, [documents])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.comments, JSON.stringify(comments))
  }, [comments])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.apiBaseUrl, apiBaseUrl)
  }, [apiBaseUrl])

  const isMobile = viewportWidth <= MOBILE_BREAKPOINT_PX
  const allLots = useMemo(() => buildLotLabels(totalLots), [totalLots])
  const votes = useMemo(() => computeVoteCounts(voteLedger), [voteLedger])
  const votedLots = useMemo(() => Object.keys(voteLedger).length, [voteLedger])
  const votesNeeded = useMemo(() => Math.ceil(totalLots * 0.67), [totalLots])

  const visibleAnnouncements = useMemo(
    () => announcements.filter((announcement) => user?.isAdmin || announcement.audience === 'all'),
    [announcements, user?.isAdmin],
  )

  const sortedComments = useMemo(() => {
    return [...comments].sort((a, b) => {
      const left = new Date(a.ts).getTime()
      const right = new Date(b.ts).getTime()
      if (!Number.isNaN(left) && !Number.isNaN(right)) return right - left
      return b.ts.localeCompare(a.ts)
    })
  }, [comments])

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (item.adminOnly && !user?.isAdmin) return false
      if (item.residentOnly && user?.isAdmin) return false
      return true
    })
  }, [user?.isAdmin])

  const safePage = useMemo<PageId>(() => {
    if (page === 'admin-votes' || page === 'admin-docs') {
      return user?.isAdmin ? page : 'home'
    }
    if (page === 'profile') {
      return user?.isAdmin ? 'home' : page
    }
    return page
  }, [page, user?.isAdmin])

  if (!user) {
    return <LoginScreen onLogin={setUser} />
  }

  const handleLogout = () => {
    setUser(null)
    setPage('home')
  }

  const handleVote = (choice: VoteChoice) => {
    if (user.isAdmin) {
      setVoteMessage('Admins are read-only for resident vote casting.')
      return
    }
    if (user.accessRole !== 'primary') {
      setVoteMessage('Comment-only access cannot cast votes.')
      return
    }
    const next = { ...voteLedger }
    user.lots.forEach((lot) => {
      next[lot] = choice
    })
    setVoteLedger(next)
    setVoteMessage(`Recorded "${choice}" for ${user.lots.join(', ')}.`)
  }

  const handleAddAnnouncement = (payload: { title: string; summary: string; audience: AnnouncementAudience }) => {
    const next: Announcement = {
      id: createId('announcement'),
      title: payload.title,
      summary: payload.summary,
      audience: payload.audience,
      date: new Date().toISOString().slice(0, 10),
    }
    setAnnouncements((current) => [next, ...current])
  }

  const handleAddDocument = (payload: { title: string; category: string; href: string }) => {
    const next: PortalDocument = {
      id: createId('document'),
      title: payload.title,
      category: payload.category,
      href: payload.href,
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    setDocuments((current) => [next, ...current])
  }

  const handleAddComment = (payload: { topic: CommentTopic; stance: CommentStance; concern: string; message: string }) => {
    const next: CommunityComment = {
      id: createId('comment'),
      lot: user.lot,
      name: user.name,
      topic: payload.topic,
      stance: payload.stance,
      concern: payload.concern,
      message: payload.message,
      ts: new Date().toISOString(),
    }
    setComments((current) => [next, ...current])
  }

  const handleDeleteComment = (id: string) => {
    setComments((current) => current.filter((comment) => comment.id !== id))
  }

  const handleSyncTest = async () => {
    setSyncBusy(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const response = await requestApiJson<{ service?: string; now?: string }>(apiBaseUrl, '/api/portal/health')
      setSyncMessage(`Connected to ${response.service || 'portal API'} (${response.now || 'time unavailable'}).`)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Connection test failed.')
    } finally {
      setSyncBusy(false)
    }
  }

  const handleSyncPush = async () => {
    setSyncBusy(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const payload: PortalSyncPayload = { announcements, documents, comments }
      const response = await requestApiJson<{ message?: string }>(apiBaseUrl, '/api/portal/sync', {
        method: 'POST',
        body: JSON.stringify({
          backup: {
            backupType: BACKUP_TYPE,
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            payload,
          },
          mode: syncMode,
          scopes: {
            announcements: true,
            documents: true,
            comments: true,
          },
        }),
      })
      setSyncMessage(response.message || 'Sync completed.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed.')
    } finally {
      setSyncBusy(false)
    }
  }

  const handleSyncPull = async () => {
    setSyncBusy(true)
    setSyncError('')
    setSyncMessage('')
    try {
      const response = await requestApiJson<{ backup?: { payload?: unknown } }>(apiBaseUrl, '/api/portal/export')
      const source = response.backup?.payload
      const incomingAnnouncements = Array.isArray((source as PortalSyncPayload | undefined)?.announcements)
        ? (source as PortalSyncPayload).announcements.map(sanitizeAnnouncement).filter((row): row is Announcement => Boolean(row))
        : []
      const incomingDocuments = Array.isArray((source as PortalSyncPayload | undefined)?.documents)
        ? (source as PortalSyncPayload).documents.map(sanitizeDocument).filter((row): row is PortalDocument => Boolean(row))
        : []
      const incomingComments = Array.isArray((source as PortalSyncPayload | undefined)?.comments)
        ? (source as PortalSyncPayload).comments.map(sanitizeComment).filter((row): row is CommunityComment => Boolean(row))
        : []

      setAnnouncements((current) => mergeByMode(current, incomingAnnouncements, syncMode))
      setDocuments((current) => mergeByMode(current, incomingDocuments, syncMode))
      setComments((current) => mergeByMode(current, incomingComments, syncMode))
      setSyncMessage('Loaded backend data successfully.')
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Load failed.')
    } finally {
      setSyncBusy(false)
    }
  }

  return (
    <div className="portal-shell">
      {isMobile && mobileNavOpen && (
        <button
          aria-label="Close menu overlay"
          className="portal-overlay"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      )}

      <aside className={`portal-sidebar ${isMobile ? 'mobile' : ''} ${mobileNavOpen ? 'open' : ''}`}>
        <div className="portal-brand">
          <p className="brand-kicker">CommunityPortal</p>
          <h1>Falling Waters</h1>
          <p>Covenant Unification Framework</p>
        </div>
        <div className="portal-user">
          <p>
            <strong>{user.name}</strong>
          </p>
          <p>{user.lot}</p>
          <span className={`badge ${user.isAdmin ? 'admin' : 'resident'}`}>
            {user.isAdmin ? 'Admin control mode' : `${user.accessRole === 'primary' ? 'Primary voter' : 'Comment-only'} mode`}
          </span>
        </div>
        <nav className="portal-nav" aria-label="Primary">
          {visibleNavItems.map((item) => (
            <button
              className={safePage === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => {
                setPage(item.id)
                setMobileNavOpen(false)
              }}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="portal-sidebar-bottom">
          <button className="button secondary" onClick={handleLogout} type="button">
            Sign out
          </button>
        </div>
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
            <h2>{PAGE_TITLES[safePage]}</h2>
          </div>
          <div className="topbar-meta">
            <span>{votes.eliminate} eliminate votes</span>
            <span>{votesNeeded} needed ({totalLots} lots)</span>
            {safePage !== 'str' && (
              <button className="button" onClick={() => setPage('str')} type="button">
                Go to STR vote
              </button>
            )}
          </div>
        </header>

        <main className="portal-content">
          {user.isAdmin && (
            <Alert type="warn">
              <strong>Admin Control Mode:</strong> this view includes roster settings, sync tools, and document
              management controls.
            </Alert>
          )}
          {voteMessage && <Alert type="info">{voteMessage}</Alert>}
          {safePage === 'home' && (
            <HomePage
              announcements={visibleAnnouncements}
              commentsCount={comments.length}
              totalLots={totalLots}
              votedLots={votedLots}
              votesNeeded={votesNeeded}
            />
          )}
          {safePage === 'documents' && (
            <DocumentsPage documents={documents} isAdmin={user.isAdmin} onAddDocument={handleAddDocument} />
          )}
          {safePage === 'comparison' && <ComparisonPage />}
          {safePage === 'proposed' && <ProposedPage />}
          {safePage === 'risks' && <RisksPage />}
          {safePage === 'str' && (
            <STRPage
              user={user}
              votes={votes}
              votesNeeded={votesNeeded}
              votedLots={votedLots}
              onVote={handleVote}
            />
          )}
          {safePage === 'profile' && <ProfilePage user={user} voteLedger={voteLedger} />}
          {safePage === 'comments' && (
            <CommentsPage comments={sortedComments} isAdmin={user.isAdmin} onAddComment={handleAddComment} onDeleteComment={handleDeleteComment} />
          )}
          {safePage === 'dashboard' && (
            <DashboardPage
              commentsCount={comments.length}
              votes={votes}
              totalLots={totalLots}
              votedLots={votedLots}
              documentsCount={documents.length}
            />
          )}
          {safePage === 'admin-votes' && user.isAdmin && (
            <AdminVotesPage
              allLots={allLots}
              apiBaseUrl={apiBaseUrl}
              onApiBaseUrlChange={setApiBaseUrl}
              onLoadFromBackend={handleSyncPull}
              onSyncModeChange={setSyncMode}
              onSyncToBackend={handleSyncPush}
              onTestConnection={handleSyncTest}
              setTotalLots={setTotalLots}
              syncBusy={syncBusy}
              syncError={syncError}
              syncMessage={syncMessage}
              syncMode={syncMode}
              totalLots={totalLots}
              voteLedger={voteLedger}
            />
          )}
          {safePage === 'admin-docs' && user.isAdmin && (
            <AdminDocsPage announcements={announcements} onAddAnnouncement={handleAddAnnouncement} />
          )}
        </main>
      </div>
    </div>
  )
}

function Alert({ type, children }: { type: 'warn' | 'info'; children: ReactNode }) {
  return <div className={`alert ${type}`}>{children}</div>
}

function LoginScreen({ onLogin }: { onLogin: (user: PortalUser) => void }) {
  const [lot, setLot] = useState('')
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [accessRole, setAccessRole] = useState<AccessRole>('primary')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const hasAdminAccess = isAdminName(trimmedName)
    const parsedLots = hasAdminAccess ? ['ADMIN'] : parseLotsInput(lot)
    if ((!hasAdminAccess && parsedLots.length === 0) || !trimmedName || pw.trim().length < MIN_LOGIN_SECRET_LENGTH) {
      setError(
        `Enter name, lot number(s), and password (${MIN_LOGIN_SECRET_LENGTH}+ chars). Admin users can leave lot blank.`,
      )
      return
    }
    const nextUser: PortalUser = {
      lot: parsedLots.length === 1 ? parsedLots[0] : parsedLots.join(', '),
      lots: parsedLots,
      name: trimmedName,
      accessRole: hasAdminAccess ? 'primary' : accessRole,
      isAdmin: hasAdminAccess,
      loginSecret: pw.trim(),
    }
    setError('')
    onLogin(nextUser)
  }

  return (
    <div className="login-screen">
      <section className="login-card">
        <p className="eyebrow">CommunityPortal</p>
        <h1>Falling Waters Covenant Portal</h1>
        <p className="muted">
          This framework mirrors the Community Covenant Platform layout, role model, and section architecture.
        </p>
        {error && <Alert type="warn">{error}</Alert>}
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Lot number(s)</span>
            <input
              onChange={(event) => setLot(event.target.value)}
              placeholder="e.g. Lot 36, Lot 37"
              type="text"
              value={lot}
            />
          </label>
          <label className="field">
            <span>Your name</span>
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="First and last name"
              type="text"
              value={name}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              onChange={(event) => setPw(event.target.value)}
              placeholder={`Minimum ${MIN_LOGIN_SECRET_LENGTH} characters`}
              type="password"
              value={pw}
            />
          </label>
          <label className="field">
            <span>Access role</span>
            <select onChange={(event) => setAccessRole(event.target.value as AccessRole)} value={accessRole}>
              <option value="primary">Primary voter (vote + comment)</option>
              <option value="commentOnly">Comment-only household member</option>
            </select>
          </label>
          <button className="button" type="submit">
            Enter portal
          </button>
        </form>
      </section>
    </div>
  )
}

function HomePage({
  announcements,
  commentsCount,
  totalLots,
  votedLots,
  votesNeeded,
}: {
  announcements: Announcement[]
  commentsCount: number
  totalLots: number
  votedLots: number
  votesNeeded: number
}) {
  return (
    <>
      <section className="card">
        <h3>One-community status snapshot</h3>
        <div className="stat-grid">
          <StatCard label="Total lots" value={totalLots} />
          <StatCard label="Lots with recorded votes" value={votedLots} />
          <StatCard label="Votes needed (67%)" value={votesNeeded} />
          <StatCard label="Community comments" value={commentsCount} />
        </div>
      </section>
      <section className="card-list">
        {announcements.map((announcement) => (
          <article className="card" key={announcement.id}>
            <div className="row-between">
              <h3>{announcement.title}</h3>
              <span className={`pill ${announcement.audience === 'board' ? 'gold' : 'soft'}`}>
                {announcement.audience === 'board' ? 'Board notice' : 'Resident notice'}
              </span>
            </div>
            <p>{announcement.summary}</p>
            <p className="helper-text">Posted {formatDate(announcement.date)}</p>
          </article>
        ))}
      </section>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="card stat-card">
      <p className="stat-number">{value}</p>
      <p className="stat-label">{label}</p>
    </article>
  )
}

function DocumentsPage({
  documents,
  isAdmin,
  onAddDocument,
}: {
  documents: PortalDocument[]
  isAdmin: boolean
  onAddDocument: (payload: { title: string; category: string; href: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [href, setHref] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !category.trim() || !href.trim()) return
    onAddDocument({ title: title.trim(), category: category.trim(), href: href.trim() })
    setTitle('')
    setCategory('')
    setHref('')
  }

  return (
    <section className="card-list">
      {isAdmin && (
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
              <input onChange={(event) => setHref(event.target.value)} value={href} />
            </label>
            <button className="button" type="submit">
              Save document
            </button>
          </form>
        </article>
      )}

      {documents.map((doc) => (
        <article className="card" key={doc.id}>
          <div className="row-between">
            <h3>{doc.title}</h3>
            <span className="pill soft">{doc.category}</span>
          </div>
          <p className="helper-text">Updated {formatDate(doc.updatedAt)}</p>
          <a className="button secondary inline" href={doc.href} rel="noreferrer" target="_blank">
            Open document
          </a>
        </article>
      ))}
    </section>
  )
}

function ComparisonPage() {
  return (
    <section className="card">
      <h3>Document comparison highlights</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>2008</th>
              <th>2014</th>
              <th>2021</th>
              <th>Unification guidance</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.topic}>
                <td>{row.topic}</td>
                <td>{row.c2008}</td>
                <td>{row.c2014}</td>
                <td>{row.c2021}</td>
                <td>{row.guidance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ProposedPage() {
  return (
    <section className="card">
      <h3>Proposed One Community CC&R framework</h3>
      <ol>
        <li>Unify the currently split covenant documents into one ratified source.</li>
        <li>Preserve core protections (lake, wetlands, community standards) across all lots.</li>
        <li>Add clear STR + ACC sections with enforceable language and transparent governance.</li>
      </ol>
    </section>
  )
}

function RisksPage() {
  return (
    <section className="card-list">
      <article className="card">
        <h3>Legal ambiguity across phases</h3>
        <p>Different covenant texts across lots create enforceability uncertainty and owner confusion.</p>
      </article>
      <article className="card">
        <h3>Operational inconsistency</h3>
        <p>Without one framework, board decisions can appear uneven even when intent is fair.</p>
      </article>
      <article className="card">
        <h3>Long-term resale and lender friction</h3>
        <p>Undefined cross-phase policy can create avoidable diligence concerns in transactions.</p>
      </article>
    </section>
  )
}

function STRPage({
  user,
  votes,
  votesNeeded,
  votedLots,
  onVote,
}: {
  user: PortalUser
  votes: { eliminate: number; permit: number; undecided: number }
  votesNeeded: number
  votedLots: number
  onVote: (choice: VoteChoice) => void
}) {
  const canVote = !user.isAdmin && user.accessRole === 'primary'
  return (
    <section className="card-list">
      <article className="card">
        <h3>Current vote totals</h3>
        <div className="stat-grid compact">
          <StatCard label="Eliminate STRs" value={votes.eliminate} />
          <StatCard label="Permit STRs" value={votes.permit} />
          <StatCard label="Undecided" value={votes.undecided} />
          <StatCard label="Lots with votes" value={votedLots} />
        </div>
        <p className="helper-text">{votesNeeded} eliminate votes are needed to pass the threshold.</p>
      </article>
      <article className="card">
        <h3>Cast vote</h3>
        {!canVote && (
          <p className="helper-text">
            {user.isAdmin
              ? 'Admin accounts cannot cast resident votes.'
              : 'Comment-only access cannot cast votes. Use primary voter access.'}
          </p>
        )}
        <div className="inline-actions">
          <button className="button" disabled={!canVote} onClick={() => onVote('eliminate')} type="button">
            Eliminate STRs
          </button>
          <button className="button secondary" disabled={!canVote} onClick={() => onVote('permit')} type="button">
            Permit STRs
          </button>
          <button className="button secondary" disabled={!canVote} onClick={() => onVote('undecided')} type="button">
            Undecided
          </button>
        </div>
      </article>
    </section>
  )
}

function ProfilePage({ user, voteLedger }: { user: PortalUser; voteLedger: Record<string, VoteChoice> }) {
  return (
    <section className="card">
      <h3>Resident profile</h3>
      <p>
        <strong>Name:</strong> {user.name}
      </p>
      <p>
        <strong>Lot(s):</strong> {user.lots.join(', ')}
      </p>
      <p>
        <strong>Access role:</strong> {user.accessRole === 'primary' ? 'Primary voter' : 'Comment-only'}
      </p>
      <p>
        <strong>Current vote record:</strong>{' '}
        {user.lots.map((lot) => `${lot}: ${voteLedger[lot] || 'not set'}`).join(' · ')}
      </p>
    </section>
  )
}

function CommentsPage({
  comments,
  isAdmin,
  onAddComment,
  onDeleteComment,
}: {
  comments: CommunityComment[]
  isAdmin: boolean
  onAddComment: (payload: { topic: CommentTopic; stance: CommentStance; concern: string; message: string }) => void
  onDeleteComment: (id: string) => void
}) {
  const [topic, setTopic] = useState<CommentTopic>('str')
  const [stance, setStance] = useState<CommentStance>('neutral')
  const [concern, setConcern] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!concern.trim() || !message.trim()) return
    onAddComment({
      topic,
      stance,
      concern: concern.trim(),
      message: message.trim(),
    })
    setConcern('')
    setMessage('')
  }

  return (
    <section className="card-list">
      <article className="card">
        <h3>Share community feedback</h3>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Topic</span>
            <select onChange={(event) => setTopic(event.target.value as CommentTopic)} value={topic}>
              <option value="str">Short-term rentals</option>
              <option value="acc">ACC building guidelines</option>
              <option value="general">General covenants</option>
              <option value="process">Process and voting</option>
            </select>
          </label>
          <label className="field">
            <span>Position</span>
            <select onChange={(event) => setStance(event.target.value as CommentStance)} value={stance}>
              <option value="support">Support</option>
              <option value="oppose">Request changes</option>
              <option value="neutral">Question / neutral</option>
            </select>
          </label>
          <label className="field">
            <span>Primary concern</span>
            <input onChange={(event) => setConcern(event.target.value)} value={concern} />
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
            <h3>
              {comment.lot} · {comment.name}
            </h3>
            <span className="pill soft">{comment.ts}</span>
          </div>
          <p className="helper-text">
            {TOPIC_LABELS[comment.topic]} · {STANCE_LABELS[comment.stance]} · {comment.concern}
          </p>
          <p>{comment.message}</p>
          {isAdmin && (
            <div className="inline-actions">
              <button className="button danger inline" onClick={() => onDeleteComment(comment.id)} type="button">
                Delete
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function DashboardPage({
  commentsCount,
  votes,
  totalLots,
  votedLots,
  documentsCount,
}: {
  commentsCount: number
  votes: { eliminate: number; permit: number; undecided: number }
  totalLots: number
  votedLots: number
  documentsCount: number
}) {
  const turnoutPct = totalLots > 0 ? Math.round((votedLots / totalLots) * 100) : 0
  return (
    <section className="card-list">
      <article className="card">
        <h3>Campaign metrics</h3>
        <div className="stat-grid compact">
          <StatCard label="Total lots" value={totalLots} />
          <StatCard label="Voted lots" value={votedLots} />
          <StatCard label="Turnout %" value={turnoutPct} />
          <StatCard label="Comments" value={commentsCount} />
          <StatCard label="Documents" value={documentsCount} />
          <StatCard label="Eliminate votes" value={votes.eliminate} />
        </div>
      </article>
      <article className="card">
        <h3>Operational notes</h3>
        <ol>
          <li>Use admin roster page to adjust lot count and sync shared data.</li>
          <li>Use admin document tools to post resident or board-only announcements.</li>
          <li>Review comments weekly and summarize trends in board communications.</li>
        </ol>
      </article>
    </section>
  )
}

interface AdminVotesPageProps {
  totalLots: number
  setTotalLots: (value: number) => void
  voteLedger: Record<string, VoteChoice>
  allLots: string[]
  apiBaseUrl: string
  onApiBaseUrlChange: (value: string) => void
  syncMode: SyncMode
  onSyncModeChange: (mode: SyncMode) => void
  syncBusy: boolean
  syncMessage: string
  syncError: string
  onTestConnection: () => Promise<void>
  onSyncToBackend: () => Promise<void>
  onLoadFromBackend: () => Promise<void>
}

function AdminVotesPage({
  totalLots,
  setTotalLots,
  voteLedger,
  allLots,
  apiBaseUrl,
  onApiBaseUrlChange,
  syncMode,
  onSyncModeChange,
  syncBusy,
  syncMessage,
  syncError,
  onTestConnection,
  onSyncToBackend,
  onLoadFromBackend,
}: AdminVotesPageProps) {
  const [nextLotsInput, setNextLotsInput] = useState(String(totalLots))
  const activeVoteRows = Object.entries(voteLedger)

  const handleLotsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number.parseInt(nextLotsInput, 10)
    if (Number.isNaN(parsed)) return
    const bounded = Math.max(MIN_TOTAL_LOTS, Math.min(MAX_TOTAL_LOTS, parsed))
    setTotalLots(bounded)
    setNextLotsInput(String(bounded))
  }

  return (
    <section className="card-list">
      <article className="card">
        <h3>Lot settings and roster snapshot</h3>
        <form className="inline-form" onSubmit={handleLotsSubmit}>
          <label className="field compact">
            <span>Total lots</span>
            <input onChange={(event) => setNextLotsInput(event.target.value)} value={nextLotsInput} />
          </label>
          <button className="button" type="submit">
            Save lot count
          </button>
        </form>
        <p className="helper-text">
          Available lots: {allLots.length}. Recorded vote rows: {activeVoteRows.length}.
        </p>
      </article>

      <article className="card">
        <h3>Shared data sync</h3>
        <div className="form-stack">
          <label className="field">
            <span>API base URL</span>
            <input
              onChange={(event) => onApiBaseUrlChange(event.target.value)}
              placeholder="http://localhost:8787"
              value={apiBaseUrl}
            />
          </label>
          <label className="field">
            <span>Sync mode</span>
            <select onChange={(event) => onSyncModeChange(event.target.value as SyncMode)} value={syncMode}>
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
              Sync local to backend
            </button>
            <button className="button secondary" disabled={syncBusy} onClick={() => void onLoadFromBackend()} type="button">
              Load backend to local
            </button>
          </div>
          {syncMessage && <p className="status-message success">{syncMessage}</p>}
          {syncError && <p className="status-message error">{syncError}</p>}
        </div>
      </article>
    </section>
  )
}

function AdminDocsPage({
  announcements,
  onAddAnnouncement,
}: {
  announcements: Announcement[]
  onAddAnnouncement: (payload: { title: string; summary: string; audience: AnnouncementAudience }) => void
}) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('all')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !summary.trim()) return
    onAddAnnouncement({ title: title.trim(), summary: summary.trim(), audience })
    setTitle('')
    setSummary('')
    setAudience('all')
  }

  return (
    <section className="card-list">
      <article className="card">
        <h3>Publish announcement</h3>
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
            <select onChange={(event) => setAudience(event.target.value as AnnouncementAudience)} value={audience}>
              <option value="all">All residents</option>
              <option value="board">Board only</option>
            </select>
          </label>
          <button className="button" type="submit">
            Publish
          </button>
        </form>
      </article>

      {announcements.map((announcement) => (
        <article className="card" key={announcement.id}>
          <div className="row-between">
            <h3>{announcement.title}</h3>
            <span className={`pill ${announcement.audience === 'board' ? 'gold' : 'soft'}`}>
              {announcement.audience === 'board' ? 'Board only' : 'All residents'}
            </span>
          </div>
          <p>{announcement.summary}</p>
          <p className="helper-text">Posted {formatDate(announcement.date)}</p>
        </article>
      ))}
    </section>
  )
}

export default App
