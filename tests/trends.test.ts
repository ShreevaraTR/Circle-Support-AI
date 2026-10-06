import { DEMO_DATASET_LABEL, DEMO_TICKETS } from '../src/data/demoTickets';
import { KNOWLEDGE_BASE } from '../src/data/knowledge';
import { analyzeSupportTrends } from '../src/engine';

describe('synthetic demo dataset', () => {
  it('has 30–50 tickets with DEMO-### ids', () => {
    expect(DEMO_TICKETS.length).toBeGreaterThanOrEqual(30);
    expect(DEMO_TICKETS.length).toBeLessThanOrEqual(50);
    const ids = DEMO_TICKETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^DEMO-\d{3}$/);
  });

  it('every ticket has issue, category, severity, status and date', () => {
    for (const t of DEMO_TICKETS) {
      expect(t.subject && t.body).toBeTruthy();
      expect(t.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['open', 'pending', 'resolved']).toContain(t.status);
      expect(['low', 'medium', 'high', 'critical']).toContain(t.severity);
    }
  });

  it('contains no real-looking personal data (emails, phone numbers)', () => {
    const blob = DEMO_TICKETS.map((t) => `${t.subject} ${t.body} ${t.customerName} ${t.community}`).join('\n');
    expect(blob).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(blob).not.toMatch(/\b[\w-]+\.(com|net|org|io|co)(\.[a-z]{2})?\b/i);
    expect(blob).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
  });

  it('labels the dataset as synthetic and not Circle data', () => {
    expect(DEMO_DATASET_LABEL).toBe('Synthetic support scenarios — created for this portfolio prototype. Not Circle customer data.');
  });
});

describe('analyzeSupportTrends', () => {
  it('computes consistent totals', async () => {
    const r = await analyzeSupportTrends(DEMO_TICKETS, KNOWLEDGE_BASE);
    expect(r.total).toBe(DEMO_TICKETS.length);
    expect(r.open + r.pending + r.resolved).toBe(r.total);
    expect(r.byCategory.reduce((n, c) => n + c.count, 0)).toBe(r.total);
    expect(r.bySeverity.reduce((n, c) => n + c.count, 0)).toBe(r.total);
    expect(r.weekly.reduce((n, w) => n + w.count, 0)).toBe(r.total);
    expect(r.topProblems.reduce((n, p) => n + p.count, 0)).toBe(r.total);
    expect(r.byCategory[0].key).toBe('auth');
  });

  it('finds the designed trend (live streams rising) and derives opportunities from it', async () => {
    const r = await analyzeSupportTrends(DEMO_TICKETS, KNOWLEDGE_BASE);
    expect(r.trending[0].category).toBe('live');
    expect(r.opportunities.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(DEMO_TICKETS.map((t) => t.id));
    for (const o of r.opportunities) {
      expect(o.ticketIds.length).toBeGreaterThanOrEqual(3);
      for (const id of o.ticketIds) expect(ids.has(id)).toBe(true);
      expect(o.evidence.join(' ')).toMatch(/synthetic dataset/);
      for (const d of o.relatedDocs) expect(d.url).toMatch(/^https:\/\/help\.circle\.so\//);
    }
    expect(r.opportunities.map((o) => o.id)).toEqual(expect.arrayContaining(['auth-sso-access', 'live-join']));
  });

  it('never presents synthetic trends as Circle’s real trends', async () => {
    const r = await analyzeSupportTrends(DEMO_TICKETS, KNOWLEDGE_BASE);
    for (const line of [...r.headline.slice(0, 2), ...r.trending.map((t) => t.statement)]) expect(line).toMatch(/synthetic dataset/);
    expect(r.headline[2]).toMatch(/synthetic ticket/);
    const blob = JSON.stringify(r);
    expect(blob).not.toMatch(/Circle('|’)s (most common|customers|users|support (volume|tickets))/i);
    expect(blob).not.toMatch(/Circle customers/i);
  });
});
