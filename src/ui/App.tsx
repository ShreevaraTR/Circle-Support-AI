import { DEMO_TICKETS } from '../data/demoTickets';
import { KNOWLEDGE_BASE } from '../data/knowledge';
import { getSupportEngine } from '../engine';
import { hrefFor, Icon, useHashRoute, type Route } from './components/shared';
import { AboutView } from './views/AboutView';
import { CopilotView } from './views/CopilotView';
import { KnowledgeView } from './views/KnowledgeView';
import { TicketsView } from './views/TicketsView';
import { TrendsView } from './views/TrendsView';

const NAV: { route: Route; label: string; icon: string; count?: number }[] = [
  { route: { view: 'copilot' }, label: 'Copilot', icon: 'copilot' },
  { route: { view: 'trends' }, label: 'Support Trends', icon: 'trends' },
  { route: { view: 'knowledge' }, label: 'Knowledge Base', icon: 'knowledge', count: KNOWLEDGE_BASE.articles.length },
  { route: { view: 'tickets' }, label: 'Demo Tickets', icon: 'tickets', count: DEMO_TICKETS.length },
  { route: { view: 'about' }, label: 'About', icon: 'about' },
];

export function App() {
  const route = useHashRoute();

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Circle Support Copilot</div>
            <div className="brand-sub">Portfolio prototype</div>
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <a key={item.label} href={hrefFor(item.route)} className={route.view === item.route.view ? 'active' : ''} aria-current={route.view === item.route.view ? 'page' : undefined}>
              <Icon name={item.icon} />
              {item.label}
              {item.count !== undefined && <span className="count">{item.count}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <strong>Not an official Circle product.</strong> A portfolio prototype for the Customer Support Specialist (APAC) application. Not affiliated with or endorsed by Circle.
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <span>
            Engine: <strong>{getSupportEngine().name}</strong>
          </span>
          <span>·</span>
          <span>Knowledge index: {KNOWLEDGE_BASE.articles.length} public Help Center articles (retrieved {KNOWLEDGE_BASE.retrievedAt})</span>
          <span className="spacer" />
          <span>Runs fully offline · no paid APIs</span>
        </div>
        <main className="content">
          {route.view === 'copilot' && <CopilotView ticketId={route.ticketId} />}
          {route.view === 'trends' && <TrendsView />}
          {route.view === 'tickets' && <TicketsView />}
          {route.view === 'knowledge' && <KnowledgeView />}
          {route.view === 'about' && <AboutView />}
        </main>
      </div>
    </div>
  );
}
