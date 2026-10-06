import { DEMO_TICKETS } from '../../data/demoTickets';
import { KNOWLEDGE_BASE } from '../../data/knowledge';
import { ProvenanceBadge } from '../components/shared';

export function AboutView() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>About this prototype</h1>
          <p>Built as part of an application for the Circle Customer Support Specialist (APAC) role. Not an official Circle product, and not affiliated with or endorsed by Circle.</p>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>Workflow</h2>
        <div className="flow">
          {['Customer issue', 'Issue classification', 'Relevant Circle knowledge', 'Troubleshooting steps', 'Suggested customer response', 'Escalation recommendation', 'Support trend analysis'].map((s, i, all) => (
            <span key={s} style={{ display: 'contents' }}>
              <span>{s}</span>
              {i < all.length - 1 && <i>→</i>}
            </span>
          ))}
        </div>
      </div>

      <div className="principles">
        <div className="card">
          <h3>The specialist stays in charge</h3>
          <p className="muted">The copilot helps you understand an issue faster, find the right documentation, write a better first reply, spot patterns and decide when to escalate. It never sends anything. Every output is a suggestion for a person to review.</p>
        </div>
        <div className="card">
          <h3>Facts vs. recommendations</h3>
          <p className="muted">Every output is labelled with where it came from:</p>
          <div className="stack" style={{ gap: 8 }}>
            <div><ProvenanceBadge kind="fact" /> <span className="small">Backed by a linked public Circle Help Center article.</span></div>
            <div><ProvenanceBadge kind="recommendation" /> <span className="small">This prototype’s suggestion. Not Circle policy, procedure or SLA.</span></div>
            <div><ProvenanceBadge kind="demo" /> <span className="small">Synthetic data created for this prototype.</span></div>
          </div>
        </div>
        <div className="card">
          <h3>Free, offline, swappable</h3>
          <p className="muted">
            V1 uses a deterministic rules engine behind <code>analyzeSupportIssue(issue, knowledge)</code> and <code>analyzeSupportTrends(tickets)</code>. An LLM-backed engine can implement the same interface later and the UI won't need to change. There are no paid APIs and no network calls at runtime.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>Data sources</h2>
        <ul className="list">
          <li><strong>Knowledge:</strong> {KNOWLEDGE_BASE.articles.length} public help.circle.so articles (title, URL, search excerpt), indexed {KNOWLEDGE_BASE.retrievedAt} via public web search at build time. No scraping, no login, no internal docs.</li>
          <li><strong>Tickets:</strong> {DEMO_TICKETS.length} synthetic scenarios (DEMO-001 to DEMO-{String(DEMO_TICKETS.length).padStart(3, '0')}) with fictional names. Not Circle customer data.</li>
          <li><strong>Escalation levels and severity rules:</strong> prototype logic written for this demo. Not Circle's internal policy.</li>
        </ul>
      </div>
    </div>
  );
}
