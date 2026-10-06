import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_TERMS } from '../categories';
import type { CategoryId, SupportSignals } from '../types';
import { PROBLEMS, type Problem } from './playbooks';

export interface Classification {
  category: CategoryId;
  confidence: 'high' | 'medium' | 'low';
  matchedTerms: string[];
  alternatives: CategoryId[];
  problem: Problem | null;
}

const firstMatch = (re: RegExp, text: string) => text.match(re)?.[0];

/** Keyword-weighted category scoring + best problem within the winning category. */
/** Normalise typographic quotes so patterns like can'?t match “can’t”. */
export const normalize = (text: string) => text.replace(/[\u2018\u2019\u02BC]/g, "'").replace(/[\u201C\u201D]/g, '"');

export function classify(raw: string): Classification {
  const text = normalize(raw);
  const scores = new Map<CategoryId, { score: number; terms: string[] }>();

  for (const cat of CATEGORY_ORDER) {
    let score = 0;
    const terms: string[] = [];
    for (const [re, weight] of CATEGORY_TERMS[cat]) {
      const hit = firstMatch(re, text);
      if (hit) {
        score += weight;
        terms.push(hit.toLowerCase());
      }
    }
    scores.set(cat, { score, terms });
  }

  // A matching problem pattern is a strong, specific signal for its category.
  const problemHits = PROBLEMS.map((p) => ({ p, hits: p.patterns.filter((re) => re.test(text)).length }));
  for (const { p, hits } of problemHits) {
    const entry = scores.get(p.category)!;
    if (hits > 0 && entry.score > 0) entry.score += hits;
  }

  const ranked = [...scores.entries()].filter(([, v]) => v.score > 0).sort((a, b) => b[1].score - a[1].score);

  if (ranked.length === 0) {
    return { category: 'other', confidence: 'low', matchedTerms: [], alternatives: [], problem: null };
  }

  const [topId, top] = ranked[0];
  const second = ranked[1]?.[1].score ?? 0;
  const margin = top.score - second;
  const confidence = top.score >= 6 && margin >= 3 ? 'high' : top.score >= 4 && margin >= 1 ? 'medium' : 'low';

  const candidates = problemHits.filter(({ p, hits }) => p.category === topId && hits > 0).sort((a, b) => b.hits - a.hits);
  const problem = candidates[0]?.p ?? null;

  return {
    category: topId,
    confidence,
    matchedTerms: [...new Set(top.terms)],
    alternatives: ranked.slice(1, 3).filter(([, v]) => v.score >= top.score / 2).map(([id]) => id),
    problem,
  };
}

export const categoryLabel = (id: CategoryId) => CATEGORY_LABELS[id];

/** Cross-cutting signals that drive severity and escalation. */
export function detectSignals(raw: string): SupportSignals {
  const text = normalize(raw);
  const t = text.toLowerCase();
  const device =
    firstMatch(/\b(iphone|ipad|ios|android|pixel|samsung|mac(book)?|windows|chromebook)\b/i, text) ??
    firstMatch(/\b(safari|chrome|firefox|edge)\b/i, text) ??
    firstMatch(/\b(mobile app|desktop|mobile)\b/i, text);
  return {
    multipleUsers:
      /\b(all|every|several|multiple|many|most|lots of|a (bunch|number) of|\d{2,}|dozens?|hundreds?)\b[\w\s]{0,20}\b(members|users|people|attendees|customers|students|subscribers)\b/.test(t) ||
      /\beveryone|nobody|no one|\bnone of (our|my|the) members\b|whole community|entire community/.test(t),
    regression: /\b(used to work|was working|worked (fine )?(yesterday|last week|before)|since (the|yesterday|this morning|last)|suddenly|started (today|yesterday|this week)|stopped working)\b/.test(t),
    errorOrDefect: /\b(error|bug|crash(es|ed|ing)?|500|502|503|broken|glitch|blank (page|screen)|white screen|exception|timeout)\b/.test(t),
    billingRisk: /\b(charged|refund|double|overcharg\w*|money|invoice|payment (failed|declined)|dispute|chargeback|paid but)\b/.test(t),
    dataOrPrivacy: /\b(data loss|lost (all|our|my)|deleted (all|our)|gdpr|privacy|personal data|delete (my|all) data|leak(ed)?|security|hacked|compromised)\b/.test(t),
    urgent: /\b(urgent|asap|immediately|right now|in (an|one|two|\d+) (hour|hours|minutes?)|starts? (in|soon)|today'?s (event|launch|session)|launch(ing)? (today|tomorrow))\b/.test(t),
    totalBlocker: /\b(can'?t|cannot|unable to|no way to)\s+(log ?in|sign ?in|access|get into|enter|open|join)\b/.test(t) || /locked out/.test(t),
    howToQuestion: /^(how (do|can|should) (i|we)|is (it|there) (possible|a way)|can (i|we)|where (do|can) (i|we)|what('s| is) the (best )?way)\b/.test(t.trim()) && !/\b(error|not working|isn'?t working|broken|fail)/.test(t),
    adminReporter: /\b(our (community|members|space|paywall|event)|my members|we (run|host|have)|as (an |the )?admin|i'?m the (admin|owner)|our admin)\b/.test(t),
    device: device ?? undefined,
  };
}
