import { DEMO_TICKETS } from '../src/data/demoTickets';
import { KNOWLEDGE_BASE } from '../src/data/knowledge';
import {
  analyzeProductSignals,
  analyzeSupportTrends,
  generateProductFeedback,
  rulesEngine,
  setSupportEngine,
} from '../src/engine';
import { formatForJira, formatForSlack, formatReport } from '../src/engine/feedbackFormat';
import { MIN_SIGNAL_TICKETS } from '../src/engine/rules/feedback';
import type { ProductHandoff, ProductSignal } from '../src/engine/types';

const LIVE_JOIN_IDS = ['DEMO-031', 'DEMO-036', 'DEMO-041', 'DEMO-045', 'DEMO-047', 'DEMO-049'];
const IMPLIES_REAL_DATA = [
  /Circle('|’)s (most common|customers|users|members|support (volume|tickets))/i,
  /Circle (customers|users|members) (are|have|report)/i,
  /customers are experiencing/i,
  /users are reporting/i,
];

async function load() {
  const report = await analyzeSupportTrends(DEMO_TICKETS, KNOWLEDGE_BASE);
  const signals = await analyzeProductSignals(report, DEMO_TICKETS);
  const handoffs = await Promise.all(signals.map((s) => generateProductFeedback(s, DEMO_TICKETS, KNOWLEDGE_BASE)));
  return { report, signals, handoffs };
}
const allText = (h: ProductHandoff) => [JSON.stringify(h), formatForSlack(h), formatForJira(h), formatReport(h)];

describe('product signals', () => {
  it('are derived from the same Support Trends clusters and only for recurring patterns', async () => {
    const { report, signals } = await load();
    expect(signals.length).toBeGreaterThanOrEqual(3);
    for (const s of signals) {
      const cluster = report.topProblems.find((c) => c.id === s.id)!;
      expect(cluster).toBeDefined();
      expect(s.ticketIds).toEqual(cluster.ticketIds);
      expect(s.count).toBeGreaterThanOrEqual(MIN_SIGNAL_TICKETS);
      expect(s.id.endsWith('-general')).toBe(false);
    }
    // Every Support Trends opportunity has a matching product signal.
    for (const o of report.opportunities) expect(signals.map((s) => s.id)).toContain(o.id);
    // One-off problems do not become product feedback.
    const small = report.topProblems.filter((c) => c.count < MIN_SIGNAL_TICKETS).map((c) => c.id);
    for (const id of small) expect(signals.map((s) => s.id)).not.toContain(id);
  });

  it('detects the mobile Live Stream join signal with the right evidence and trend', async () => {
    const { signals } = await load();
    const live = signals.find((s) => s.id === 'live-join')!;
    expect(live.ticketIds).toEqual(LIVE_JOIN_IDS);
    expect(live.name).toBe('Live Stream join issues on mobile');
    expect(live.category).toBe('live');
    expect(live.trend).toMatchObject({ direction: 'increasing', previous: 0, recent: 6 });
    expect(live.severity).toBe('critical');
    for (const id of live.ticketIds) expect(DEMO_TICKETS.find((t) => t.id === id)!.category).toBe('live');
  });
});

describe('generateProductFeedback', () => {
  it('builds a structured handoff whose evidence is exactly the signal tickets', async () => {
    const { signals, handoffs } = await load();
    handoffs.forEach((h, i) => {
      const s = signals[i];
      expect(h.signalId).toBe(s.id);
      expect(h.evidence.map((e) => e.id).sort()).toEqual([...s.ticketIds].sort());
      for (const e of h.evidence) expect(e.id).toMatch(/^DEMO-\d{3}$/);
      expect(h.title.length).toBeGreaterThan(10);
      expect(h.problem).toMatch(/synthetic/);
      expect(h.customerImpact.length).toBeGreaterThan(1);
      expect(h.observedPattern[0]).toMatch(new RegExp(`^${s.count} synthetic tickets`));
      expect(h.supportTried.some((l) => l.startsWith('Playbook step:'))).toBe(true);
      expect(h.suggestedInvestigation).toBe(s.recommendation);
      expect(['Low', 'Medium', 'High']).toContain(h.priority.level);
      for (const d of h.relatedDocs) expect(d.url).toMatch(/^https:\/\/help\.circle\.so\//);
    });
  });

  it('produces the expected live-stream handoff', async () => {
    const { signals } = await load();
    const h = await generateProductFeedback(signals.find((s) => s.id === 'live-join')!, DEMO_TICKETS, KNOWLEDGE_BASE);
    expect(h.title).toBe('Members unable to join Live Streams on mobile — 6 synthetic tickets, increasing');
    expect(h.evidence.map((e) => e.id)).toEqual(LIVE_JOIN_IDS);
    expect(h.priority.level).toBe('High');
    expect(h.observedPattern.join(' ')).toMatch(/0 → 6 tickets/);
  });

  it('always carries synthetic-data provenance and the human-review notice', async () => {
    const { handoffs } = await load();
    for (const h of handoffs) {
      expect(h.source).toBe('Source: Synthetic support dataset — DEMO tickets created for this portfolio prototype. Not Circle customer data.');
      expect(h.humanReview).toMatch(/^Human review required\./);
      expect(h.humanReview).toMatch(/portfolio prototype recommendation/);
    }
  });

  it('never implies the data is real Circle customer data or invents metrics', async () => {
    const { handoffs } = await load();
    for (const h of handoffs) {
      for (const text of allText(h)) {
        for (const re of IMPLIES_REAL_DATA) expect(text).not.toMatch(re);
        expect(text).not.toMatch(/\$\s?\d|revenue loss|churned|\bARR\b|\bMRR\b|resolution time|\bSLA\b/i);
        expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i); // no emails
      }
      // Only counts from the synthetic tickets are used.
      const counts = h.customerImpact.join(' ').match(/\b(\d+) of (\d+)\b/g) ?? [];
      for (const c of counts) expect(Number(c.split(' of ')[1])).toBe(h.evidence.length);
    }
  });

  it('is deterministic', async () => {
    const a = await load();
    const b = await load();
    expect(b.handoffs).toEqual(a.handoffs);
  });

  it('goes through the swappable engine', async () => {
    const { signals } = await load();
    setSupportEngine({ ...rulesEngine, name: 'Fake', generateProductFeedback: async (s: ProductSignal, t, kb) => ({ ...(await rulesEngine.generateProductFeedback(s, t, kb)), engine: 'Fake' }) });
    try {
      expect((await generateProductFeedback(signals[0], DEMO_TICKETS, KNOWLEDGE_BASE)).engine).toBe('Fake');
    } finally {
      setSupportEngine(rulesEngine);
    }
  });
});

describe('copy formats', () => {
  let h: ProductHandoff;
  beforeAll(async () => {
    const { signals } = await load();
    h = await generateProductFeedback(signals.find((s) => s.id === 'live-join')!, DEMO_TICKETS, KNOWLEDGE_BASE);
  });

  it('Slack: concise mrkdwn message with evidence, recommendation label and review notice', () => {
    const t = formatForSlack(h);
    expect(t.split('\n')[0]).toBe(`:mag: *Product feedback signal:* ${h.title}`);
    expect(t).toContain('_Synthetic data — portfolio prototype. Not Circle customer data._');
    expect(t).toContain(`*Evidence:* ${LIVE_JOIN_IDS.join(', ')}`);
    expect(t).toContain('*Suggested investigation (Prototype recommendation · synthetic data):*');
    expect(t).toContain('Human review required.');
    expect(t.split('\n').length).toBeLessThanOrEqual(12);
  });

  it('Jira: structured issue with summary, sections and every ticket', () => {
    const t = formatForJira(h);
    expect(t.startsWith(`Summary: ${h.title}\n`)).toBe(true);
    expect(t).toContain('Priority: High (Prototype priority — not Circle’s internal priority policy.)');
    expect(t).toContain('Labels: support-signal, synthetic-data, portfolio-prototype');
    for (const section of ['h3. Problem', 'h3. Customer impact', 'h3. Evidence', 'h3. Observed pattern', 'h3. What support tried', 'h3. Suggested investigation (Prototype recommendation · synthetic data)', 'h3. Priority rationale']) {
      expect(t).toContain(section);
    }
    for (const id of LIVE_JOIN_IDS) expect(t).toMatch(new RegExp(`^\\* ${id} — `, 'm'));
    expect(t).toContain('Human review required.');
    expect(t.trim().endsWith(h.source)).toBe(true);
  });

  it('Report: complete markdown with all ten sections', () => {
    const t = formatReport(h);
    ['1. Title', '2. Problem', '3. Customer impact', '4. Evidence', '5. Observed pattern', '6. What support tried', '7. Suggested investigation (Prototype recommendation · synthetic data)', '8. Priority', '9. Source', '10. Human review'].forEach((s) =>
      expect(t).toContain(`## ${s}`),
    );
    expect(t).toContain('> Synthetic data — portfolio prototype. Not Circle customer data.');
    for (const id of LIVE_JOIN_IDS) expect(t).toContain(id);
  });
});
