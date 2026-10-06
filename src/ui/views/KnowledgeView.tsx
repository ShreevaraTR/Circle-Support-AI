import { useMemo, useState } from 'react';
import { KNOWLEDGE_BASE } from '../../data/knowledge';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../engine';
import type { CategoryId } from '../../engine/types';
import { tokenize } from '../../engine/rules/retrieve';
import { Icon, ProvenanceBadge } from '../components/shared';

export function KnowledgeView() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<CategoryId | ''>('');

  const counts = useMemo(() => {
    const m = new Map<CategoryId, number>();
    for (const a of KNOWLEDGE_BASE.articles) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return m;
  }, []);

  const articles = useMemo(() => {
    const tokens = tokenize(q);
    return KNOWLEDGE_BASE.articles
      .filter((a) => !category || a.categories.includes(category))
      .map((a) => {
        if (!tokens.length) return { a, score: a.isOverview ? 0 : 1 };
        const title = new Set(tokenize(a.title));
        const body = new Set(tokenize(`${a.snippet} ${a.section}`));
        const score = tokens.reduce((n, t) => n + (title.has(t) ? 3 : body.has(t) ? 1 : 0), 0);
        return { a, score };
      })
      .filter((x) => !tokens.length || x.score > 0)
      .sort((x, y) => y.score - x.score || x.a.title.localeCompare(y.a.title))
      .map((x) => x.a);
  }, [q, category]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Knowledge Base</h1>
          <p>Public Circle documentation the copilot can cite. Every link points to a public help.circle.so article.</p>
        </div>
        <ProvenanceBadge kind="fact" />
      </div>

      <div className="banner banner-info" role="note">
        <Icon name="knowledge" />
        <div>
          <strong>Public Circle documentation</strong> — {KNOWLEDGE_BASE.articles.length} articles indexed on {KNOWLEDGE_BASE.retrievedAt}. Titles, URLs and excerpts were collected from public search results ({KNOWLEDGE_BASE.retrievedVia}). The Help Center itself was never scraped, no login was used, and no internal Circle documentation is included. Excerpts can be out of date — always open the article.
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search public articles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search knowledge base" />
        <span className="muted small">{articles.length} articles</span>
      </div>
      <div className="examples">
        <button className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>All</button>
        {CATEGORY_ORDER.filter((c) => counts.get(c)).map((c) => (
          <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {CATEGORY_LABELS[c]} <span className="muted">{counts.get(c)}</span>
          </button>
        ))}
      </div>

      <div className="kb-list">
        {articles.slice(0, 120).map((a) => (
          <div className="card kb-item" key={a.url}>
            <div className="row small muted">
              <span className="pill">{CATEGORY_LABELS[a.category]}</span>
              {a.isOverview && <span className="pill">Section</span>}
            </div>
            <a className="title" href={a.url} target="_blank" rel="noreferrer">{a.title} <Icon name="external" size={12} /></a>
            <span className="url small muted" style={{ fontFamily: 'var(--mono)', fontSize: 11, wordBreak: 'break-all' }}>{a.url.replace('https://', '')}</span>
            {a.snippet && <span className="small" style={{ color: 'var(--text-2)' }}>{a.snippet.length > 200 ? a.snippet.slice(0, 197).trimEnd() + '…' : a.snippet}</span>}
          </div>
        ))}
      </div>
      {articles.length > 120 && <p className="muted small">Showing the first 120 — refine your search to see more.</p>}
      {articles.length === 0 && <div className="card empty-state">No public Circle documentation found for this search.</div>}
    </div>
  );
}
