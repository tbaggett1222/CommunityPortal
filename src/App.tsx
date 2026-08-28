import { useEffect, useState } from 'react'
import './App.css'

const MOBILE_BREAKPOINT_PX = 960

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'initiatives', label: 'Initiatives' },
  { id: 'events', label: 'Events' },
  { id: 'resources', label: 'Resources' },
  { id: 'join', label: 'Get Involved' },
] as const

type PageId = (typeof navItems)[number]['id']

const pageTitles: Record<PageId, string> = {
  overview: 'Community Overview',
  initiatives: 'Active Initiatives',
  events: 'Upcoming Events',
  resources: 'Resident Resources',
  join: 'Get Involved',
}

function App() {
  const [page, setPage] = useState<PageId>('overview')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  )

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
    if (viewportWidth > MOBILE_BREAKPOINT_PX && mobileNavOpen) {
      setMobileNavOpen(false)
    }
  }, [mobileNavOpen, viewportWidth])

  const isMobile = viewportWidth <= MOBILE_BREAKPOINT_PX

  const navigateTo = (nextPage: PageId) => {
    setPage(nextPage)
    setMobileNavOpen(false)
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
          {navItems.map((item) => (
            <button
              className={page === item.id ? 'active' : ''}
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
            <h2>{pageTitles[page]}</h2>
          </div>
          <p className="topbar-note">Template shell based on Community Covenant Platform layout patterns.</p>
        </header>

        <main className="portal-content">
          {page === 'overview' && <OverviewPage />}
          {page === 'initiatives' && <InitiativesPage />}
          {page === 'events' && <EventsPage />}
          {page === 'resources' && <ResourcesPage />}
          {page === 'join' && <JoinPage />}
        </main>
      </div>
    </div>
  )
}

function OverviewPage() {
  return (
    <>
      <section className="card hero-card">
        <p className="eyebrow">Welcome</p>
        <h3>CommunityPortal homebase</h3>
        <p>
          This scaffold carries forward the app-shell approach from the Community Covenant Platform: consistent
          navigation, mobile-friendly layout, and clear cards for high-priority information.
        </p>
      </section>

      <section className="stat-grid">
        <article className="card stat-card">
          <p className="stat-number">4</p>
          <p className="stat-label">Current projects</p>
        </article>
        <article className="card stat-card">
          <p className="stat-number">2</p>
          <p className="stat-label">Upcoming meetings</p>
        </article>
        <article className="card stat-card">
          <p className="stat-number">118</p>
          <p className="stat-label">Resident households</p>
        </article>
      </section>
    </>
  )
}

function InitiativesPage() {
  return (
    <section className="card-list">
      <article className="card">
        <h3>Roadway safety program</h3>
        <p>Coordinate signage refresh and speed-calming recommendations from residents.</p>
      </article>
      <article className="card">
        <h3>Lake and wetlands stewardship</h3>
        <p>Track cleanup days, shoreline feedback, and volunteer participation.</p>
      </article>
      <article className="card">
        <h3>Community communication standards</h3>
        <p>Define publication rhythm for announcements, calendar updates, and meeting recaps.</p>
      </article>
    </section>
  )
}

function EventsPage() {
  return (
    <section className="card-list">
      <article className="card">
        <h3>Monthly board meeting</h3>
        <p>September 12 · Clubhouse · Agenda and materials to be posted 72 hours in advance.</p>
      </article>
      <article className="card">
        <h3>Volunteer shoreline cleanup</h3>
        <p>September 21 · Meet at the north dock at 9:00 AM. Gloves and bags provided.</p>
      </article>
    </section>
  )
}

function ResourcesPage() {
  return (
    <section className="card-list">
      <article className="card">
        <h3>Community documents</h3>
        <p>Repository for covenants, meeting notes, policies, and resident forms.</p>
      </article>
      <article className="card">
        <h3>Service contacts</h3>
        <p>Board members, emergency contacts, and maintenance support details.</p>
      </article>
      <article className="card">
        <h3>FAQ and onboarding</h3>
        <p>Guides for new residents and quick answers to common process questions.</p>
      </article>
    </section>
  )
}

function JoinPage() {
  return (
    <section className="card">
      <h3>Help shape CommunityPortal</h3>
      <p>
        Next implementation passes can wire this scaffold into live data, auth roles, and admin tooling already proven
        in the Community Covenant Platform.
      </p>
      <ol>
        <li>Prioritize initial feature modules (announcements, docs, comments, voting).</li>
        <li>Enable resident/admin roles and permission-based views.</li>
        <li>Connect shared backend data sync for cross-device consistency.</li>
      </ol>
    </section>
  )
}

export default App
