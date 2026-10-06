import { CATEGORY_LABELS } from '../categories';
import type {
  DemoTicket,
  KBArticle,
  KnowledgeBase,
  ProductHandoff,
  ProductSignal,
  Severity,
  TrendDirection,
  TrendReport,
} from '../types';
import { analyzeWithRules, RULES_ENGINE_NAME } from './analyze';
import { detectSignals } from './classify';
import { PROBLEMS } from './playbooks';
import { genericFraming, PRODUCT_FRAMING } from './productSignals';
import { resolveDoc } from './retrieve';

/** A pattern needs at least this many related tickets before it is raised as a product signal. */
export const MIN_SIGNAL_TICKETS = 3;

const SEVERITY_RANK: Severity[] = ['low', 'medium', 'high', 'critical'];
const ticketText = (t: DemoTicket) => `${t.subject}. ${t.body}`;
const framingFor = (id: string, label: string) => PRODUCT_FRAMING[id] ?? genericFraming(label);

function platformOf(t: DemoTicket): string | undefined {
  const device = detectSignals(ticketText(t)).device?.toLowerCase();
  if (!device) return undefined;
  if (/iphone|ipad|ios/.test(device)) return 'iOS app';
  if (/android|pixel|samsung/.test(device)) return 'Android app';
  if (/mobile/.test(device)) return 'Mobile app (OS not stated)';
  return 'Desktop / browser';
}

const isMobile = (label: string) => /app/.test(label) && !/desktop/i.test(label);

/**
 * Turn the Support Trends problem clusters into product signals. Uses the same
 * TrendReport (and therefore the same ticket grouping) as the Support Trends page.
 */
export function findProductSignals(report: TrendReport, tickets: DemoTicket[]): ProductSignal[] {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  return report.topProblems
    .filter((c) => c.count >= MIN_SIGNAL_TICKETS && !c.id.endsWith('-general'))
    .map((c) => {
      const related = c.ticketIds.map((id) => byId.get(id)!).filter(Boolean);
      const severity = related.reduce<Severity>((max, t) => (SEVERITY_RANK.indexOf(t.severity) > SEVERITY_RANK.indexOf(max) ? t.severity : max), 'low');
      const severityCounts: Partial<Record<Severity, number>> = {};
      for (const t of related) severityCounts[t.severity] = (severityCounts[t.severity] ?? 0) + 1;

      const platformCounts = new Map<string, number>();
      for (const t of related) {
        const p = platformOf(t);
        if (p) platformCounts.set(p, (platformCounts.get(p) ?? 0) + 1);
      }
      const platforms = [...platformCounts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
      const mobileCount = platforms.filter((p) => isMobile(p.label)).reduce((n, p) => n + p.count, 0);

      const direction: TrendDirection = c.recent > c.previous ? 'increasing' : c.recent < c.previous ? 'decreasing' : 'stable';
      const framing = framingFor(c.id, c.label);
      const dates = related.map((t) => t.createdAt).sort();

      const mobileHeavy = mobileCount / related.length >= 0.5;
      return {
        id: c.id,
        name: mobileHeavy ? `${framing.name} on mobile` : framing.name,
        mobileHeavy,
        category: c.category,
        areaLabel: CATEGORY_LABELS[c.category],
        ticketIds: c.ticketIds,
        count: c.count,
        unresolved: c.open,
        trend: { direction, recent: c.recent, previous: c.previous, windowDays: report.windows.days, recentFrom: report.windows.recentFrom, previousFrom: report.windows.previousFrom },
        severity,
        severityCounts,
        platforms,
        recommendation: framing.investigation,
        firstSeen: dates[0],
        lastSeen: dates[dates.length - 1],
      };
    });
}

/** Build a structured Product/Engineering handoff for one signal. Deterministic. */
export function generateHandoff(signal: ProductSignal, tickets: DemoTicket[], kb: KnowledgeBase): ProductHandoff {
  const related = tickets.filter((t) => signal.ticketIds.includes(t.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const n = related.length;
  const playbook = PROBLEMS.find((p) => p.id === signal.id);
  const framing = framingFor(signal.id, playbook?.label ?? signal.name);

  // Re-use the per-ticket Copilot analysis so priority follows the same severity/escalation logic.
  const analyses = related.map((t) => analyzeWithRules({ text: ticketText(t) }, kb));
  const blocked = analyses.filter((a) => a.signals.totalBlocker).length;
  const multi = analyses.filter((a) => a.signals.multipleUsers).length;
  const urgent = analyses.filter((a) => a.signals.urgent).length;
  const engineering = analyses.filter((a) => a.escalation.level === 'engineering').length;
  const resolved = related.filter((t) => t.status === 'resolved').length;
  const unresolved = n - resolved;
  const { trend } = signal;

  const customerImpact = [
    framing.impact,
    ...(blocked ? [`${blocked} of ${n} synthetic tickets describe a member being fully blocked.`] : []),
    ...(multi ? [`${multi} of ${n} synthetic tickets mention more than one affected member.`] : []),
    ...(urgent ? [`${urgent} of ${n} synthetic tickets involved a time-sensitive situation (e.g. a session about to start).`] : []),
    `${unresolved} of ${n} synthetic tickets are still open or pending.`,
    'Impact is limited to what these synthetic tickets describe — no usage, revenue or customer-count data is used.',
  ];

  const sevBreakdown = SEVERITY_RANK.slice()
    .reverse()
    .filter((s) => signal.severityCounts[s])
    .map((s) => `${signal.severityCounts[s]} ${s}`)
    .join(', ');

  const observedPattern = [
    `${n} synthetic tickets describe related ${signal.areaLabel} problems (${framing.name.toLowerCase()}).`,
    `Trend: ${trend.previous} → ${trend.recent} tickets when comparing the ${trend.windowDays} days from ${trend.previousFrom} with the ${trend.windowDays} days from ${trend.recentFrom} (${trend.direction}).`,
    `First seen ${signal.firstSeen}; most recent ${signal.lastSeen}.`,
    signal.platforms.length
      ? `Platforms mentioned: ${signal.platforms.map((p) => `${p.label} (${p.count})`).join(', ')}${signal.platforms.reduce((s, p) => s + p.count, 0) < n ? `; ${n - signal.platforms.reduce((s, p) => s + p.count, 0)} ticket(s) did not say` : ''}.`
      : 'No platform was stated in these tickets.',
    `Severity of the supporting tickets: ${sevBreakdown}.`,
    `Grouped by the same deterministic problem classification used on Support Trends (“${playbook?.label ?? signal.name}”).`,
  ];

  const supportTried = [
    ...(playbook?.steps ?? []).slice(0, 4).map((s) => `Playbook step: ${s.text}`),
    `${resolved} of ${n} synthetic tickets are marked resolved and ${unresolved} remain open or pending.`,
    'The synthetic tickets do not include full conversation histories; the steps above are this prototype’s standard first-line playbook for this problem type.',
  ];

  // Priority — prototype logic built on the existing severity and escalation outputs.
  const hasCritical = (signal.severityCounts.critical ?? 0) > 0;
  const hasHigh = (signal.severityCounts.high ?? 0) > 0;
  const increasing = trend.direction === 'increasing';
  const reasons: string[] = [];
  if (hasCritical) reasons.push('At least one supporting ticket is rated critical.');
  else if (hasHigh) reasons.push('At least one supporting ticket is rated high.');
  if (increasing) reasons.push(`Volume is increasing in the synthetic data (${trend.previous} → ${trend.recent}).`);
  if (unresolved >= 2) reasons.push(`${unresolved} supporting tickets are still open or pending.`);
  if (engineering) reasons.push(`The Copilot’s per-ticket escalation logic recommended engineering for ${engineering} of ${n} tickets.`);
  const level: ProductHandoff['priority']['level'] =
    hasCritical || (hasHigh && increasing) || (engineering >= 2 && unresolved >= 2) ? 'High' : hasHigh || increasing || unresolved >= 2 ? 'Medium' : 'Low';
  if (reasons.length === 0) reasons.push('Recurring pattern with no high-severity or growth signals.');
  const route = engineering
    ? 'Engineering investigation, with Product review'
    : `Product review via the ${playbook?.escalationPath === 'engineering' ? 'engineering' : 'specialist'} team`;

  const relatedDocs = (playbook?.docs ?? [])
    .map((d) => resolveDoc(kb, d))
    .filter((a): a is KBArticle => Boolean(a))
    .filter((a, i, all) => all.findIndex((b) => b.title === a.title) === i)
    .slice(0, 3);

  return {
    engine: RULES_ENGINE_NAME,
    signalId: signal.id,
    title: `${framing.headline}${signal.mobileHeavy ? ' on mobile' : ''} — ${n} synthetic tickets, ${trend.direction}`,
    problem: `${framing.problem} This portfolio prototype identified the pattern across ${n} tickets in the synthetic support dataset.`,
    customerImpact,
    evidence: related.map((t) => ({ id: t.id, subject: t.subject, createdAt: t.createdAt, severity: t.severity, status: t.status })),
    observedPattern,
    supportTried,
    suggestedInvestigation: framing.investigation,
    priority: { level, route, reasons },
    relatedDocs,
    source: 'Source: Synthetic support dataset — DEMO tickets created for this portfolio prototype. Not Circle customer data.',
    humanReview:
      'Human review required. This handoff is a portfolio prototype recommendation generated from synthetic data. A support specialist should verify the evidence and edit it before sharing it with Product or Engineering.',
    generatedFrom: `${RULES_ENGINE_NAME} · from the Support Trends analysis`,
  };
}
