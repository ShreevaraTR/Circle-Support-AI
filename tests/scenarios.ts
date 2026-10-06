import type { CategoryId, EscalationLevel, Severity } from '../src/engine/types';

/** Copilot scenarios used by the engine tests and the UI smoke tests. */
export const SCENARIOS: {
  name: string;
  text: string;
  customerName?: string;
  category: CategoryId;
  problem?: string;
  escalation: EscalationLevel;
  severity: Severity;
  mustCite?: string;
}[] = [
  {
    name: 'live stream join on mobile',
    text: "A member says they can't join our live stream. They're using the mobile app and the Join button isn't appearing.",
    customerName: 'Sarah',
    category: 'live',
    problem: 'live-join',
    escalation: 'first_line',
    severity: 'medium',
    mustCite: '/join-a-live-stream',
  },
  {
    name: 'SSO outage affecting everyone',
    text: 'Since this morning none of our members can log in through our WordPress SSO — they get an error after signing in. It worked fine yesterday.',
    category: 'auth',
    problem: 'auth-sso-access',
    escalation: 'engineering',
    severity: 'critical',
    mustCite: 'troubleshoot-your-wordpress-sso-integration',
  },
  {
    name: 'double charge refund',
    text: 'A member was charged twice for their annual membership and is asking for a refund of the duplicate charge.',
    category: 'payments',
    problem: 'payments-refund',
    escalation: 'specialist',
    severity: 'high',
    mustCite: 'refund-member-payments',
  },
  {
    name: 'how-to resend invite',
    text: 'How do I resend an invitation to a member who says they never received it?',
    category: 'members',
    problem: 'members-invite',
    escalation: 'none',
    severity: 'low',
    mustCite: 'viewing-and-resending-pending-member-invites',
  },
  {
    name: 'Safari login loop',
    text: 'I enter my email and password on my iPhone in Safari and nothing happens — it keeps taking me back to the login page.',
    category: 'auth',
    problem: 'auth-login-loop',
    escalation: 'first_line',
    severity: 'medium',
    mustCite: 'fixing-3rd-party-cookie-login-issues',
  },
  {
    name: 'API 500s for multiple users',
    text: 'Our API requests to list members started returning 500 errors for all of our users this morning. Nothing changed on our side.',
    category: 'api',
    problem: 'api-errors',
    escalation: 'engineering',
    severity: 'critical',
    mustCite: 'access-circle-api-documentation',
  },
  {
    name: 'push notifications on Android',
    text: 'A member on Android is not receiving push notifications for new posts anymore.',
    category: 'notifications',
    problem: 'notifications-not-received',
    escalation: 'first_line',
    severity: 'low',
    mustCite: 'manage-your-notification-preferences',
  },
  {
    name: 'event time zone',
    text: 'Our recurring event shows the wrong time for members in Singapore after the daylight saving change.',
    category: 'events',
    problem: 'events-timezone',
    escalation: 'first_line',
    severity: 'low',
    mustCite: 'understanding-time-zones-for-events',
  },
];

/** An ask with no matching public documentation — the copilot must say so, not invent a source. */
export const UNDOCUMENTED = 'Can members print a certificate of completion from a course?';
