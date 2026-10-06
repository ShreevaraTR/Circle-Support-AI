import type { CategoryId, KBArticle, KnowledgeBase, SourceMatch } from '../types';

const STOPWORDS = new Set(
  `a an the and or but if to of in on for with at by from is are was were be been being i we you they he she it my our your their
   me us them this that these those can cant cannot can't not no do does did dont don't have has had will would should could
   just get got also when what where which who how why there here into out up about after before again any some all very too
   im i'm its it's hi hello thanks thank please help issue problem trying try tried able unable keep keeps still even only
   member members community circle user users one`.split(/\s+/),
);

/** Very small stemmer — enough to match "notifications"/"notification", "joining"/"join". */
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/i, '');

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

/** Resolve a URL path fragment (from the playbooks) to an indexed public article. */
export function resolveDoc(kb: KnowledgeBase, fragment: string): KBArticle | undefined {
  const matches = kb.articles.filter((a) => a.url.includes(fragment));
  // Prefer current /p/ paths, then the shortest (most specific parent) URL.
  return matches.sort((a, b) => Number(b.url.includes('/p/')) - Number(a.url.includes('/p/')) || a.url.length - b.url.length)[0];
}

/**
 * Rank public articles for an issue: pinned playbook docs first, then lexical overlap
 * on title (weighted) and search excerpt, with a bonus for matching category.
 * Returns [] when nothing clears the relevance floor — the UI then says so plainly.
 */
export function retrieveSources(
  kb: KnowledgeBase,
  text: string,
  category: CategoryId,
  pinned: string[],
  limit = 4,
): SourceMatch[] {
  const queryTokens = new Set(tokenize(text));
  const results: SourceMatch[] = [];
  const seen = new Set<string>();
  const seenTitles = new Set<string>();

  pinned.forEach((frag, i) => {
    const article = resolveDoc(kb, frag);
    if (!article || seen.has(article.url)) return;
    seen.add(article.url);
    seenTitles.add(article.title);
    const titleTokens = new Set(tokenize(article.title));
    results.push({
      article,
      relevance: Math.round(Math.max(0.6, 0.95 - i * 0.08) * 100) / 100,
      matchedTerms: [...queryTokens].filter((t) => titleTokens.has(t)),
      pinned: true,
    });
  });

  const scored: SourceMatch[] = [];
  for (const article of kb.articles) {
    if (seen.has(article.url) || seenTitles.has(article.title)) continue;
    const titleTokens = new Set(tokenize(article.title));
    const snippetTokens = new Set(tokenize(article.snippet));
    const matched = [...queryTokens].filter((t) => titleTokens.has(t) || snippetTokens.has(t));
    if (matched.length === 0) continue;
    let score = 0;
    for (const t of matched) score += titleTokens.has(t) ? 3 : 1;
    if (article.category === category) score += 3;
    else if (article.categories.includes(category)) score += 1.5;
    else if (category !== 'other') score -= 2;
    if (article.isOverview) score -= 1;
    if (score >= 5) scored.push({ article, relevance: Math.round(Math.min(0.85, score / 14) * 100) / 100, matchedTerms: matched, pinned: false });
  }
  scored.sort((a, b) => b.relevance - a.relevance);

  // Same-titled member/admin variants of an article add noise — keep the first.
  for (const m of scored) {
    if (seenTitles.has(m.article.title)) continue;
    seenTitles.add(m.article.title);
    results.push(m);
  }
  return results.slice(0, limit);
}
