#!/usr/bin/env node
/**
 * Build-time knowledge index for Circle Support Copilot.
 *
 * Discovers PUBLIC Circle Help Center articles (help.circle.so) through the
 * Brave Search API and writes their title, URL and search-result snippet to
 * src/data/knowledge.json. The app reads that JSON at runtime and never
 * makes network calls.
 *
 * What this script does NOT do:
 *   - it never requests help.circle.so directly (the site returns 403 to bots,
 *     and we respect that rather than working around it)
 *   - it never logs in, uses credentials, or touches private content
 *
 * Usage:
 *   BRAVE_API_KEY=... node scripts/build-kb.mjs
 *   (in environments where a proxy injects the Brave credential, no key is needed;
 *    Node's fetch needs NODE_USE_ENV_PROXY=1 to go through an HTTPS proxy)
 *
 *   node scripts/build-kb.mjs --offline
 *   re-runs only the categorise/dedupe step over the existing JSON (no network).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'knowledge.json');
const ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

/** Category ids must match src/engine/types.ts */
const QUERIES = [
  ['auth', 'SSO single sign-on'],
  ['auth', 'login sign in password'],
  ['auth', 'OAuth SAML'],
  ['live', 'live stream'],
  ['live', 'live room join'],
  ['payments', 'paywall payments'],
  ['payments', 'Stripe subscription refund'],
  ['events', 'events RSVP'],
  ['events', 'event calendar recurring'],
  ['notifications', 'notifications'],
  ['notifications', 'push notifications mobile'],
  ['members', 'invite members'],
  ['members', 'member tags access groups'],
  ['members', 'remove ban member'],
  ['spaces', 'spaces private secret'],
  ['spaces', 'space groups access'],
  ['email', 'email digest'],
  ['email', 'email deliverability custom domain'],
  ['mobile', 'mobile app iOS Android'],
  ['mobile', 'branded app'],
  ['api', 'API'],
  ['api', 'Zapier integration'],
  ['api', 'webhooks workflows'],
  ['account', 'custom domain'],
  ['account', 'delete account profile'],
  ['account', 'community settings plan'],
  ['other', 'HAR file troubleshooting'],
  ['other', 'supported browsers'],
  ['other', 'getting help support'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s = '') =>
  s.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/**
 * Category rules, applied to the article's URL path + title. The first match is the
 * primary category; every match is kept so an article can surface for related issues.
 */
const CATEGORY_RULES = [
  ['auth', /\bsso\b|\/sso\/|log(ging)?[ -]?in|password|signing in|sign in|locked out|cookie|verification[ -]cod|oidc|auth0/i],
  ['live', /\blive\b|live-/i],
  ['events', /\bevents?\b|rsvp|\/events\//i],
  ['payments', /paywall|\/payments\/|stripe|refund|subscription|billing|transaction|installment|pay later|payout|affiliate|tax/i],
  ['notifications', /notification|digest/i],
  ['email', /email|from" address/i],
  ['mobile', /mobile|\bios\b|android|branded[ -]app|desktop app|in-app purchase|app submission|developer accounts/i],
  ['api', /\bapi\b|\/api\/|zapier|webhook|workflow|integrat|automat|shopify|typeform|embed|developer|javascript|rewardful/i],
  ['spaces', /\bspaces?\b|space group|private community|public community|chat space|post space/i],
  ['members', /member|invite|invitation|onboarding|tags?\b|access group|\bban\b|deactivat|segment|contacts|profile field/i],
  ['account', /custom domain|subdomain|root domain|\/account|community plan|profile|branding|customi[sz]|getting started|export|community switcher/i],
];

function categorise(article) {
  // Drop umbrella path segments ("live-and-events", "sso-and-integrations", ...) that
  // would otherwise pull every child article into the wrong category.
  const pathname = new URL(article.url).pathname
    .replace(/live-and-events|sso-and-integrations|account-access-management/g, '');
  const hay = `${pathname} ${article.title}`;
  const cats = CATEGORY_RULES.filter(([, re]) => re.test(hay)).map(([c]) => c);
  return cats.length ? cats : ['other'];
}

/** Clean, categorise and de-duplicate (prefer /p/ over legacy /c/ paths with the same title). */
function finalise(list) {
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const pTitles = new Set(list.filter((a) => a.url.includes('/p/')).map((a) => norm(a.title)));
  // Snippets shared by several pages are section boilerplate, not article content.
  const snippetCounts = new Map();
  for (const a of list) snippetCounts.set(a.snippet, (snippetCounts.get(a.snippet) ?? 0) + 1);
  const out = [];
  for (const a of list) {
    if (a.url.includes('/c/') && pTitles.has(norm(a.title))) continue;
    let snippet = a.snippet.replace(/^.*?How can I help\?\s*/i, '');
    if (
      snippetCounts.get(a.snippet) > 1 ||
      /cannot provide a description|third-party cookies that help us|^welcome to|^in this section|whether you're looking to|unlock the power/i.test(snippet)
    ) snippet = '';
    const categories = categorise(a);
    out.push({
      id: a.url.replace('https://help.circle.so/', '').replace(/\//g, '_'),
      title: a.title,
      url: a.url,
      snippet,
      section: a.section,
      category: categories[0],
      categories,
      isOverview: a.url.split('/').length <= 6 && !/\/c\//.test(a.url),
    });
  }
  return out;
}

if (process.argv.includes('--offline')) {
  const existing = JSON.parse(await readFile(OUT, 'utf8'));
  existing.articles = finalise(existing.articles);
  await writeFile(OUT, JSON.stringify(existing, null, 2) + '\n');
  console.log(`Re-categorised ${existing.articles.length} articles (offline).`);
  process.exit(0);
}

async function search(q) {
  const url = `${ENDPOINT}?${new URLSearchParams({ q: `site:help.circle.so ${q}`, count: '20' })}`;
  const headers = { Accept: 'application/json' };
  if (process.env.BRAVE_API_KEY) headers['X-Subscription-Token'] = process.env.BRAVE_API_KEY;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`Brave search failed (${res.status}) for "${q}"`);
    const data = await res.json();
    return data.web?.results ?? [];
  }
  throw new Error(`Rate limited repeatedly for "${q}"`);
}

const articles = new Map();
for (const [category, q] of QUERIES) {
  const results = await search(q);
  for (const r of results) {
    let u;
    try { u = new URL(r.url); } catch { continue; }
    // Only public Help Center article pages.
    if (u.hostname !== 'help.circle.so') continue;
    if (!/^\/(p|c)\/.+/.test(u.pathname)) continue;
    const title = stripHtml(r.title).replace(/\s*\|\s*Circle Knowledge Base\s*$/i, '').trim();
    if (!title || title === 'Circle Knowledge Base') continue;
    const key = `${u.origin}${u.pathname}`.replace(/\/$/, '');
    const existing = articles.get(key);
    if (existing) {
      if (!existing.queryCategories.includes(category)) existing.queryCategories.push(category);
      continue;
    }
    articles.set(key, {
      url: key,
      title,
      snippet: stripHtml(r.description),
      section: u.pathname.split('/').filter(Boolean).slice(1, -1).join(' / '),
      queryCategories: [category],
    });
  }
  process.stdout.write(`  ${category.padEnd(14)} "${q}" → ${results.length} results\n`);
  await sleep(1100); // stay within free-tier rate limits
}

const out = {
  source: 'Circle Help Center (public)',
  retrievedVia: 'Brave Search API — search-result titles, URLs and snippets only',
  retrievedAt: new Date().toISOString().slice(0, 10),
  articles: finalise([...articles.values()]),
};
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`\nWrote ${out.articles.length} public articles to ${path.relative(process.cwd(), OUT)}`);
