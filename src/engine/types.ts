/**
 * Shared contract between the UI and any reasoning engine.
 *
 * The UI only ever depends on these types and on the two functions exported from
 * `src/engine/index.ts` — analyzeSupportIssue() and analyzeSupportTrends(). A
 * deterministic rules engine implements them today; an LLM-backed engine can
 * implement the same `SupportEngine` interface later without UI changes.
 */

export type CategoryId =
  | 'auth'
  | 'live'
  | 'payments'
  | 'events'
  | 'notifications'
  | 'members'
  | 'spaces'
  | 'email'
  | 'mobile'
  | 'api'
  | 'account'
  | 'other';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type EscalationLevel = 'none' | 'first_line' | 'specialist' | 'engineering';

/**
 * Where a piece of information comes from.
 *  - fact:           supported by public Circle documentation (with a link)
 *  - recommendation: this prototype's suggested support action
 *  - demo:           synthetic data created for this prototype
 */
export type Provenance = 'fact' | 'recommendation' | 'demo';

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export interface KBArticle {
  id: string;
  title: string;
  /** Public help.circle.so URL discovered via search — never constructed by hand. */
  url: string;
  /** Search-engine result excerpt ('' when only boilerplate was available). */
  snippet: string;
  section: string;
  category: CategoryId;
  categories: CategoryId[];
  /** Section landing page rather than a single article. */
  isOverview: boolean;
}

export interface KnowledgeBase {
  source: string;
  retrievedVia: string;
  retrievedAt: string;
  articles: KBArticle[];
}

// ---------------------------------------------------------------------------
// Issue analysis
// ---------------------------------------------------------------------------

export interface SupportIssueInput {
  /** Free-text description of the customer's problem. */
  text: string;
  /** Optional first name used to personalise the draft response. */
  customerName?: string;
  /** Optional name signed on the draft response. */
  agentName?: string;
}

export interface TroubleshootingStep {
  text: string;
  /**
   * 'doc'      — the step restates something visible in a public Circle article (sourceUrl set)
   * 'practice' — general support practice suggested by this prototype
   */
  basis: 'doc' | 'practice';
  sourceUrl?: string;
  sourceTitle?: string;
}

export interface SourceMatch {
  article: KBArticle;
  /** Relative relevance score (0–1) — useful for ordering, not a probability. */
  relevance: number;
  matchedTerms: string[];
  pinned: boolean;
}

export interface SupportSignals {
  multipleUsers: boolean;
  regression: boolean;
  errorOrDefect: boolean;
  billingRisk: boolean;
  dataOrPrivacy: boolean;
  urgent: boolean;
  totalBlocker: boolean;
  howToQuestion: boolean;
  adminReporter: boolean;
  device?: string;
}

export interface SupportAnalysis {
  engine: string;
  input: SupportIssueInput;
  category: {
    id: CategoryId;
    label: string;
    confidence: 'high' | 'medium' | 'low';
    matchedTerms: string[];
  };
  alternatives: { id: CategoryId; label: string }[];
  /** Narrower problem type inside the category (e.g. "SSO login loop"). */
  problem: { id: string; label: string };
  severity: { level: Severity; reasons: string[] };
  summary: string;
  likelyAreas: string[];
  likelyCauses: string[];
  troubleshooting: TroubleshootingStep[];
  infoToCollect: string[];
  response: string;
  sources: SourceMatch[];
  escalation: {
    level: EscalationLevel;
    label: string;
    reasons: string[];
    escalateIf: string[];
  };
  signals: SupportSignals;
}

// ---------------------------------------------------------------------------
// Demo tickets & trends
// ---------------------------------------------------------------------------

export type TicketStatus = 'open' | 'pending' | 'resolved';

export interface DemoTicket {
  /** Always DEMO-### — these are synthetic scenarios, not Circle customer data. */
  id: string;
  subject: string;
  body: string;
  /** Fictional first name used only to personalise drafts. */
  customerName: string;
  /** Fictional community name. */
  community: string;
  reporterRole: 'admin' | 'member';
  category: CategoryId;
  severity: Severity;
  status: TicketStatus;
  createdAt: string; // ISO date
  channel: 'email' | 'chat' | 'in-app';
}

export interface CountRow<K extends string = string> {
  key: K;
  label: string;
  count: number;
  share: number;
}

export interface ProblemCluster {
  id: string;
  label: string;
  category: CategoryId;
  count: number;
  open: number;
  recent: number;
  ticketIds: string[];
}

export interface TrendingIssue {
  category: CategoryId;
  label: string;
  recent: number;
  previous: number;
  change: number;
  statement: string;
}

export interface ProactiveOpportunity {
  id: string;
  title: string;
  problem: string;
  evidence: string[];
  ticketIds: string[];
  action: string;
  impact: string;
  relatedDocs: KBArticle[];
}

export interface TrendReport {
  engine: string;
  datasetLabel: string;
  total: number;
  open: number;
  pending: number;
  resolved: number;
  range: { from: string; to: string };
  byCategory: CountRow<CategoryId>[];
  bySeverity: CountRow<Severity>[];
  byStatus: CountRow<TicketStatus>[];
  weekly: { weekStart: string; count: number }[];
  topProblems: ProblemCluster[];
  trending: TrendingIssue[];
  headline: string[];
  opportunities: ProactiveOpportunity[];
}

/** Anything that can play the reasoning role — rules today, an LLM later. */
export interface SupportEngine {
  name: string;
  analyzeSupportIssue(input: SupportIssueInput, knowledge: KnowledgeBase): Promise<SupportAnalysis>;
  analyzeSupportTrends(tickets: DemoTicket[], knowledge: KnowledgeBase): Promise<TrendReport>;
}
