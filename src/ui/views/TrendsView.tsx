import { useEffect, useState } from 'react';
import { DEMO_TICKETS } from '../../data/demoTickets';
import { KNOWLEDGE_BASE } from '../../data/knowledge';
import { analyzeProductSignals, analyzeSupportTrends } from '../../engine';
import type { CountRow, Severity, TrendReport } from '../../engine/types';
import { DemoBanner, formatDate, Icon, ProvenanceBadge } from '../components/shared';

const SEV_COLOR: Record<Severity, string> = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
};
const STATUS_COLOR: Record<string, string> = { open: 'var(--accent)', pending: 'var(--sev-medium)', resolved: 'var(--border-strong)' };

export function TrendsView() {
  const [report, setReport] = useState<TrendReport | null>(null);
  const [signalIds, setSignalIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    void analyzeSupportTrends(DEMO_TICKETS, KNOWLEDGE_BASE).then(async (r) => {
      setReport(r);
      const signals = await analyzeProductSignals(r, DEMO_TICKETS);
      setSignalIds(new Set(signals.map((s) => s.id)));
    });
  }, []);
  if (!report) return null;

  const top = report.byCategory[0];
  const unresolved = report.open + report.pending;
  const catRows: CountRow[] = report.byCategory;
  const maxCat = Math.max(...catRows.map((r) => r.count));
  const maxWeek = Math.max(...report.weekly.map((w) => w.count));
  const maxSev = Math.max(...report.bySeverity.map((r) => r.count));

  return (
    <div className="stack" data-testid="trends">
      <div className="page-head">
        <div>
          <h1>Support Trends</h1>
          <p>
            Demo support data — {report.total} synthetic tickets, {formatDate(report.range.from)} – {formatDate(report.range.to)} {report.range.to.slice(0, 4)}.
          </p>
        </div>
        <ProvenanceBadge kind="demo" />
      </div>

      <DemoBanner>All counts, trends and recommendations on this page describe the synthetic dataset only — they say nothing about Circle’s real support volume.</DemoBanner>

      {/* KPIs */}
      <div className="grid-4">
        <div className="card kpi">
          <span className="kpi-value" data-testid="kpi-total">{report.total}</span>
          <span className="kpi-label">Total tickets</span>
          <span className="kpi-sub">Synthetic dataset</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value">{top.count}</span>
          <span className="kpi-label">Top category</span>
          <span className="kpi-sub">{top.label} · {Math.round(top.share * 100)}%</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value" data-testid="kpi-open">{unresolved}</span>
          <span className="kpi-label">Open</span>
          <span className="kpi-sub">{report.open} open · {report.pending} pending</span>
        </div>
        <div className="card kpi">
          <span className="kpi-value" data-testid="kpi-resolved">{report.resolved}</span>
          <span className="kpi-label">Resolved</span>
          <span className="kpi-sub">{Math.round((report.resolved / report.total) * 100)}% of tickets</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Key insights</h2>
          <ProvenanceBadge kind="demo" text="Derived from demo data" />
        </div>
        <ul className="list">{report.headline.map((h) => <li key={h}>{h}</li>)}</ul>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h2 className="card-title">Top categories</h2></div>
          <div className="bars" role="table" aria-label="Tickets by category">
            {catRows.map((r) => (
              <div className="bar-row" role="row" key={r.key} title={`${r.label}: ${r.count} tickets (${Math.round(r.share * 100)}%)`}>
                <span className="label" role="cell">{r.label}</span>
                <span className="bar-track" role="presentation"><span className="bar-fill" style={{ width: `${(r.count / maxCat) * 100}%`, display: 'block' }} /></span>
                <span className="value" role="cell">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2 className="card-title">Ticket volume by week</h2><span className="muted small">Darker = most recent 14 days</span></div>
          <div className="columns" role="table" aria-label="Tickets per week">
            {report.weekly.map((w, i) => (
              <div className="col" role="row" key={w.weekStart} title={`Week of ${formatDate(w.weekStart)}: ${w.count} tickets`}>
                <span className="v" role="cell">{w.count}</span>
                <span className={`b ${i >= report.weekly.length - 2 ? 'recent' : 'older'}`} style={{ height: `${(w.count / maxWeek) * 100}%` }} />
                <span className="x" role="cell">{formatDate(w.weekStart)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2 className="card-title">Open vs resolved</h2></div>
          <div className="stacked" role="img" aria-label={report.byStatus.map((s) => `${s.label} ${s.count}`).join(', ')}>
            {report.byStatus.map((s) => (
              <span key={s.key} title={`${s.label}: ${s.count}`} style={{ width: `${s.share * 100}%`, background: STATUS_COLOR[s.key] }} />
            ))}
          </div>
          <div className="legend">
            {report.byStatus.map((s) => (
              <span key={s.key}><i style={{ background: STATUS_COLOR[s.key] }} />{s.label} <strong>{s.count}</strong> <span className="muted">({Math.round(s.share * 100)}%)</span></span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2 className="card-title">Severity breakdown</h2></div>
          <div className="bars" role="table" aria-label="Tickets by severity">
            {report.bySeverity.map((r) => (
              <div className="bar-row" role="row" key={r.key} title={`${r.label}: ${r.count} tickets`}>
                <span className="label" role="cell">{r.label}</span>
                <span className="bar-track" role="presentation"><span className="bar-fill" style={{ width: `${(r.count / maxSev) * 100}%`, display: 'block', background: SEV_COLOR[r.key] }} /></span>
                <span className="value" role="cell">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2 className="card-title">Trending issues</h2><span className="muted small">Most recent 14 days vs previous 14</span></div>
          {report.trending.length === 0 ? (
            <p className="muted">No category is growing in the synthetic dataset.</p>
          ) : (
            <ol className="trend-list">
              {report.trending.map((t) => (
                <li key={t.category}>
                  <div>
                    <strong>{t.label}</strong>
                    <div className="small muted">{t.statement}</div>
                  </div>
                  <span className="delta">{t.previous} → {t.recent}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2 className="card-title">Most common problems</h2></div>
          <table className="data">
            <thead><tr><th>Problem</th><th className="num">Tickets</th><th className="num">Recent</th><th className="num">Open</th></tr></thead>
            <tbody>
              {report.topProblems.slice(0, 6).map((p) => (
                <tr key={p.id}><td>{p.label}</td><td className="num">{p.count}</td><td className="num">{p.recent}</td><td className="num">{p.open}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="page-head" style={{ marginTop: 12, marginBottom: 0 }}>
        <div>
          <h2 style={{ margin: 0 }}>Proactive Support Opportunities</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>Prototype recommendations based on the synthetic dataset — ideas a support specialist could bring to the team, not Circle decisions.</p>
        </div>
        <ProvenanceBadge kind="recommendation" text="Prototype recommendation · synthetic data" />
      </div>

      {report.opportunities.map((o, i) => (
        <div className="card opportunity" key={o.id} data-testid="opportunity">
          <div className="opp-head">
            <strong>{i + 1}. {o.title}</strong>
            <span className="row">
              <span className="small muted">{o.impact}</span>
              {signalIds.has(o.id) && (
                <a className="btn btn-sm btn-primary" href={`#/feedback/${o.id}`} data-testid="generate-feedback">
                  <Icon name="feedback" size={13} /> Generate Product Feedback
                </a>
              )}
            </span>
          </div>
          <div>
            <div className="opp-step"><Icon name="alert" size={13} /> Problem</div>
            <div>{o.problem}</div>
          </div>
          <div>
            <div className="opp-step"><Icon name="trends" size={13} /> Evidence <ProvenanceBadge kind="demo" /></div>
            <ul className="list small">{o.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            <div className="ticket-refs">
              {o.ticketIds.map((id) => <a className="ticket-ref" key={id} href={`#/copilot/${id}`}>{id}</a>)}
            </div>
          </div>
          <div>
            <div className="opp-step"><Icon name="arrow" size={13} /> Recommended action <ProvenanceBadge kind="recommendation" text="Recommendation" /></div>
            <div>{o.action}</div>
            {o.relatedDocs.length > 0 && (
              <div className="small" style={{ marginTop: 8 }}>
                <span className="muted">Public docs to build on: </span>
                {o.relatedDocs.map((d, j) => (
                  <span key={d.url}>{j > 0 && ' · '}<a href={d.url} target="_blank" rel="noreferrer">{d.title}</a></span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
