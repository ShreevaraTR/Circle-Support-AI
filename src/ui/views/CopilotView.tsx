import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_TICKETS } from '../../data/demoTickets';
import { KNOWLEDGE_BASE } from '../../data/knowledge';
import { analyzeSupportIssue, CATEGORY_LABELS } from '../../engine';
import type { DemoTicket, EscalationLevel, SupportAnalysis } from '../../engine/types';
import { formatDate, Icon, ProvenanceBadge, SeverityPill, StatusPill } from '../components/shared';

export const EXAMPLE_ISSUES: { label: string; text: string; name?: string }[] = [
  {
    label: 'Live stream · mobile',
    name: 'Sarah',
    text: "A member says they can't join our live stream. They're using the mobile app and the Join button isn't appearing.",
  },
  {
    label: 'SSO outage',
    name: 'Alex',
    text: 'Since this morning none of our members can log in through our WordPress SSO — they get an error after signing in. It worked fine yesterday.',
  },
  {
    label: 'Double charge',
    name: 'Jordan',
    text: 'A member was charged twice for their annual membership and is asking for a refund of the duplicate charge.',
  },
  {
    label: 'How-to: resend invite',
    text: 'How do I resend an invitation to a member who says they never received it?',
  },
  {
    label: 'Safari login loop',
    name: 'Chris',
    text: 'I enter my email and password on my iPhone in Safari and nothing happens — it keeps taking me back to the login page.',
  },
  {
    label: 'Undocumented ask',
    text: 'Can members print a certificate of completion from a course?',
  },
];

const LADDER: { level: EscalationLevel; label: string }[] = [
  { level: 'none', label: 'No escalation' },
  { level: 'first_line', label: 'First-line' },
  { level: 'specialist', label: 'Specialist' },
  { level: 'engineering', label: 'Engineering' },
];

export function CopilotView({ ticketId }: { ticketId?: string }) {
  const ticket = ticketId ? DEMO_TICKETS.find((t) => t.id === ticketId) : undefined;
  const [text, setText] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [analysis, setAnalysis] = useState<SupportAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (issue: string, name: string, agent: string, scroll = true) => {
      if (!issue.trim()) return;
      setBusy(true);
      const result = await analyzeSupportIssue({ text: issue, customerName: name, agentName: agent }, KNOWLEDGE_BASE);
      setAnalysis(result);
      setBusy(false);
      if (scroll) requestAnimationFrame(() => resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
    },
    [],
  );

  // Opening a demo ticket loads it into the composer and analyses it straight away.
  useEffect(() => {
    if (!ticket) return;
    const issue = `${ticket.subject}. ${ticket.body}`;
    setText(issue);
    setCustomerName(ticket.customerName);
    void run(issue, ticket.customerName, agentName, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id]);

  const submit = () => run(text, customerName, agentName);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>How can I help a customer?</h1>
          <p>Paste or describe the customer’s issue. The copilot classifies it, finds public Circle documentation, drafts a reply and recommends whether to escalate — you stay in charge of the final call.</p>
        </div>
      </div>

      {ticket && <TicketContext ticket={ticket} />}

      <div className="card composer">
        <label htmlFor="issue" className="sr-only" style={{ position: 'absolute', left: -9999 }}>
          Customer issue
        </label>
        <textarea
          id="issue"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Describe the customer's problem…"
        />
        <div className="composer-foot">
          <input aria-label="Customer first name" placeholder="Customer first name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input aria-label="Your name (signature)" placeholder="Your name (signature)" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
          <span className="spacer" />
          <span className="muted small">
            <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span>
          </span>
          <button className="btn btn-primary" onClick={submit} disabled={!text.trim() || busy}>
            <Icon name="copilot" /> Analyze Issue
          </button>
        </div>
      </div>

      <div className="examples">
        <span className="muted small">Try an example:</span>
        {EXAMPLE_ISSUES.map((ex) => (
          <button
            key={ex.label}
            className="chip"
            onClick={() => {
              if (window.location.hash.startsWith('#/copilot/')) window.location.hash = '#/copilot';
              setText(ex.text);
              setCustomerName(ex.name ?? '');
              void run(ex.text, ex.name ?? '', agentName);
            }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div ref={resultsRef} style={{ scrollMarginTop: 16 }}>
        {analysis ? <AnalysisResults analysis={analysis} key={analysis.input.text + analysis.input.customerName} /> : <EmptyState />}
      </div>
    </div>
  );
}

function TicketContext({ ticket }: { ticket: DemoTicket }) {
  return (
    <div className="ticket-context" data-testid="ticket-context">
      <ProvenanceBadge kind="demo" />
      <span className="ticket-id">{ticket.id}</span>
      <strong>{ticket.subject}</strong>
      <span className="muted small">
        {ticket.customerName} ({ticket.reporterRole}) · {ticket.community} · {formatDate(ticket.createdAt)} · via {ticket.channel}
      </span>
      <span style={{ marginLeft: 'auto' }} className="row">
        <span className="muted small">Tagged:</span>
        <span className="pill">{CATEGORY_LABELS[ticket.category]}</span>
        <SeverityPill level={ticket.severity} />
        <StatusPill status={ticket.status} />
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card empty-state">
      <Icon name="copilot" size={28} />
      <h3>Analysis appears here</h3>
      <p>Enter an issue above, pick an example, or open a ticket from Demo Tickets.</p>
      <div className="pipeline" aria-label="Workflow">
        {['Customer issue', 'Classification', 'Circle knowledge', 'Troubleshooting', 'Suggested response', 'Escalation', 'Trend analysis'].map((s, i, all) => (
          <span key={s} style={{ display: 'contents' }}>
            <span>{s}</span>
            {i < all.length - 1 && <i>→</i>}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnalysisResults({ analysis }: { analysis: SupportAnalysis }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState(analysis.response);
  const [copied, setCopied] = useState(false);
  const levelIndex = LADDER.findIndex((l) => l.level === analysis.escalation.level);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      /* clipboard unavailable — the text is still selectable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const s = analysis.signals;
  const signalList: [string, boolean][] = [
    ['Multiple people affected', s.multipleUsers],
    ['Fully blocked', s.totalBlocker],
    ['Error / possible defect', s.errorOrDefect],
    ['Previously worked', s.regression],
    ['Billing risk', s.billingRisk],
    ['Data / privacy', s.dataOrPrivacy],
    ['Time-sensitive', s.urgent],
    ['How-to question', s.howToQuestion],
  ];

  return (
    <div className="stack" data-testid="analysis">
      <div className="banner banner-human" role="note">
        <Icon name="user" />
        <div>
          <strong>Human review required.</strong> These are suggestions to help you move faster. Check the facts, adjust the reply, and make the escalation decision yourself before anything reaches the customer.
        </div>
      </div>

      {/* Overview */}
      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Issue</h2>
          <ProvenanceBadge kind="recommendation" text="Prototype classification" />
        </div>
        <div className="result-hero">
          <div className="hero-field">
            <span className="hero-label">Category</span>
            <span className="hero-value" data-testid="category">{analysis.category.label}</span>
            <span className="muted small">{analysis.category.confidence} confidence</span>
          </div>
          <div className="hero-field">
            <span className="hero-label">Problem type</span>
            <span className="hero-value">{analysis.problem.label}</span>
          </div>
          <div className="hero-field">
            <span className="hero-label">Severity</span>
            <span data-testid="severity"><SeverityPill level={analysis.severity.level} /></span>
          </div>
          <div className="hero-field">
            <span className="hero-label">Escalation</span>
            <span className="pill pill-accent" data-testid="escalation">{analysis.escalation.label}</span>
          </div>
        </div>
        <p className="summary-text">{analysis.summary}</p>
        <details style={{ marginTop: 12 }}>
          <summary>Why this classification?</summary>
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <div className="small">
              Matched terms: {analysis.category.matchedTerms.length ? analysis.category.matchedTerms.map((t) => <code key={t} style={{ marginRight: 4 }}>{t}</code>) : <span className="muted">none — defaulted to Other</span>}
              {analysis.alternatives.length > 0 && <span className="muted"> · Also considered: {analysis.alternatives.map((a) => a.label).join(', ')}</span>}
            </div>
            <div className="signals">
              {signalList.map(([label, on]) => (
                <span key={label} className={`signal ${on ? 'on' : ''}`}>{on ? '● ' : '○ '}{label}</span>
              ))}
              {s.device && <span className="signal on">Device: {s.device}</span>}
            </div>
            <ul className="list small">{analysis.severity.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </details>
      </div>

      <div className="results">
        <div className="stack">
          {/* Likely causes */}
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Likely area &amp; causes</h2>
              <ProvenanceBadge kind="recommendation" />
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              {analysis.likelyAreas.map((a) => <span className="pill" key={a}>{a}</span>)}
            </div>
            <ul className="list">{analysis.likelyCauses.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>

          {/* Troubleshooting */}
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Troubleshooting checklist</h2>
              <ProvenanceBadge kind="recommendation" />
            </div>
            <ol className="checklist">
              {analysis.troubleshooting.map((step, i) => (
                <li key={i}>
                  <input
                    type="checkbox"
                    aria-label={`Mark step ${i + 1} done`}
                    checked={done.has(i)}
                    onChange={() => setDone((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })}
                  />
                  <div>
                    <div className={done.has(i) ? 'done' : ''}>{i + 1}. {step.text}</div>
                    <div className="step-meta">
                      {step.basis === 'doc' ? (
                        <>
                          <span className="basis basis-doc">Doc-backed</span>
                          <a className="small" href={step.sourceUrl} target="_blank" rel="noreferrer">{step.sourceTitle} <Icon name="external" size={11} /></a>
                        </>
                      ) : (
                        <span className="basis basis-practice">General support practice</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="small muted" style={{ marginTop: 10 }}>
              <strong>Information to collect:</strong> {analysis.infoToCollect.join(' · ')}
            </div>
          </div>

          {/* Response */}
          <div className="card">
            <div className="card-head">
              <h2 className="card-title">Suggested customer response</h2>
              <div className="row">
                <ProvenanceBadge kind="recommendation" text="Draft · review before sending" />
                <button className="btn btn-sm" onClick={() => setDraft(analysis.response)} title="Reset to generated draft"><Icon name="reset" size={13} /></button>
                <button className="btn btn-sm" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
            <textarea className="response-box" aria-label="Suggested customer response" value={draft} onChange={(e) => setDraft(e.target.value)} data-testid="response" />
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              The draft never claims the issue is fixed or promises timelines, refunds or outcomes. Edit freely.
            </p>
          </div>
        </div>

        <div className="stack">
          {/* Knowledge */}
          <div className="card" data-testid="sources">
            <div className="card-head">
              <h2 className="card-title">Relevant Circle knowledge</h2>
              <ProvenanceBadge kind="fact" />
            </div>
            {analysis.sources.length === 0 ? (
              <div className="empty-source" data-testid="no-docs">
                <strong>No public Circle documentation found for this issue.</strong>
                <div className="small">Nothing in the public Help Center index matched closely enough. Don’t guess — clarify with the customer or check with the team.</div>
              </div>
            ) : (
              analysis.sources.map((src) => (
                <div className="source" key={src.article.url}>
                  <div className="row small muted">
                    <span>Source: Circle Help Center</span>
                    {src.pinned && <span className="basis basis-doc">Playbook match</span>}
                  </div>
                  <a href={src.article.url} target="_blank" rel="noreferrer">
                    {src.article.title} <Icon name="external" size={12} />
                  </a>
                  <span className="url">{src.article.url}</span>
                  {src.article.snippet && <span className="excerpt">“{src.article.snippet.length > 220 ? src.article.snippet.slice(0, 217).trimEnd() + '…' : src.article.snippet}” <span className="muted">— search excerpt</span></span>}
                </div>
              ))
            )}
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Titles, links and excerpts come from the public Help Center index. Open the article for current, complete steps.
            </p>
          </div>

          {/* Escalation */}
          <div className="card" data-testid="escalation-card">
            <div className="card-head">
              <h2 className="card-title">Escalation</h2>
              <ProvenanceBadge kind="recommendation" />
            </div>
            <div className="ladder" aria-label="Escalation level">
              {LADDER.map((l, i) => (
                <div key={l.level} className={i === levelIndex ? 'on' : i < levelIndex ? 'past' : ''}>{l.label}</div>
              ))}
            </div>
            <h3 style={{ marginBottom: 6 }}>{analysis.escalation.label}</h3>
            <ul className="list">{analysis.escalation.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <div style={{ marginTop: 12 }}>
              <div className="hero-label" style={{ marginBottom: 4 }}>Escalate further if</div>
              <ul className="list small">{analysis.escalation.escalateIf.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            <p className="small muted" style={{ margin: '12px 0 0' }}>
              Prototype recommendation — not Circle’s internal escalation policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
