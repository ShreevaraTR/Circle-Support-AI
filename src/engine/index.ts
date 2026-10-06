/**
 * Public entry point for the reasoning layer.
 *
 * The UI calls only analyzeSupportIssue(), analyzeSupportTrends(), analyzeProductSignals()
 * and generateProductFeedback(). All are async
 * and return plain typed objects, so the deterministic rules engine used in V1 can be
 * swapped for an LLM-backed engine (same `SupportEngine` interface) without UI changes:
 *
 *   setSupportEngine(myLlmEngine);
 */
import { DEMO_DATASET_LABEL } from '../data/demoTickets';
import { analyzeWithRules, RULES_ENGINE_NAME } from './rules/analyze';
import { analyzeTrendsWithRules } from './rules/trends';
import { findProductSignals, generateHandoff } from './rules/feedback';
import type {
  DemoTicket,
  KnowledgeBase,
  ProductHandoff,
  ProductSignal,
  SupportAnalysis,
  SupportEngine,
  SupportIssueInput,
  TrendReport,
} from './types';

export const rulesEngine: SupportEngine = {
  name: RULES_ENGINE_NAME,
  analyzeSupportIssue: async (input, knowledge) => analyzeWithRules(input, knowledge),
  analyzeSupportTrends: async (tickets, knowledge) => analyzeTrendsWithRules(tickets, knowledge, DEMO_DATASET_LABEL),
  analyzeProductSignals: async (report, tickets) => findProductSignals(report, tickets),
  generateProductFeedback: async (signal, tickets, knowledge) => generateHandoff(signal, tickets, knowledge),
};

let activeEngine: SupportEngine = rulesEngine;

export function setSupportEngine(engine: SupportEngine) {
  activeEngine = engine;
}

export function getSupportEngine(): SupportEngine {
  return activeEngine;
}

export function analyzeSupportIssue(issue: SupportIssueInput | string, knowledge: KnowledgeBase): Promise<SupportAnalysis> {
  const input = typeof issue === 'string' ? { text: issue } : issue;
  return activeEngine.analyzeSupportIssue(input, knowledge);
}

export function analyzeSupportTrends(tickets: DemoTicket[], knowledge: KnowledgeBase): Promise<TrendReport> {
  return activeEngine.analyzeSupportTrends(tickets, knowledge);
}

/** Recurring patterns from the Support Trends report that are worth raising with Product. */
export function analyzeProductSignals(report: TrendReport, tickets: DemoTicket[]): Promise<ProductSignal[]> {
  return activeEngine.analyzeProductSignals(report, tickets);
}

/** Structured Product/Engineering handoff for one signal. */
export function generateProductFeedback(signal: ProductSignal, tickets: DemoTicket[], knowledge: KnowledgeBase): Promise<ProductHandoff> {
  return activeEngine.generateProductFeedback(signal, tickets, knowledge);
}

export * from './types';
export { CATEGORY_LABELS, CATEGORY_ORDER } from './categories';
