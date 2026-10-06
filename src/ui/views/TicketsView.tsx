import { useMemo, useState } from 'react';
import { DEMO_TICKETS } from '../../data/demoTickets';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../engine';
import type { CategoryId, Severity, TicketStatus } from '../../engine/types';
import { DemoBanner, formatDate, ProvenanceBadge, SeverityPill, StatusPill } from '../components/shared';

export function TicketsView() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [severity, setSeverity] = useState<Severity | ''>('');

  const tickets = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...DEMO_TICKETS]
      .reverse()
      .filter((t) => !category || t.category === category)
      .filter((t) => !status || t.status === status)
      .filter((t) => !severity || t.severity === severity)
      .filter((t) => !needle || `${t.id} ${t.subject} ${t.body} ${t.community}`.toLowerCase().includes(needle));
  }, [q, category, status, severity]);

  const usedCategories = CATEGORY_ORDER.filter((c) => DEMO_TICKETS.some((t) => t.category === c));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Demo Tickets</h1>
          <p>Open a ticket to load it into the Copilot. Newest first.</p>
        </div>
        <ProvenanceBadge kind="demo" />
      </div>

      <DemoBanner>Customer and community names are fictional. IDs use the DEMO- prefix so they can’t be mistaken for real tickets.</DemoBanner>

      <div className="card" style={{ padding: 0 }}>
        <div className="toolbar" style={{ padding: '14px 16px 0' }}>
          <input type="search" placeholder="Search demo tickets…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search demo tickets" />
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId | '')} aria-label="Filter by category">
            <option value="">All categories</option>
            {usedCategories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | '')} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | '')} aria-label="Filter by severity">
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <span className="muted small">{tickets.length} of {DEMO_TICKETS.length}</span>
        </div>
        <div className="ticket-list" role="list">
          <div className="ticket-row ticket-head" aria-hidden="true">
            <span>ID</span><span>Issue</span><span className="hide-md hide-sm">Category</span><span className="hide-sm">Severity</span><span>Status</span><span className="hide-md hide-sm">Date</span>
          </div>
          {tickets.map((t) => (
            <button
              key={t.id}
              role="listitem"
              className="ticket-row"
              onClick={() => (window.location.hash = `#/copilot/${t.id}`)}
              data-testid={`ticket-${t.id}`}
            >
              <span className="ticket-id">{t.id}</span>
              <span style={{ minWidth: 0 }}>
                <div className="subj">{t.subject}</div>
                <div className="body">{t.community} · {t.body}</div>
              </span>
              <span className="hide-md hide-sm small">{CATEGORY_LABELS[t.category]}</span>
              <span className="hide-sm"><SeverityPill level={t.severity} /></span>
              <span><StatusPill status={t.status} /></span>
              <span className="hide-md hide-sm small muted">{formatDate(t.createdAt)}</span>
            </button>
          ))}
          {tickets.length === 0 && <div className="empty-state">No demo tickets match these filters.</div>}
        </div>
      </div>
    </div>
  );
}
