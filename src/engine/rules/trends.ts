import { CATEGORY_LABELS, CATEGORY_ORDER } from '../categories';
import type {
  CountRow,
  DemoTicket,
  KBArticle,
  KnowledgeBase,
  ProactiveOpportunity,
  ProblemCluster,
  Severity,
  TicketStatus,
  TrendingIssue,
  TrendReport,
} from '../types';
import { classify } from './classify';
import { PROBLEMS } from './playbooks';
import { resolveDoc } from './retrieve';
import { RULES_ENGINE_NAME } from './analyze';

const DAY = 86_400_000;
const RECENT_DAYS = 14;
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function countBy<K extends string>(items: K[], order: K[], label: (k: K) => string): CountRow<K>[] {
  const total = items.length;
  return order
    .map((key) => {
      const count = items.filter((i) => i === key).length;
      return { key, label: label(key), count, share: total ? count / total : 0 };
    })
    .filter((r) => r.count > 0);
}

/** Which problem playbook a ticket belongs to (classified from its text, constrained to its tagged category). */
export function problemForTicket(t: DemoTicket): { id: string; label: string } {
  const cls = classify(`${t.subject}. ${t.body}`);
  if (cls.problem && cls.problem.category === t.category) return { id: cls.problem.id, label: cls.problem.label };
  const fallback = PROBLEMS.filter((p) => p.category === t.category).find((p) => p.patterns.some((re) => re.test(`${t.subject} ${t.body}`)));
  if (fallback) return { id: fallback.id, label: fallback.label };
  return { id: `${t.category}-general`, label: `Other ${CATEGORY_LABELS[t.category]} issues` };
}

export function analyzeTrendsWithRules(tickets: DemoTicket[], kb: KnowledgeBase, datasetLabel: string): TrendReport {
  const total = tickets.length;
  const dates = tickets.map((t) => Date.parse(t.createdAt)).sort((a, b) => a - b);
  const from = dates[0] ?? Date.now();
  const to = dates[dates.length - 1] ?? Date.now();
  // "Now" is anchored to the newest ticket so results are deterministic.
  const recentStart = to - (RECENT_DAYS - 1) * DAY;
  const previousStart = recentStart - RECENT_DAYS * DAY;
  const isRecent = (t: DemoTicket) => Date.parse(t.createdAt) >= recentStart;
  const isPrevious = (t: DemoTicket) => {
    const d = Date.parse(t.createdAt);
    return d >= previousStart && d < recentStart;
  };
  const isUnresolved = (t: DemoTicket) => t.status !== 'resolved';

  const byCategory = countBy(tickets.map((t) => t.category), CATEGORY_ORDER, (k) => CATEGORY_LABELS[k]).sort((a, b) => b.count - a.count);
  const bySeverity = countBy<Severity>(tickets.map((t) => t.severity), ['critical', 'high', 'medium', 'low'], (k) => k[0].toUpperCase() + k.slice(1));
  const byStatus = countBy<TicketStatus>(tickets.map((t) => t.status), ['open', 'pending', 'resolved'], (k) => k[0].toUpperCase() + k.slice(1));

  // Weekly volume, 7-day buckets from the first ticket.
  const weeks = Math.max(1, Math.ceil((to - from + DAY) / (7 * DAY)));
  const weekly = Array.from({ length: weeks }, (_, w) => {
    const start = from + w * 7 * DAY;
    return {
      weekStart: new Date(start).toISOString().slice(0, 10),
      count: tickets.filter((t) => {
        const d = Date.parse(t.createdAt);
        return d >= start && d < start + 7 * DAY;
      }).length,
    };
  });

  // Problem clusters.
  const clusters = new Map<string, ProblemCluster>();
  for (const t of tickets) {
    const p = problemForTicket(t);
    const c = clusters.get(p.id) ?? { id: p.id, label: p.label, category: t.category, count: 0, open: 0, recent: 0, previous: 0, ticketIds: [] };
    c.count++;
    if (isUnresolved(t)) c.open++;
    if (isRecent(t)) c.recent++;
    if (isPrevious(t)) c.previous++;
    c.ticketIds.push(t.id);
    clusters.set(p.id, c);
  }
  const topProblems = [...clusters.values()].sort((a, b) => b.count - a.count || b.recent - a.recent);

  // Trending categories: last 14 days vs the 14 days before.
  const trending: TrendingIssue[] = CATEGORY_ORDER.map((category) => {
    const recent = tickets.filter((t) => t.category === category && isRecent(t)).length;
    const previous = tickets.filter((t) => t.category === category && isPrevious(t)).length;
    const label = CATEGORY_LABELS[category];
    return {
      category,
      label,
      recent,
      previous,
      change: recent - previous,
      statement: `In this synthetic dataset, ${label} tickets went from ${previous} to ${recent} when comparing the previous 14 days with the most recent 14 days.`,
    };
  })
    .filter((t) => t.recent >= 3 && t.recent > t.previous)
    .sort((a, b) => b.change - a.change || b.recent - a.recent);

  // Headline insights — always scoped to the synthetic dataset.
  const unresolved = tickets.filter(isUnresolved);
  const unresolvedHigh = unresolved.filter((t) => t.severity === 'high' || t.severity === 'critical').length;
  const top = byCategory[0];
  const headline = [
    top ? `In this synthetic dataset, ${top.label} is the most common category (${top.count} of ${total} tickets, ${pct(top.count, total)}%).` : 'No tickets in the dataset.',
    trending[0] ? `${trending[0].label} is the fastest-growing category in the synthetic dataset over the most recent 14 days (${trending[0].previous} → ${trending[0].recent}).` : 'No category is growing in the most recent 14 days of the synthetic dataset.',
    `${plural(unresolved.length, 'synthetic ticket')} are open or pending; ${unresolvedHigh} of them are rated high or critical.`,
  ];

  // Proactive opportunities: the biggest clusters, plus the biggest cluster inside each trending category.
  const picked: ProblemCluster[] = [];
  const add = (c?: ProblemCluster) => c && !picked.includes(c) && !c.id.endsWith('-general') && picked.push(c);
  topProblems.filter((c) => c.count >= 3).slice(0, 3).forEach(add);
  trending.forEach((tr) => add(topProblems.find((c) => c.category === tr.category && c.count >= 3)));

  const opportunities: ProactiveOpportunity[] = picked.slice(0, 4).map((c) => {
    const playbook = PROBLEMS.find((p) => p.id === c.id)!;
    const highOrCritical = tickets.filter((t) => c.ticketIds.includes(t.id) && (t.severity === 'high' || t.severity === 'critical')).length;
    const trend = trending.find((t) => t.category === c.category);
    const evidence = [
      `${plural(c.count, 'ticket')} out of ${total} in the synthetic dataset (${pct(c.count, total)}%).`,
      `${c.recent} of them in the most recent 14 days${trend ? ` — ${trend.label} is trending up (${trend.previous} → ${trend.recent})` : ''}.`,
      `${c.open} still open or pending; ${highOrCritical} rated high or critical.`,
    ];
    const relatedDocs = playbook.docs
      .map((d) => resolveDoc(kb, d))
      .filter((a): a is KBArticle => Boolean(a))
      .filter((a, i, all) => all.findIndex((b) => b.title === a.title) === i)
      .slice(0, 3);
    return {
      id: c.id,
      title: c.label,
      problem: `${playbook.label} accounts for ${pct(c.count, total)}% of the synthetic tickets (${CATEGORY_LABELS[c.category]}).`,
      evidence,
      ticketIds: c.ticketIds,
      action: playbook.proactive.action,
      impact: playbook.proactive.impact,
      relatedDocs,
    };
  });

  return {
    engine: RULES_ENGINE_NAME,
    datasetLabel,
    total,
    open: tickets.filter((t) => t.status === 'open').length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    range: { from: new Date(from).toISOString().slice(0, 10), to: new Date(to).toISOString().slice(0, 10) },
    windows: {
      days: RECENT_DAYS,
      recentFrom: new Date(recentStart).toISOString().slice(0, 10),
      previousFrom: new Date(previousStart).toISOString().slice(0, 10),
    },
    byCategory,
    bySeverity,
    byStatus,
    weekly,
    topProblems,
    trending,
    headline,
    opportunities,
  };
}

