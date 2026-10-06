import type { CategoryId } from './types';

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  auth: 'Authentication / SSO',
  live: 'Live Streams',
  payments: 'Payments',
  events: 'Events',
  notifications: 'Notifications',
  members: 'Members',
  spaces: 'Spaces',
  email: 'Email',
  mobile: 'Mobile',
  api: 'API / Integrations',
  account: 'General Account',
  other: 'Other',
};

export const CATEGORY_ORDER: CategoryId[] = [
  'auth',
  'live',
  'payments',
  'events',
  'notifications',
  'members',
  'spaces',
  'email',
  'mobile',
  'api',
  'account',
  'other',
];

/**
 * Keyword signals per category: [pattern, weight]. Deliberately small and readable —
 * a reviewer should be able to see exactly why an issue was classified the way it was.
 */
export const CATEGORY_TERMS: Record<CategoryId, [RegExp, number][]> = {
  auth: [
    [/\bsso\b|single sign[- ]on/i, 4],
    [/\b(log ?in|login|logging in|sign(ed|ing)? ?in|signin)\b/i, 3],
    [/\bpassword|reset link|magic link\b/i, 3],
    [/\b(oauth|oidc|saml|okta|auth0|jwt|memberful|memberstack|memberspace|outseta|teachable)\b/i, 4],
    [/verification code|\botp\b|2fa|two[- ]factor/i, 3],
    [/locked out|login loop|redirect(s|ed|ing)? (back|loop)|keeps? redirecting/i, 4],
    [/\bcookies?\b/i, 2],
  ],
  live: [
    [/live ?stream|livestream/i, 5],
    [/live room|go(ing)? live|live session|\bon air\b/i, 4],
    [/join (the |a |our )?live|live (stream|room) (link|button)/i, 3],
    [/\b(co-?host|backstage|webinar)\b/i, 3],
    [/\b(camera|microphone|\bmic\b|audio|webcam|screen ?share)\b/i, 2],
    [/\brecording\b/i, 2],
    [/\blive\b/i, 1],
  ],
  payments: [
    [/\b(paywall|payment|charged?|charges|refund|invoice|receipt)\b/i, 4],
    [/\bstripe|payout|checkout|coupon|discount code\b/i, 4],
    [/\b(subscription|billing|card (was )?declined|declined|trial|installment|prorat\w*)\b/i, 3],
    [/\b(price|pricing|paid|purchase|bought)\b/i, 3],
    [/\b(paid|purchased|bought)\b.*\b(no access|can'?t access|without access|still can'?t)/i, 4],
  ],
  events: [
    [/\bevents?\b/i, 3],
    [/\brsvp\w*\b/i, 4],
    [/time ?zone|calendar invite|\.ics|recurring|reminder/i, 3],
    [/\b(attendees?|webinar)\b/i, 2],
  ],
  notifications: [
    [/notification|notif\b|notifs?\b/i, 4],
    [/push (alert|message|notif)|\bpush\b|\bbadge\b/i, 3],
    [/\bdigest\b|\bmention(s|ed)?\b|\balerts?\b/i, 3],
    [/too many emails|unsubscribe/i, 2],
  ],
  members: [
    [/\binvit\w*/i, 3],
    [/\b(member tags?|tags?|access groups?|segments?)\b/i, 3],
    [/\b(ban(ned)?|deactivat\w*|remove (a )?member|delete (a )?member|kick)\b/i, 4],
    [/\b(bulk import|csv import|import members|member directory|onboarding)\b/i, 3],
    [/\bmembers?\b/i, 1],
  ],
  spaces: [
    [/\bspaces?\b|space group/i, 4],
    [/\b(private|secret|visible|visibility|hidden)\b/i, 2],
    [/\b(channel|course|lesson|chat space|post space)\b/i, 2],
  ],
  email: [
    [/\b(emails?|e-mail|inbox|spam|junk folder|bounc\w*|deliverab\w*)\b/i, 3],
    [/\b(dkim|spf|dmarc|sender|from address|broadcast|newsletter|email hub)\b/i, 4],
  ],
  mobile: [
    [/\b(mobile app|the app|app store|play store|testflight)\b/i, 3],
    [/\b(ios|iphone|ipad|android|pixel|samsung)\b/i, 3],
    [/\bbranded app\b/i, 4],
    [/\bmobile\b|\bphone\b|\btablet\b/i, 1],
    [/\b(crash(es|ed|ing)?|app store)\b/i, 2],
  ],
  api: [
    [/\bapi\b|endpoint|\btoken\b|rate limit/i, 4],
    [/\b(zapier|make\.com|integrately|webhooks?|integration|automation|workflows?)\b/i, 4],
    [/\b(401|403|404|429|500|502|503|json|curl|request fails?)\b/i, 3],
    [/\b(embed|iframe|javascript|script|developer)\b/i, 2],
  ],
  account: [
    [/custom domain|subdomain|\bcname\b|\bdns\b|domain/i, 4],
    [/\b(change (my )?email|account email|delete (my )?account|deactivate (my )?account|profile)\b/i, 3],
    [/\b(cancel (our|my)? ?(community )?plan|downgrade|upgrade (our|my) plan|admin access|transfer ownership|owner)\b/i, 3],
    [/\b(export|gdpr|data request|branding|theme)\b/i, 2],
  ],
  other: [],
};
