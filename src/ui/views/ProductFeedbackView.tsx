import { useEffect, useState, type ReactNode } from 'react';
import { DEMO_TICKETS } from '../../data/demoTickets';
import { KNOWLEDGE_BASE } from '../../data/knowledge';
import { analyzeProductSignals, analyzeSupportTrends, generateProductFeedback } from '../../engine';
import { formatForJira, formatForSlack, formatReport } from '../../engine/feedbackFormat';
import type { ProductHandoff, ProductSignal } from '../../engine/types';
import { formatDate, Icon, ProvenanceBadge, SeverityPill, StatusPill } from '../components/shared';

const TREND_LABEL = { increasing: 'Increasing', stable: 'Stable', decreasing: 'Decreasing' } as const;

/** Copies text to the clipboard. Falls back to a hidden textarea where the async API is unavailable. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      ta.remove();
    }
  }
}

export function ProductFeedbackView({ signalId }: { signalId?: string }) {
  const [signals, setSignals] = useState<ProductSignal[] | null>(null);
  const [handoff, setHandoff] = useState<ProductHandoff | null>(null);

  useEffect(() => {
    void analyzeSupportTrends(DEMO_TICKETS, KNOWLEDGE_BASE)
      .then((report) => analyzeProductSignals(report, DEMO_TICKETS))
      .then(setSignals);
  }, []);

  // A new signal starts without a handoff — the specialist generates it deliberately.
  useEffect(() => setHandoff(null), [signalId]);

  if (!signals) return null;
  const selected = signals.find((s) => s.id === signalId) ?? signals[0];

  const generate = async () => {
    if (selected) setHandoff(await generateProductFeedback(selected, DEMO_TICKETS, KNOWLEDGE_BASE));
  };

  return (
    <div className="stack" data-testid="product-feedback">
      <div className="page-head">
        <div>
          <h1>Product Feedback</h1>
          <p>Turn recurring support signals into actionable product feedback.</p>
        </div>
        <ProvenanceBadge kind="demo" />
      </div>

      <div className="banner banner-demo" role="note">
        <Icon name="flask" />
        <div>
          <strong>Portfolio prototype · Synthetic support data</strong>
          <div>Not Circle customer data. Signals come from the same synthetic tickets and trend analysis shown on Support Trends.</div>
        </div>
      </div>

      <div className="card">
        <div className="flow" aria-label="Support to product feedback loop">
          {['Customer tickets', 'Support analysis', 'Recurring pattern', 'Product signal', 'Proactive recommendation', 'Product handoff'].map((s, i, all) => (
            <span key={s} style={{ display: 'contents' }}>
              <span>{s}</span>
              {i < all.length - 1 && <i>→</i>}
            </span>
          ))}
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          The Copilot answers “what should Support do for this customer?”. This page answers “what should the product team learn from this pattern?”. A pattern needs at least 3 related synthetic tickets before it appears here.
        </p>
      </div>

      {signals.length === 0 || !selected ? (
        <div className="card empty-state">No recurring pattern in the synthetic dataset meets the threshold for product feedback.</div>
      ) : (
        <>
          <div className="signal-picker" role="tablist" aria-label="Product signals">
            {signals.map((s) => (
              <a
                key={s.id}
                role="tab"
                aria-selected={s.id === selected.id}
                className={`card signal-option ${s.id === selected.id ? 'selected' : ''}`}
                href={`#/feedback/${s.id}`}
                data-testid={`signal-${s.id}`}
              >
                <span className="hero-label">{s.areaLabel}</span>
                <strong>{s.name}</strong>
                <span className="small muted">
                  {s.count} related tickets · {TREND_LABEL[s.trend.direction]}
                </span>
              </a>
            ))}
          </div>

          <SignalDetail signal={selected} onGenerate={generate} generated={!!handoff} />
          {handoff && handoff.signalId === selected.id && <HandoffReport handoff={handoff} />}
        </>
      )}
    </div>
  );
}

function SignalDetail({ signal, onGenerate, generated }: { signal: ProductSignal; onGenerate: () => void; generated: boolean }) {
  const tickets = DEMO_TICKETS.filter((t) => signal.ticketIds.includes(t.id));
  return (
    <div className="results">
      <div className="card" data-testid="signal-detail">
        <div className="card-head">
          <h2 className="card-title">Product signal detected</h2>
          <ProvenanceBadge kind="demo" text="Derived from demo data" />
        </div>
        <h3 style={{ fontSize: 18, marginBottom: 14 }}>{signal.name}</h3>
        <div className="result-hero">
          <div className="hero-field">
            <span className="hero-label">Related tickets</span>
            <span className="hero-value" data-testid="signal-count">{signal.count}</span>
          </div>
          <div className="hero-field">
            <span className="hero-label">Trend</span>
            <span className="hero-value">{TREND_LABEL[signal.trend.direction]}</span>
            <span className="muted small">{signal.trend.previous} → {signal.trend.recent} (last {signal.trend.windowDays} days)</span>
          </div>
          <div className="hero-field">
            <span className="hero-label">Severity</span>
            <span><SeverityPill level={signal.severity} /></span>
            <span className="muted small">highest in group</span>
          </div>
          <div className="hero-field">
            <span className="hero-label">Affected area</span>
            <span className="hero-value">{signal.areaLabel}</span>
          </div>
        </div>
        <div className="hero-label" style={{ margin: '18px 0 6px' }}>Evidence · supporting synthetic tickets</div>
        <table className="data">
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td><a className="ticket-ref" href={`#/copilot/${t.id}`} data-testid={`evidence-${t.id}`}>{t.id}</a></td>
                <td>{t.subject}</td>
                <td className="hide-sm"><SeverityPill level={t.severity} /></td>
                <td className="hide-sm"><StatusPill status={t.status} /></td>
                <td className="num muted small">{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted" style={{ margin: '8px 0 0' }}>Open a ticket to see the Copilot’s analysis of that individual customer.</p>
      </div>

      <div className="card" data-testid="signal-recommendation">
        <div className="card-head">
          <h2 className="card-title">Proactive recommendation</h2>
          <ProvenanceBadge kind="recommendation" text="Prototype recommendation · synthetic data" />
        </div>
        <p style={{ marginTop: 0 }}>{signal.recommendation}</p>
        {signal.platforms.length > 0 && (
          <p className="small muted">
            Platforms mentioned in the tickets: {signal.platforms.map((p) => `${p.label} (${p.count})`).join(', ')}.
          </p>
        )}
        <button className="btn btn-primary" onClick={onGenerate} data-testid="generate-handoff">
          <Icon name="feedback" /> {generated ? 'Regenerate Product Handoff' : 'Generate Product Handoff'}
        </button>
      </div>
    </div>
  );
}

function Section({ n, title, badge, children }: { n: number; title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="handoff-section">
      <div className="row" style={{ marginBottom: 6 }}>
        <span className="hero-label">{n}. {title}</span>
        {badge}
      </div>
      {children}
    </section>
  );
}

function HandoffReport({ handoff: h }: { handoff: ProductHandoff }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (kind: string, text: string) => {
    await copyText(text);
    setCopied(kind);
    setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1600);
  };
  const list = (items: string[]) => <ul className="list">{items.map((i) => <li key={i}>{i}</li>)}</ul>;

  return (
    <div className="card stack" data-testid="handoff" style={{ gap: 18 }}>
      <div className="card-head" style={{ marginBottom: 0 }}>
        <h2 className="card-title">Product / Engineering handoff</h2>
        <div className="row">
          <button className="btn btn-sm" onClick={() => copy('slack', formatForSlack(h))} data-testid="copy-slack">
            <Icon name={copied === 'slack' ? 'check' : 'copy'} size={13} /> {copied === 'slack' ? 'Copied' : 'Copy for Slack'}
          </button>
          <button className="btn btn-sm" onClick={() => copy('jira', formatForJira(h))} data-testid="copy-jira">
            <Icon name={copied === 'jira' ? 'check' : 'copy'} size={13} /> {copied === 'jira' ? 'Copied' : 'Copy for Jira'}
          </button>
          <button className="btn btn-sm" onClick={() => copy('report', formatReport(h))} data-testid="copy-report">
            <Icon name={copied === 'report' ? 'check' : 'copy'} size={13} /> {copied === 'report' ? 'Copied' : 'Copy report'}
          </button>
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Copy buttons only put formatted text on your clipboard — there is no Slack, Jira or other integration.</p>

      <div className="banner banner-human" role="note">
        <Icon name="user" />
        <div><strong>Human review required.</strong> {h.humanReview.replace(/^Human review required\.\s*/, '')}</div>
      </div>

      <Section n={1} title="Title">
        <h3 style={{ fontSize: 17 }} data-testid="handoff-title">{h.title}</h3>
      </Section>
      <Section n={2} title="Problem"><p style={{ margin: 0 }}>{h.problem}</p></Section>
      <Section n={3} title="Customer impact" badge={<ProvenanceBadge kind="demo" text="From synthetic tickets" />}>{list(h.customerImpact)}</Section>
      <Section n={4} title="Evidence" badge={<ProvenanceBadge kind="demo" />}>
        <div className="ticket-refs" style={{ marginTop: 0 }}>
          {h.evidence.map((e) => (
            <a key={e.id} className="ticket-ref" href={`#/copilot/${e.id}`} title={`${e.subject} · ${e.createdAt} · ${e.severity} · ${e.status}`} data-testid={`handoff-evidence-${e.id}`}>
              {e.id}
            </a>
          ))}
        </div>
      </Section>
      <Section n={5} title="Observed pattern">{list(h.observedPattern)}</Section>
      <Section n={6} title="What support tried" badge={<ProvenanceBadge kind="recommendation" text="Prototype playbook" />}>{list(h.supportTried)}</Section>
      <Section n={7} title="Suggested investigation" badge={<ProvenanceBadge kind="recommendation" text="Prototype recommendation · synthetic data" />}>
        <p style={{ margin: 0 }} data-testid="handoff-investigation">{h.suggestedInvestigation}</p>
      </Section>
      <Section n={8} title="Priority" badge={<ProvenanceBadge kind="recommendation" />}>
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="pill pill-accent" data-testid="handoff-priority">{h.priority.level}</span>
          <span>{h.priority.route}</span>
        </div>
        {list(h.priority.reasons)}
        <p className="small muted" style={{ margin: '6px 0 0' }}>Prototype priority — not Circle’s internal priority policy.</p>
      </Section>
      {h.relatedDocs.length > 0 && (
        <section className="handoff-section">
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="hero-label">Related public Circle documentation</span>
            <ProvenanceBadge kind="fact" />
          </div>
          <ul className="list">
            {h.relatedDocs.map((d) => (
              <li key={d.url}><a href={d.url} target="_blank" rel="noreferrer">{d.title} <Icon name="external" size={11} /></a></li>
            ))}
          </ul>
        </section>
      )}
      <Section n={9} title="Source" badge={<ProvenanceBadge kind="demo" />}><p style={{ margin: 0 }} data-testid="handoff-source">{h.source}</p></Section>
      <Section n={10} title="Human review"><p style={{ margin: 0 }}>{h.humanReview}</p></Section>
      <p className="small muted" style={{ margin: 0 }}>Generated by {h.generatedFrom}.</p>
    </div>
  );
}
