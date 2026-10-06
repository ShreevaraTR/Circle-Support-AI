import { useEffect, useState, type ReactNode } from 'react';
import type { Provenance, Severity, TicketStatus } from '../../engine/types';
import { DEMO_DATASET_LABEL } from '../../data/demoTickets';

// ---------------------------------------------------------------------------
// Routing — tiny hash router so the static build works on any host.
// ---------------------------------------------------------------------------

export type Route =
  | { view: 'copilot'; ticketId?: string }
  | { view: 'trends' }
  | { view: 'tickets' }
  | { view: 'knowledge' }
  | { view: 'feedback'; signalId?: string }
  | { view: 'about' };

export function parseHash(hash: string): Route {
  const [view, arg] = hash.replace(/^#\/?/, '').split('/');
  switch (view) {
    case 'trends':
    case 'tickets':
    case 'knowledge':
    case 'about':
      return { view };
    case 'copilot':
      return { view: 'copilot', ticketId: arg ? decodeURIComponent(arg) : undefined };
    case 'feedback':
      return { view: 'feedback', signalId: arg ? decodeURIComponent(arg) : undefined };
    default:
      return { view: 'copilot' };
  }
}

export const hrefFor = (r: Route) =>
  r.view === 'copilot' && r.ticketId ? `#/copilot/${r.ticketId}` : r.view === 'feedback' && r.signalId ? `#/feedback/${r.signalId}` : `#/${r.view}`;

export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

// ---------------------------------------------------------------------------
// Icons (inline, stroke-based)
// ---------------------------------------------------------------------------

const ICONS: Record<string, ReactNode> = {
  copilot: <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z" />,
  trends: <path d="M3 3v18h18M7 15l4-4 3 3 6-6" />,
  tickets: <path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V7zM9 5v12" />,
  knowledge: <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13M8 7h7" />,
  about: <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01" />,
  feedback: <path d="M4 5h16v10H9l-5 4V5zM8 9h8M8 12h5" />,
  copy: <path d="M9 9h10v10H9zM5 15V5h10" />,
  check: <path d="M5 12l5 5L20 7" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />,
  user: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />,
  alert: <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />,
  flask: <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 006 21h12a1.7 1.7 0 001.5-2.5L14 9V3" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  reset: <path d="M4 4v6h6M20 20v-6h-6M5.6 15A7 7 0 0018.4 15M18.4 9A7 7 0 005.6 9" />,
};

export function Icon({ name, size = 16 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Labels & badges
// ---------------------------------------------------------------------------

const PROV_TEXT: Record<Provenance, string> = {
  fact: 'Fact · Public Circle docs',
  recommendation: 'Prototype recommendation',
  demo: 'Demo data',
};
const PROV_HELP: Record<Provenance, string> = {
  fact: 'Supported by public Circle Help Center documentation (linked).',
  recommendation: 'Suggested by this prototype — not Circle policy. A support specialist decides.',
  demo: 'Synthetic data created for this portfolio prototype. Not Circle customer data.',
};

export function ProvenanceBadge({ kind, text }: { kind: Provenance; text?: string }) {
  return (
    <span className={`prov prov-${kind}`} title={PROV_HELP[kind]} data-provenance={kind}>
      {text ?? PROV_TEXT[kind]}
    </span>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function SeverityPill({ level }: { level: Severity }) {
  return (
    <span className={`pill sev-${level}`}>
      <span className="dot" />
      {cap(level)}
    </span>
  );
}

export function StatusPill({ status }: { status: TicketStatus }) {
  return <span className={`pill status-${status}`}>{cap(status)}</span>;
}

export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="banner banner-demo" role="note">
      <Icon name="flask" />
      <div>
        <strong>{DEMO_DATASET_LABEL}</strong>
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
