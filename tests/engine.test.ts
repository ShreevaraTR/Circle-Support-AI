import { DEMO_TICKETS } from '../src/data/demoTickets';
import { KNOWLEDGE_BASE } from '../src/data/knowledge';
import { analyzeSupportIssue, getSupportEngine, rulesEngine, setSupportEngine } from '../src/engine';
import { classify } from '../src/engine/rules/classify';
import type { SupportEngine } from '../src/engine/types';
import { SCENARIOS, UNDOCUMENTED } from './scenarios';

const kbUrls = new Set(KNOWLEDGE_BASE.articles.map((a) => a.url));

describe('Support Copilot scenarios', () => {
  for (const s of SCENARIOS) {
    it(`analyses: ${s.name}`, async () => {
      const a = await analyzeSupportIssue({ text: s.text, customerName: s.customerName }, KNOWLEDGE_BASE);
      expect(a.category.id).toBe(s.category);
      if (s.problem) expect(a.problem.id).toBe(s.problem);
      expect(a.escalation.level).toBe(s.escalation);
      expect(a.severity.level).toBe(s.severity);
      expect(a.escalation.reasons.length).toBeGreaterThan(0);
      expect(a.troubleshooting.length).toBeGreaterThanOrEqual(2);
      expect(a.sources.length).toBeGreaterThan(0);
      if (s.mustCite) expect(a.sources.some((src) => src.article.url.includes(s.mustCite!))).toBe(true);
      // Every cited link is a real indexed public article.
      for (const src of a.sources) expect(kbUrls.has(src.article.url)).toBe(true);
      for (const step of a.troubleshooting) if (step.basis === 'doc') expect(kbUrls.has(step.sourceUrl!)).toBe(true);
      if (s.customerName) expect(a.response.startsWith(`Hi ${s.customerName},`)).toBe(true);
    });
  }

  it('says when no public documentation matches instead of inventing a source', async () => {
    const a = await analyzeSupportIssue(UNDOCUMENTED, KNOWLEDGE_BASE);
    expect(a.sources).toEqual([]);
    expect(a.response).not.toMatch(/help\.circle\.so/);
  });

  it('falls back to Other for unrelated text', async () => {
    const a = await analyzeSupportIssue('Hello there, quick question about something.', KNOWLEDGE_BASE);
    expect(a.category.id).toBe('other');
    expect(a.category.confidence).toBe('low');
  });
});

describe('classification of demo tickets', () => {
  it('classifies every synthetic ticket into its tagged category', () => {
    const misses = DEMO_TICKETS.filter((t) => classify(`${t.subject}. ${t.body}`).category !== t.category).map((t) => t.id);
    expect(misses).toEqual([]);
  });
});

describe('response drafting guardrails', () => {
  const texts = [...SCENARIOS.map((s) => s.text), ...DEMO_TICKETS.map((t) => `${t.subject}. ${t.body}`)];

  it('never claims a fix, promises timelines/refunds, or leaks internal language', async () => {
    for (const text of texts) {
      const { response, escalation } = await analyzeSupportIssue({ text, customerName: 'Sam' }, KNOWLEDGE_BASE);
      expect(response).not.toMatch(/\b(has been|have been|is now|we('ve| have)) (fixed|resolved)\b/i);
      expect(response).not.toMatch(/\bguarantee|within \d+ (minutes|hours|days)|refund (has been|will be) (issued|processed)|SLA\b/i);
      expect(response).not.toMatch(/undefined|\{who\}|\[object/);
      expect(response).toMatch(/^Hi Sam,/);
      expect(response.split(/\s+/).length).toBeLessThan(260);
      if (escalation.level !== 'none') expect(response).toMatch(/could you (also )?reply with/i);
    }
  });
});

describe('swappable reasoning layer', () => {
  it('routes analyzeSupportIssue through the active engine', async () => {
    const fake: SupportEngine = {
      name: 'Fake LLM engine',
      analyzeSupportIssue: async (input, kb) => ({ ...(await rulesEngine.analyzeSupportIssue(input, kb)), engine: 'Fake LLM engine' }),
      analyzeSupportTrends: rulesEngine.analyzeSupportTrends,
    };
    setSupportEngine(fake);
    try {
      expect(getSupportEngine().name).toBe('Fake LLM engine');
      const a = await analyzeSupportIssue('Members cannot join the live stream', KNOWLEDGE_BASE);
      expect(a.engine).toBe('Fake LLM engine');
    } finally {
      setSupportEngine(rulesEngine);
    }
  });
});
