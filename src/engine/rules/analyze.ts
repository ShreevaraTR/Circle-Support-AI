import type {
  EscalationLevel,
  KnowledgeBase,
  Severity,
  SupportAnalysis,
  SupportIssueInput,
  SupportSignals,
  TroubleshootingStep,
} from '../types';
import { categoryLabel, classify, detectSignals } from './classify';
import { GENERAL_PROBLEM, type Problem } from './playbooks';
import { resolveDoc, retrieveSources } from './retrieve';

export const RULES_ENGINE_NAME = 'Rules engine v1 (deterministic)';

const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high', 'critical'];
const atLeast = (s: Severity, min: Severity): Severity =>
  SEVERITY_ORDER.indexOf(s) >= SEVERITY_ORDER.indexOf(min) ? s : min;
const bump = (s: Severity, cap: Severity = 'critical'): Severity =>
  SEVERITY_ORDER[Math.min(SEVERITY_ORDER.indexOf(s) + 1, SEVERITY_ORDER.indexOf(cap))];

export const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  none: 'No escalation',
  first_line: 'First-line troubleshooting',
  specialist: 'Escalate to specialist',
  engineering: 'Escalate to engineering',
};

function assessSeverity(base: Severity, s: SupportSignals): { level: Severity; reasons: string[] } {
  let level = base;
  const reasons: string[] = [`Typical impact for this problem type: ${base}`];
  if (s.howToQuestion && !s.totalBlocker) {
    return { level: 'low', reasons: ['Phrased as a how-to question with no reported failure'] };
  }
  if (s.totalBlocker) {
    level = atLeast(level, 'medium');
    reasons.push('Customer is fully blocked (cannot log in / access / join)');
  }
  if (s.billingRisk) {
    level = atLeast(level, 'high');
    reasons.push('Money is involved (charge, refund or failed payment)');
  }
  if (s.dataOrPrivacy) {
    level = atLeast(level, 'high');
    reasons.push('Possible data-loss, privacy or security concern');
  }
  if (s.multipleUsers) {
    level = atLeast(bump(level), 'high');
    reasons.push('Affects multiple people');
  }
  if (s.multipleUsers && (s.totalBlocker || s.errorOrDefect || s.dataOrPrivacy)) {
    level = 'critical';
    reasons.push('Multiple people blocked or seeing errors — possible incident');
  }
  if (s.urgent) {
    level = bump(level, s.multipleUsers ? 'critical' : 'high');
    reasons.push('Time-sensitive (live session, launch or explicit urgency)');
  }
  return { level, reasons };
}

function assessEscalation(problem: Problem, s: SupportSignals, specific: boolean, text: string): SupportAnalysis['escalation'] {
  const reasons: string[] = [];
  let level: EscalationLevel;

  if (/data loss|lost (all|our)|disappeared/i.test(text) || (s.dataOrPrivacy && s.errorOrDefect)) {
    level = 'engineering';
    reasons.push('Possible data loss or security defect — needs technical investigation, not workarounds.');
  } else if (s.dataOrPrivacy) {
    level = 'specialist';
    reasons.push('Privacy/security or data requests need a specialist and identity verification.');
  } else if (s.multipleUsers && (s.errorOrDefect || s.regression || s.totalBlocker)) {
    level = 'engineering';
    reasons.push('Several people are affected at once and it looks like a failure rather than a configuration question — this may indicate a product defect or incident.');
  } else if ((s.errorOrDefect && s.regression) || (s.errorOrDefect && problem.escalationPath === 'engineering' && s.multipleUsers)) {
    level = 'engineering';
    reasons.push('An error appeared on something that previously worked — this may indicate a product defect.');
  } else if (s.billingRisk) {
    level = 'specialist';
    reasons.push('Billing and refund questions should be handled by someone who can verify transactions; avoid promising outcomes in the first reply.');
  } else if (s.multipleUsers) {
    level = problem.escalationPath;
    reasons.push('Multiple people are affected, so a single-user workaround is not enough.');
  } else if (['account-plan', 'mobile-branded-app'].includes(problem.id)) {
    level = 'specialist';
    reasons.push('Account-level or branded-app requests usually need a specialist with account context.');
  } else if (s.howToQuestion) {
    level = 'none';
    reasons.push('This is a how-to question that public documentation can answer.');
  } else {
    level = 'first_line';
    reasons.push(
      specific
        ? 'Documented troubleshooting steps exist for this problem — try them before escalating.'
        : 'The issue isn’t specific enough yet — clarify and gather details first.',
    );
    if (s.errorOrDefect || s.regression) {
      reasons.push(`Signs of a possible defect (${s.errorOrDefect ? 'error reported' : 'previously worked'}) — escalate to ${problem.escalationPath} if the steps don’t resolve it.`);
    }
  }

  return {
    level,
    label: ESCALATION_LABELS[level],
    reasons,
    escalateIf: [
      ...problem.escalateIf,
      ...(level === 'first_line' || level === 'none' ? ['The documented troubleshooting steps don’t resolve it'] : []),
    ],
  };
}

function summarise(problem: Problem, text: string, s: SupportSignals): string {
  const who = /\bmembers?\b|\bstudents?\b|\battendees?\b/i.test(text) ? 'Member' : s.adminReporter ? 'Admin' : 'Customer';
  const summary = problem.summary.replace('{who}', who);
  const extras: string[] = [];
  if (s.multipleUsers) extras.push('affects multiple people');
  if (s.device) extras.push(`on ${s.device}`);
  if (s.regression) extras.push('previously worked');
  if (s.urgent) extras.push('time-sensitive');
  return extras.length ? `${summary} (${extras.join(', ')}).` : `${summary}.`;
}

function draftResponse(
  input: SupportIssueInput,
  problem: Problem,
  s: SupportSignals,
  level: EscalationLevel,
  topDoc: { title: string; url: string } | undefined,
): string {
  const name = input.customerName?.trim() || 'there';
  const lines: string[] = [`Hi ${name},`, ''];

  if (level === 'none') {
    lines.push('Thanks for your question — happy to point you in the right direction.');
  } else {
    lines.push(`Thanks for reaching out, and I’m sorry ${problem.ack}.`);
  }
  if (s.multipleUsers || s.urgent) {
    lines.push(
      s.multipleUsers
        ? 'I understand this is affecting several of your members, so I want to get this moving quickly.'
        : 'I understand the timing matters here, so let’s get straight to it.',
    );
  }
  lines.push('');

  if (problem.customerSteps.length) {
    lines.push(level === 'none' ? 'Here’s what I’d suggest:' : 'Could you try the following quick checks?');
    problem.customerSteps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push('');
  }
  if (topDoc) {
    lines.push(`This Help Center article covers it in more detail: ${topDoc.title} — ${topDoc.url}`);
    lines.push('');
  }

  if (level !== 'none') {
    lines.push(level === 'first_line' ? 'If that doesn’t solve it, could you reply with:' : 'To help us investigate, could you also reply with:');
    problem.infoToCollect.slice(0, 3).forEach((i) => lines.push(`• ${i}`));
    lines.push('');
  }

  const closings: Record<EscalationLevel, string> = {
    none: 'Let me know if anything is unclear — I’m happy to help further.',
    first_line: 'Once I have those details, I’ll take the next steps from there.',
    specialist: 'I’m also sharing this with a specialist on our team so we can look into it more closely. I’ll keep you updated here as soon as I have more information.',
    engineering: 'Because this may need a deeper technical investigation, I’m passing it to our technical team along with these details. I’ll keep you updated here, and we won’t consider this resolved until it’s confirmed working on your side.',
  };
  lines.push(closings[level], '', 'Best,', input.agentName?.trim() || '[Your name]');
  return lines.join('\n');
}

export function analyzeWithRules(input: SupportIssueInput, kb: KnowledgeBase): SupportAnalysis {
  const text = input.text.trim();
  const cls = classify(text);
  const signals = detectSignals(text);
  const specific = cls.problem !== null;
  const problem: Problem = cls.problem ?? {
    ...GENERAL_PROBLEM,
    id: `${cls.category}-general`,
    category: cls.category,
    label: `General ${categoryLabel(cls.category)} question`,
    docs: [],
  };

  const troubleshooting: TroubleshootingStep[] = problem.steps.map((step) => {
    const doc = step.doc ? resolveDoc(kb, step.doc) : undefined;
    return doc
      ? { text: step.text, basis: 'doc', sourceUrl: doc.url, sourceTitle: doc.title }
      : { text: step.text, basis: 'practice' };
  });

  const sources = retrieveSources(kb, text, cls.category, problem.docs);
  const severity = assessSeverity(problem.baseSeverity, signals);
  const escalation = assessEscalation(problem, signals, specific, text);
  const topDoc = sources[0]?.article;

  return {
    engine: RULES_ENGINE_NAME,
    input,
    category: {
      id: cls.category,
      label: categoryLabel(cls.category),
      confidence: cls.confidence,
      matchedTerms: cls.matchedTerms,
    },
    alternatives: cls.alternatives.map((id) => ({ id, label: categoryLabel(id) })),
    problem: { id: problem.id, label: problem.label },
    severity,
    summary: summarise(problem, text, signals),
    likelyAreas: problem.likelyAreas,
    likelyCauses: problem.likelyCauses,
    troubleshooting,
    infoToCollect: problem.infoToCollect,
    response: draftResponse(input, problem, signals, escalation.level, topDoc),
    sources,
    escalation,
    signals,
  };
}
