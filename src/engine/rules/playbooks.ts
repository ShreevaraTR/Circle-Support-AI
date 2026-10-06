import type { CategoryId, Severity } from '../types';

/**
 * Support playbooks used by the rules engine.
 *
 * DATA-INTEGRITY RULES FOR THIS FILE
 *  - `doc` on a step is a URL path fragment that must resolve to an article in
 *    src/data/knowledge.json (enforced by tests). A doc-backed step may only restate
 *    what that article's public title/search excerpt says.
 *  - Every other step, cause and action is a prototype RECOMMENDATION based on
 *    general support practice. None of it describes Circle's internal procedures,
 *    policies or SLAs.
 */

export interface StepDef {
  text: string;
  /** URL path fragment of the public article this step restates. */
  doc?: string;
}

export interface Problem {
  id: string;
  category: CategoryId;
  label: string;
  /** Patterns that point at this specific problem inside its category. */
  patterns: RegExp[];
  /** Agent-facing one-line summary; `{who}` becomes "Member"/"Admin"/"Customer". */
  summary: string;
  likelyAreas: string[];
  likelyCauses: string[];
  steps: StepDef[];
  /** Customer-facing phrasing of the first things to try (kept short). */
  customerSteps: string[];
  /** Completes "I'm sorry you're …" / "Thanks for flagging that …". */
  ack: string;
  infoToCollect: string[];
  /** Public articles to surface first (URL path fragments). */
  docs: string[];
  baseSeverity: Severity;
  /** Where this problem goes if first-line troubleshooting doesn't resolve it. */
  escalationPath: 'specialist' | 'engineering';
  escalateIf: string[];
  /** Proactive recommendation used by the trends analysis. */
  proactive: { action: string; impact: string };
}

const GENERAL_INFO = [
  'Community URL and the affected member’s email',
  'Device, OS and browser/app version',
  'Approximate time the issue occurred (with time zone)',
  'Screenshot or short screen recording of what they see',
];

export const PROBLEMS: Problem[] = [
  // -------------------------------------------------------------------------
  // Authentication / SSO
  // -------------------------------------------------------------------------
  {
    id: 'auth-sso-access',
    category: 'auth',
    label: 'SSO login / access after sign-in',
    patterns: [/\bsso\b|single sign/i, /\b(oauth|oidc|okta|auth0|wordpress|memberful|memberstack|outseta|teachable|bubble)\b/i, /after (logging|signing) in|redirect/i],
    summary: '{who} cannot get into the community through SSO',
    likelyAreas: ['SSO provider configuration', 'Member record / email match', 'Browser session'],
    likelyCauses: [
      'The identity provider configuration doesn’t match what the community expects (e.g. an OIDC-only setup)',
      'The member’s email in the SSO provider differs from the email on their community account',
      'A stale browser session or blocked cookies interrupting the redirect',
    ],
    steps: [
      { text: 'Confirm whether the issue affects one member or everyone signing in through SSO.' },
      { text: 'Public docs state Circle supports single sign-on via OAuth 2.0 — confirm which provider and protocol the community uses.', doc: 'sso/set-up-custom-sso' },
      { text: 'Public docs note Circle’s OAuth flow does not support JWTs, which causes errors with OIDC platforms layered on OAuth 2.0 — check whether the provider is OIDC-based.', doc: 'implementing-sso-using-oidc' },
      { text: 'For WordPress SSO, the public troubleshooting article says the settings page should have “OAuth Server Enabled” checked.', doc: 'troubleshoot-your-wordpress-sso-integration' },
      { text: 'Compare the email in the SSO provider with the member’s community account email; in SSO communities, public docs say email changes are made on the SSO provider.', doc: 'change-your-circle-account-email' },
      { text: 'Ask the member to retry in a private/incognito window to rule out a stale session.' },
    ],
    customerSteps: [
      'Try signing in again from a private/incognito browser window',
      'Confirm the email address you use with your login provider is the same one you use for the community',
    ],
    ack: 'you’re having trouble getting into the community after signing in',
    infoToCollect: ['Which SSO provider the community uses', 'Whether all SSO users or only some are affected', 'Exact error message or the URL they end up on', ...GENERAL_INFO.slice(0, 2)],
    docs: ['sso/set-up-custom-sso', 'implementing-sso-using-oidc', 'troubleshoot-your-wordpress-sso-integration', 'onboarding-members-to-your-sso-enabled-community', 'p/sso-and-integrations/sso/auto-login'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['All SSO users are blocked', 'Configuration matches the public setup guide but sign-in still fails', 'Errors appear on the Circle side of the redirect'],
    proactive: {
      action: 'Create an SSO troubleshooting macro (provider, protocol, email match, incognito retry) and link the public SSO setup articles in the first response.',
      impact: 'Shortens time-to-first-useful-response on the largest ticket group in the synthetic dataset.',
    },
  },
  {
    id: 'auth-login-loop',
    category: 'auth',
    label: 'Login loop / “nothing happens” (cookies)',
    patterns: [/loop|nothing happens|keeps? (taking|sending|bringing) me back|stuck/i, /safari|cookies?/i, /embed|iframe/i],
    summary: '{who} enters credentials but is returned to the login screen',
    likelyAreas: ['Browser privacy settings', 'Embedded community', 'Saved credentials'],
    likelyCauses: [
      'Browser privacy settings blocking the cookies needed during login (commonly Safari)',
      'Community embedded in another site, where third-party cookies are restricted',
    ],
    steps: [
      { text: 'Ask which browser and device the member is using, and whether the community is embedded on another website.' },
      { text: 'Public docs describe this “stuck in a loop” pattern and attribute it to Safari’s “Block all cookies” and “Prevent cross-site tracking” settings — walk the member through checking them.', doc: 'fixing-3rd-party-cookie-login-issues' },
      { text: 'Ask the member to try a different browser to confirm it is browser-specific.' },
    ],
    customerSteps: [
      'If you’re using Safari, check Settings → Safari and see whether “Block All Cookies” or “Prevent Cross-Site Tracking” is turned on',
      'Try signing in from a different browser (for example Chrome or Firefox)',
    ],
    ack: 'you’re getting sent back to the login screen',
    infoToCollect: ['Browser and version', 'Whether the community is embedded on another site', 'Whether another browser works'],
    docs: ['fixing-3rd-party-cookie-login-issues', 'trouble-logging-in'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['Loop persists in multiple browsers with default privacy settings', 'Several members report it at the same time'],
    proactive: {
      action: 'Add the public 3rd-party-cookie article to the login macro and suggest communities with embeds mention it in their onboarding.',
      impact: 'Removes a repeat “try another browser” back-and-forth.',
    },
  },
  {
    id: 'auth-verification-code',
    category: 'auth',
    label: 'Verification code not received',
    patterns: [/verification code|\bcode\b|\botp\b|one[- ]time/i],
    summary: '{who} isn’t receiving the sign-in verification code',
    likelyAreas: ['Email delivery', 'Account email', 'Mobile app sign-in'],
    likelyCauses: ['Signing in with an email that isn’t the one registered on the community', 'Mailbox filtering, a full mailbox, or domain-level blocking'],
    steps: [
      { text: 'Public docs advise confirming the member is using the email registered with their community account.', doc: 'verification-code-email-delivery' },
      { text: 'Per the same public article, ask the member to add no-reply@auth.circle.so, no-reply@circle.so and no-reply@notification.circle.so as contacts, check mailbox storage, and then retry.', doc: 'verification-code-email-delivery' },
      { text: 'Check spam/junk and any corporate email filtering.' },
    ],
    customerSteps: [
      'Double-check you’re signing in with the same email address you joined the community with',
      'Add no-reply@auth.circle.so, no-reply@circle.so and no-reply@notification.circle.so to your contacts, check your spam folder, then request a new code',
    ],
    ack: 'your sign-in code isn’t arriving',
    infoToCollect: ['Email address used to sign in', 'Email provider (e.g. Gmail, Outlook, company domain)', 'Whether the code is requested from the app or web'],
    docs: ['verification-code-email-delivery', 'trouble-logging-in'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['Codes fail for many members on the same email domain', 'Codes still don’t arrive after allow-listing the senders'],
    proactive: {
      action: 'Turn the public verification-code article into a saved reply and suggest admins share the sender addresses in their welcome message.',
      impact: 'Many of these tickets can be answered with one documented checklist.',
    },
  },
  {
    id: 'auth-password',
    category: 'auth',
    label: 'Password / credential issues',
    patterns: [/password|reset link|forgot|wrong credentials|incorrect (email|password)|locked out/i],
    summary: '{who} can’t sign in with their email and password',
    likelyAreas: ['Saved credentials', 'Password reset', 'Account email'],
    likelyCauses: ['Browser auto-filling out-of-date saved credentials', 'Signing in with a different email than the one on the account'],
    steps: [
      { text: 'Public docs note saved credentials can auto-fill out-of-date information — ask the member to type their email and password manually.', doc: 'trouble-logging-in' },
      { text: 'Confirm the email address on the account and offer the password-change steps from the public article.', doc: 'change-your-account-password' },
      { text: 'If the member is fully locked out, point them to the public “locked out” article, which describes a support form if the tips don’t work.', doc: 'locked-out-of-a-community' },
    ],
    customerSteps: ['Type your email and password in manually rather than using a saved/auto-filled login', 'Use the “Forgot password” option to set a new password'],
    ack: 'you’re having trouble signing in',
    infoToCollect: ['Email address they’re signing in with', 'Exact error message', 'Whether the reset email arrives'],
    docs: ['trouble-logging-in', 'change-your-account-password', 'locked-out-of-a-community'],
    baseSeverity: 'low',
    escalationPath: 'specialist',
    escalateIf: ['The account owner/admin is locked out', 'Reset emails don’t arrive after spam/allow-list checks'],
    proactive: {
      action: 'Add a “type it manually” tip and the public locked-out article to the login macro.',
      impact: 'Resolves simple credential tickets in one reply.',
    },
  },

  // -------------------------------------------------------------------------
  // Live streams
  // -------------------------------------------------------------------------
  {
    id: 'live-join',
    category: 'live',
    label: 'Can’t join / see a live stream',
    patterns: [/join|can'?t (see|find|enter|get in)|button|access|link|(not|isn'?t|doesn'?t) (show|showing|appear|appearing)|missing/i, /loading|stuck|nothing happens/i],
    summary: '{who} cannot join a live stream',
    likelyAreas: ['Access / invitation', 'Session state', 'Device / app'],
    likelyCauses: [
      'The member isn’t in the space or attendee list the session was shared with',
      'The session hasn’t started yet or has already ended',
      'A device, app version or browser issue on the member’s side',
    ],
    steps: [
      { text: 'Confirm the member has access to the space (or event) the live stream is attached to.' },
      { text: 'Confirm the live stream was actually live at the time they tried to join.' },
      { text: 'Public docs say members can join a live stream from desktop, a mobile browser, or the Circle iOS and Android apps — ask them to try another of these.', doc: 'members/live-and-events/join-a-live-stream' },
      { text: 'Check whether the member was on the invited attendee list; the public visibility article explains how private stream links behave with the “Disable live link sharing” option.', doc: 'visibility-options-for-instant-live-sessions' },
      { text: 'If it still fails, collect device/app version details and a screenshot before escalating.' },
    ],
    customerSteps: ['Make sure the app is updated to the latest version, then reopen it', 'Try joining from a desktop or mobile browser instead of the app (or vice versa)'],
    ack: 'you’re having trouble joining the live stream',
    infoToCollect: ['Space or event the stream belongs to', 'Device and app version', 'Screenshot of the screen where the Join option is missing', 'Time they tried to join (with time zone)'],
    docs: ['members/live-and-events/join-a-live-stream', 'visibility-options-for-instant-live-sessions', 'circle-live-overview'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['The member has access and the stream is live, but the Join option is missing on a supported device', 'Multiple members report the same problem for the same session'],
    proactive: {
      action: 'Publish a pre-event checklist for hosts and members: supported ways to join, access requirements, and the first troubleshooting steps — and link the public “Join a live stream” article.',
      impact: 'Live sessions are time-sensitive; preventing the ticket matters more than answering it.',
    },
  },
  {
    id: 'live-av',
    category: 'live',
    label: 'Audio / video problems in live sessions',
    patterns: [/audio|video|camera|microphone|\bmic\b|can'?t hear|no sound|black screen|echo|frozen|lag/i],
    summary: '{who} has audio or video problems during a live session',
    likelyAreas: ['Device permissions', 'Network', 'Browser / app'],
    likelyCauses: ['Camera/microphone permission not granted to the app or browser', 'Network instability', 'Another app holding the camera/microphone'],
    steps: [
      { text: 'Public docs walk through checking camera/microphone permissions — on iOS under Settings → Privacy & Security, on Android under the app’s Permissions.', doc: 'troubleshooting-audio-and-video-issues' },
      { text: 'Ask the member to close other apps that may be using the camera or microphone and rejoin.' },
      { text: 'Ask whether others in the same session were affected (host-side vs. member-side issue).' },
    ],
    customerSteps: ['Check that the app (or your browser) has permission to use your camera and microphone in your device settings', 'Close any other apps that might be using the camera or mic, then rejoin'],
    ack: 'you ran into audio/video problems during the session',
    infoToCollect: ['Device, OS and app/browser version', 'Whether they were host, co-host or viewer', 'Whether other participants were affected'],
    docs: ['troubleshooting-audio-and-video-issues', 'participate-in-the-live-stream'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['Permissions are correct and the issue reproduces on another device', 'Several participants in the same session were affected'],
    proactive: {
      action: 'Link the public audio/video troubleshooting article in event reminder content and the live-stream macro.',
      impact: 'Members can self-serve permission fixes before the session starts.',
    },
  },
  {
    id: 'live-ended',
    category: 'live',
    label: 'Stream ended / recording / limits',
    patterns: [/ended|cut off|stopped|disconnect|limit|recording|duration|hours?/i],
    summary: '{who} reports a live session ending unexpectedly or a recording/limit question',
    likelyAreas: ['Plan live limits', 'Session duration', 'Recording'],
    likelyCauses: ['The session reached a documented live limit (e.g. maximum duration)', 'Host connection dropped'],
    steps: [
      { text: 'Public docs state live streams have a maximum duration of 8 hours — check how long the session ran.', doc: 'live-limits-of-your-community-plan' },
      { text: 'Review the community’s live limits on the public “Understanding Circle live limits” article with the admin.', doc: 'live-limits-of-your-community-plan' },
      { text: 'Ask whether the host’s connection dropped at the time the session ended.' },
    ],
    customerSteps: ['Let us know roughly how long the session had been running when it ended', 'Share the date and start time of the session so we can look into it'],
    ack: 'your live session didn’t go as planned',
    infoToCollect: ['Session date, start time and approximate end time', 'Host device and connection', 'Community plan (for limits)'],
    docs: ['live-limits-of-your-community-plan', 'utilizing-the-live-dashboard'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['The session ended well short of documented limits', 'A recording is missing for a completed session'],
    proactive: {
      action: 'Add live-limit information to the host preparation checklist.',
      impact: 'Avoids surprises during long sessions.',
    },
  },

  // -------------------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------------------
  {
    id: 'payments-access-after-payment',
    category: 'payments',
    label: 'Paid but no access',
    patterns: [/(paid|purchased|bought|payment went through).*(no|not|can'?t|without) (access|see|get in)|no access after|charged but/i],
    summary: '{who} paid but doesn’t have access to the paywalled content',
    likelyAreas: ['Paywall configuration', 'Checkout / account email', 'Space access'],
    likelyCauses: ['The purchase was made with a different email than the member’s account', 'The paywall isn’t connected to the space the member expects'],
    steps: [
      { text: 'Locate the transaction; public docs say a successful payment shows a “paid” status (a free trial shows a $0 paid transaction).', doc: 'view-all-member-transactions' },
      { text: 'Compare the checkout email with the member’s account email.' },
      { text: 'Check which spaces the paywall grants and the member’s Access tab, which public docs say shows spaces granted via access groups and manual grants.', doc: 'managing-member-s-access-to-spaces-from-their-account' },
    ],
    customerSteps: ['Confirm the email address you used at checkout', 'Send the receipt or the last 4 digits of the card used so we can find the payment'],
    ack: 'you paid but still can’t access the content',
    infoToCollect: ['Checkout email and date of purchase', 'Paywall / plan purchased', 'Receipt or transaction ID'],
    docs: ['view-all-member-transactions', 'understanding-the-paywall-checkout-flow', 'managing-member-s-access-to-spaces-from-their-account'],
    baseSeverity: 'high',
    escalationPath: 'specialist',
    escalateIf: ['Payment shows as paid and the paywall is correctly connected but access isn’t granted'],
    proactive: {
      action: 'Add a “confirm checkout email” prompt to the paywall-access macro.',
      impact: 'Paying members without access is high-impact for community owners.',
    },
  },
  {
    id: 'payments-refund',
    category: 'payments',
    label: 'Refunds / double charges',
    patterns: [/refund|charged twice|double charged|duplicate charge|overcharg|money back/i],
    summary: '{who} is requesting a refund or reports an unexpected charge',
    likelyAreas: ['Paywall transactions', 'Stripe', 'Subscription changes'],
    likelyCauses: ['Duplicate checkout attempts', 'Proration after a subscription change', 'Confusion between a community’s paywall charge and another charge'],
    steps: [
      { text: 'Identify who should action the refund: member payments are managed by the community admin through their paywall/Stripe setup.' },
      { text: 'Public docs note that refunds issued directly through the Stripe dashboard don’t refund Circle’s transaction fees — point the admin to the documented refund steps.', doc: 'cancel-member-subscriptions' },
      { text: 'If a plan was changed, check proration: public docs say proration credits are not automatically refunded immediately and are applied toward the member’s payment.', doc: 'prorated-charges-and-credits' },
    ],
    customerSteps: ['Share the date and amount of each charge you’re seeing', 'Let us know whether you recently changed or upgraded your plan'],
    ack: 'you’ve been charged in a way you didn’t expect',
    infoToCollect: ['Date and amount of each charge', 'Paywall / plan', 'Whether a plan change happened recently'],
    docs: ['refund-member-payments', 'cancel-member-subscriptions', 'prorated-charges-and-credits', 'view-all-member-transactions'],
    baseSeverity: 'high',
    escalationPath: 'specialist',
    escalateIf: ['A duplicate charge is confirmed', 'Refund amounts or fees are disputed'],
    proactive: {
      action: 'Create a refund decision tree for agents (admin-actioned vs. platform question) linked to the public refund and proration articles.',
      impact: 'Money questions need a correct first answer — avoids promising refunds the agent can’t make.',
    },
  },
  {
    id: 'payments-failed',
    category: 'payments',
    label: 'Failed payments / cancellations',
    patterns: [/fail(ed|ing)? payment|declined|card|retry|past due|cancel(l)?(ed|ing|ation)? (my |their )?(subscription|membership)|canceled automatically/i],
    summary: '{who} reports a failed payment or unexpected subscription cancellation',
    likelyAreas: ['Stripe failed-payment settings', 'Card issuer', 'Subscription state'],
    likelyCauses: ['Card declined by the issuer', 'Stripe retry/cancellation settings ended the subscription'],
    steps: [
      { text: 'Public docs explain Stripe’s failed-payment configuration controls retry frequency, how long before cancelling, and which emails customers receive — review it with the admin.', doc: 'automatically-remove-member-s-paywall-access' },
      { text: 'Point the admin to the public article on the cancellation process for failed payments.', doc: 'understanding-the-cancellation-process-for-failed-payments' },
      { text: 'For a member wanting to cancel: public docs note that, depending on the admin’s settings, members may need to contact the admin to cancel.', doc: 'manage-your-membership-subscriptions' },
    ],
    customerSteps: ['Check with your bank whether the payment was blocked', 'Confirm the card on file is still valid'],
    ack: 'there’s been a problem with your payment',
    infoToCollect: ['Date of the failed charge', 'Subscription / paywall name', 'Whether the member was notified'],
    docs: ['understanding-the-cancellation-process-for-failed-payments', 'automatically-remove-member-s-paywall-access', 'manage-your-membership-subscriptions'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['Payments fail for many members at once', 'Stripe shows success but the community shows failure'],
    proactive: {
      action: 'Suggest admins review the public Stripe failed-payment settings article during paywall setup.',
      impact: 'Prevents involuntary churn tickets.',
    },
  },
  {
    id: 'payments-stripe-setup',
    category: 'payments',
    label: 'Stripe connection / payouts',
    patterns: [/stripe (account|connect)|payout|connect stripe|tax/i],
    summary: '{who} has a question about Stripe connection or payouts',
    likelyAreas: ['Stripe account', 'Paywall setup'],
    likelyCauses: ['Stripe account not fully connected or verified', 'Payout schedule questions that Stripe owns'],
    steps: [
      { text: 'Walk the admin through the public “Connect a Stripe account for paywalls” article.', doc: 'connect-a-stripe-account-for-paywalls' },
      { text: 'For payout timing, share the public “Receiving Stripe payouts” article and clarify which questions Stripe support owns.', doc: 'receiving-stripe-payouts' },
    ],
    customerSteps: ['Confirm whether your Stripe account shows as connected in your paywall settings', 'Share any message Stripe has shown you'],
    ack: 'you’re running into trouble with your Stripe setup',
    infoToCollect: ['Stripe connection status', 'Any Stripe dashboard notices', 'Paywall affected'],
    docs: ['connect-a-stripe-account-for-paywalls', 'receiving-stripe-payouts'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['Stripe shows connected but paywalls don’t work'],
    proactive: { action: 'Add Stripe setup verification to the paywall onboarding checklist.', impact: 'Fewer launch-day payment issues.' },
  },

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  {
    id: 'events-timezone',
    category: 'events',
    label: 'Event time zone confusion',
    patterns: [/time ?zone|wrong time|daylight|dst|hour (early|late|off)|showing .* time/i],
    summary: '{who} sees an event at the wrong time',
    likelyAreas: ['Event time zone', 'Recurring events', 'Member profile time zone'],
    likelyCauses: ['Daylight saving time shifting a recurring series', 'Member’s device/profile time zone differs from the host’s'],
    steps: [
      { text: 'Confirm the event’s configured time zone and the member’s time zone.' },
      { text: 'For recurring events crossing a daylight-saving change, public docs suggest two separate series (before/after) if you want to avoid the automatic time adjustment.', doc: 'understanding-time-zones-for-events' },
    ],
    customerSteps: ['Let us know which time zone you’re in and the time you’re seeing for the event', 'Share the event link so we can compare it with the host’s settings'],
    ack: 'the event is showing at an unexpected time',
    infoToCollect: ['Event link', 'Host time zone', 'Member time zone', 'Whether the event is recurring'],
    docs: ['understanding-time-zones-for-events', 'create-recurring-events'],
    baseSeverity: 'low',
    escalationPath: 'engineering',
    escalateIf: ['Time zones are configured correctly but times still display incorrectly'],
    proactive: {
      action: 'Before daylight-saving changes, remind admins of the public time-zone guidance for recurring events.',
      impact: 'Especially relevant for APAC communities spanning many time zones.',
    },
  },
  {
    id: 'events-reminders',
    category: 'events',
    label: 'Event reminders / calendar invites',
    patterns: [/reminder|calendar invite|\.ics|confirmation email|didn'?t get (the )?(invite|email)/i],
    summary: '{who} didn’t receive event reminders or calendar invites',
    likelyAreas: ['Event notifications', 'RSVP status', 'Email delivery'],
    likelyCauses: ['Member didn’t complete the RSVP', 'Reminders configured for a different audience', 'Email filtering'],
    steps: [
      { text: 'Public docs say members who RSVP or accept an invitation receive a confirmation email with event details and a calendar invite — check the member’s RSVP status.', doc: 'understanding-event-notifications' },
      { text: 'Review the event’s custom reminder audience (public docs describe options such as reminding attendees marked “Going”).', doc: 'set-up-custom-event-reminders' },
      { text: 'Check spam/junk folders and notification preferences.' },
    ],
    customerSteps: ['Check that your RSVP shows as “Going” on the event page', 'Look in your spam or promotions folder for the confirmation email'],
    ack: 'you didn’t get the event reminder',
    infoToCollect: ['Event link', 'Member email', 'RSVP status'],
    docs: ['understanding-event-notifications', 'set-up-custom-event-reminders'],
    baseSeverity: 'low',
    escalationPath: 'engineering',
    escalateIf: ['RSVPed members on multiple email providers receive nothing'],
    proactive: { action: 'Share the public event-notifications article in the event-setup macro.', impact: 'Clarifies who receives what, and when.' },
  },
  {
    id: 'events-rsvp',
    category: 'events',
    label: 'RSVP problems',
    patterns: [/rsvp|attendee|sold out|full|can'?t register/i],
    summary: '{who} can’t RSVP to an event',
    likelyAreas: ['RSVP limits', 'Space access', 'Event visibility'],
    likelyCauses: ['The event reached its RSVP limit', 'The member can’t access the event space'],
    steps: [
      { text: 'Check whether an RSVP limit is set — public docs describe the RSVP limit as controlling how many members can RSVP.', doc: 'limit-rsvps-for-events' },
      { text: 'Confirm the member has access to the space the event lives in.' },
    ],
    customerSteps: ['Share the event link and a screenshot of what you see when you try to RSVP'],
    ack: 'you’re having trouble RSVPing',
    infoToCollect: ['Event link', 'Screenshot', 'Member email'],
    docs: ['limit-rsvps-for-events', 'members/live-and-events/rsvp-and-attend-community-events'],
    baseSeverity: 'low',
    escalationPath: 'engineering',
    escalateIf: ['No RSVP limit is set and the member has access but RSVP fails'],
    proactive: { action: 'Add RSVP-limit visibility to the event troubleshooting macro.', impact: 'Quick self-check for admins.' },
  },

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  {
    id: 'notifications-not-received',
    category: 'notifications',
    label: 'Notifications not received',
    patterns: [/not (getting|receiving|arriving)|stopped|no (push|notif)|missing|don'?t get|delayed|late\b/i],
    summary: '{who} isn’t receiving notifications',
    likelyAreas: ['Notification preferences', 'Device push permissions', 'Email delivery'],
    likelyCauses: ['Notification preferences turned off for that activity', 'Push notifications disabled for the app at OS level', 'Emails filtered as spam'],
    steps: [
      { text: 'Review the member’s notification preferences using the public “Manage your notification preferences” article.', doc: 'audience/notifications/manage-your-notification-preferences' },
      { text: 'Public docs note that on the mobile apps, notification options are grouped by email, in-app and push.', doc: 'account-access-management/manage-your-notification-preferences' },
      { text: 'Ask the member to confirm notifications are allowed for the app in their device settings.' },
      { text: 'Check whether it’s a single member or many (possible delivery problem).' },
    ],
    customerSteps: ['Check your notification preferences in the community (email, in-app and push)', 'Make sure notifications are allowed for the app in your phone’s settings'],
    ack: 'notifications aren’t coming through',
    infoToCollect: ['Type of notification (push, email, in-app)', 'Device and app version', 'When notifications stopped'],
    docs: ['audience/notifications/manage-your-notification-preferences', 'account-access-management/manage-your-notification-preferences', 'understanding-community-notifications'],
    baseSeverity: 'low',
    escalationPath: 'engineering',
    escalateIf: ['Preferences and OS permissions are correct but nothing arrives', 'Many members stopped receiving notifications at the same time'],
    proactive: {
      action: 'Publish a short member-facing “not getting notifications?” checklist (preferences → device permissions → spam) and link it from the welcome flow.',
      impact: 'Most notification tickets are settings-related and self-serviceable.',
    },
  },
  {
    id: 'notifications-too-many',
    category: 'notifications',
    label: 'Too many notifications / digest',
    patterns: [/too many|spam(ming)?|overwhelm|digest|unsubscribe|turn off/i],
    summary: '{who} wants to reduce notifications or change the digest',
    likelyAreas: ['Notification preferences', 'Weekly digest', 'Default settings for new members'],
    likelyCauses: ['Default notification settings are broad for new members'],
    steps: [
      { text: 'Point the member to the public notification-preferences article.', doc: 'audience/notifications/manage-your-notification-preferences' },
      { text: 'For admins, share the public articles on the weekly digest and default notification settings for new members.', doc: 'setting-up-the-weekly-digest' },
    ],
    customerSteps: ['You can adjust which notifications you get from your notification preferences in the community'],
    ack: 'you’re getting more notifications than you’d like',
    infoToCollect: ['Which notifications are unwanted'],
    docs: ['audience/notifications/manage-your-notification-preferences', 'setting-up-the-weekly-digest', 'default-notification-settings-for-new-community-members'],
    baseSeverity: 'low',
    escalationPath: 'specialist',
    escalateIf: ['Notifications continue after being turned off'],
    proactive: { action: 'Suggest admins review default notification settings for new members.', impact: 'Reduces unsubscribe-driven churn.' },
  },

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------
  {
    id: 'members-invite',
    category: 'members',
    label: 'Invites not received / invite links',
    patterns: [/invit|onboard|didn'?t receive.*(invite|invitation)|invite link|bulk import|csv/i],
    summary: '{who} has a problem inviting or onboarding members',
    likelyAreas: ['Pending invites', 'Invite links', 'Email delivery'],
    likelyCauses: ['Invitation email filtered or sent to the wrong address', 'Expired or misconfigured invite link'],
    steps: [
      { text: 'Public docs: on the Manage audience page, open the Invited tab, use More actions next to the member and choose “Resend invitation”.', doc: 'viewing-and-resending-pending-member-invites' },
      { text: 'Alternatively, check the community’s invite link setup using the public article.', doc: 'p/audience/onboarding/set-up-an-invitation-link' },
      { text: 'Confirm the invited email address is correct and check spam/junk.' },
    ],
    customerSteps: ['Check your spam/junk folder for the invitation', 'Confirm the email address the invitation should go to'],
    ack: 'the invitation hasn’t come through',
    infoToCollect: ['Invited email address', 'Invite method (email invite, link, bulk import)', 'Date sent'],
    docs: ['viewing-and-resending-pending-member-invites', 'p/audience/onboarding/set-up-an-invitation-link', 'bulk-invite-members-to-your-community'],
    baseSeverity: 'low',
    escalationPath: 'specialist',
    escalateIf: ['Invites fail for many addresses at once'],
    proactive: { action: 'Add the public “Resend member invites” steps to the onboarding macro.', impact: 'Admins can self-serve the most common fix.' },
  },
  {
    id: 'members-remove',
    category: 'members',
    label: 'Removing / banning members',
    patterns: [/ban|remove|delete (a |the )?member|deactivat|kick|re-?register|came back/i],
    summary: '{who} needs help removing or banning a member',
    likelyAreas: ['Member management', 'Ban / deactivate options'],
    likelyCauses: ['Choosing between deactivate, delete and ban', 'A banned person re-registering'],
    steps: [
      { text: 'Share the public “Deactivate, delete, or ban members” article to explain the options.', doc: 'removing-members-from-your-community' },
      { text: 'Public docs warn that a banned member using a different, unblocked IP address can re-register with the same email — set expectations accordingly.', doc: 'removing-members-from-your-community' },
    ],
    customerSteps: ['Let us know whether you want to remove the member temporarily or permanently'],
    ack: 'you’re dealing with a difficult member situation',
    infoToCollect: ['Member profile link', 'Desired outcome (deactivate, delete, ban)'],
    docs: ['removing-members-from-your-community', 're-invite-a-deactivated-member'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['Safety or harassment concerns', 'Removal actions don’t take effect'],
    proactive: { action: 'Create a short “remove vs. deactivate vs. ban” comparison macro based on the public article.', impact: 'Faster answers to sensitive moderation questions.' },
  },
  {
    id: 'members-tags-groups',
    category: 'members',
    label: 'Member tags / access groups',
    patterns: [/tag|access group|segment|directory|profile field/i],
    summary: '{who} has a question about member tags or access groups',
    likelyAreas: ['Member tags', 'Access groups'],
    likelyCauses: ['Tag visibility or access-group configuration'],
    steps: [
      { text: 'Share the public member-tags article (it notes tags visible in the directory can be used as a filter by members).', doc: 'set-up-member-tags' },
      { text: 'For space access via groups, share the public access-groups overview.', doc: 'access-group-overview' },
    ],
    customerSteps: ['Share which tag or access group you’re working with and what you expected to happen'],
    ack: 'your member tags/access groups aren’t behaving as expected',
    infoToCollect: ['Tag or access group name', 'Expected vs. actual behaviour'],
    docs: ['set-up-member-tags', 'access-group-overview', 'before-using-access-groups'],
    baseSeverity: 'low',
    escalationPath: 'specialist',
    escalateIf: ['Configuration matches the docs but access is wrong'],
    proactive: { action: 'Link the access-groups FAQ in setup conversations.', impact: 'Prevents misconfiguration.' },
  },

  // -------------------------------------------------------------------------
  // Spaces
  // -------------------------------------------------------------------------
  {
    id: 'spaces-access',
    category: 'spaces',
    label: 'Member can’t see or access a space',
    patterns: [/can'?t (see|access|find|open)|missing|hidden|private|secret|visib/i],
    summary: '{who} cannot see or access a space',
    likelyAreas: ['Space visibility (open / private / secret)', 'Space membership', 'Access groups'],
    likelyCauses: ['The space is private or secret and the member hasn’t been added', 'The member isn’t in the access group or space group that grants it'],
    steps: [
      { text: 'Check the member’s Access tab — public docs say it shows which spaces they can access via access groups and manual grants.', doc: 'managing-member-s-access-to-spaces-from-their-account' },
      { text: 'Check the space’s access type; public docs note secret spaces cannot be made visible to visitors.', doc: 'managing-space-access-and-visibility' },
      { text: 'If the space sits in a space group, public docs say adding members to a group adds them to all its spaces, including private and secret ones.', doc: 'add-existing-members-to-spaces-or-space-groups' },
    ],
    customerSteps: ['Share the name of the space you’re trying to open', 'Let us know whether you can see it in the sidebar at all'],
    ack: 'you can’t get into that space',
    infoToCollect: ['Space name / URL', 'Member email', 'Space access type'],
    docs: ['managing-member-s-access-to-spaces-from-their-account', 'managing-space-access-and-visibility', 'add-existing-members-to-spaces-or-space-groups', 'auto-adding-members-to-spaces'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['Access tab shows the space but the member can’t open it'],
    proactive: {
      action: 'Create a “why can’t my member see this space?” diagnostic macro based on the public access articles.',
      impact: 'Turns a configuration back-and-forth into a single checklist.',
    },
  },

  // -------------------------------------------------------------------------
  // Email
  // -------------------------------------------------------------------------
  {
    id: 'email-delivery',
    category: 'email',
    label: 'Community emails not delivered',
    patterns: [/spam|junk|bounc|not (receiving|getting) (any )?emails?|deliver|from address|sender|dkim|spf|dmarc/i],
    summary: '{who} reports community emails not being delivered',
    likelyAreas: ['Sender / domain setup', 'Recipient filtering', 'Email preferences'],
    likelyCauses: ['Recipient mail server filtering', 'Branded/custom sender domain not fully configured'],
    steps: [
      { text: 'Determine whether the emails are notifications, digests, invites or marketing broadcasts.' },
      { text: 'For marketing emails, public docs strongly recommend a dedicated subdomain for a branded email domain to improve deliverability.', doc: 'branded-email-domain-for-marketing-emails' },
      { text: 'Share the public article on changing the “From” address for community notification emails if the admin has customised it.', doc: 'change-the-from-address-on-community-notification-emails' },
      { text: 'Ask affected recipients to check spam/junk and allow-list the sender.' },
    ],
    customerSteps: ['Check your spam/junk folder and mark the email as “not spam”', 'Add the community’s sender address to your contacts'],
    ack: 'community emails aren’t reaching your inbox',
    infoToCollect: ['Email type affected', 'Recipient email providers', 'Whether a custom sender domain is configured'],
    docs: ['branded-email-domain-for-marketing-emails', 'change-the-from-address-on-community-notification-emails', 'configure-email-settings'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['Emails fail across many providers', 'Domain records are correct but delivery fails'],
    proactive: { action: 'Add the branded-domain guidance to email-hub onboarding.', impact: 'Deliverability problems are cheaper to prevent than diagnose.' },
  },

  // -------------------------------------------------------------------------
  // Mobile
  // -------------------------------------------------------------------------
  {
    id: 'mobile-app-access',
    category: 'mobile',
    label: 'Mobile app sign-in / community switching',
    patterns: [/app|ios|android|iphone|switch(ing)? communit|can'?t find (my|the) community/i],
    summary: '{who} has trouble using the community in the mobile app',
    likelyAreas: ['App version', 'Account / community selection', 'Feature parity'],
    likelyCauses: ['Signed in with a different account email', 'Viewing a different community in the app', 'A feature that differs between desktop and mobile'],
    steps: [
      { text: 'Confirm the member has the latest app version (public download articles for iOS and Android).', doc: 'download-circle-communities-app-on-ios' },
      { text: 'Public docs say members of multiple communities can switch between them in the iOS and Android apps — check they’re in the right one.', doc: 'switching-between-communities-on-the-circle-mobile-app' },
      { text: 'Check the public desktop-vs-mobile features article in case the feature behaves differently on mobile.', doc: 'circle-features-desktop-vs-mobile-apps' },
    ],
    customerSteps: ['Update the app to the latest version from the App Store or Google Play', 'If you belong to more than one community, check you’ve switched to the right one in the app'],
    ack: 'the app isn’t working as expected',
    infoToCollect: ['Device model, OS and app version', 'Community URL', 'Screenshot'],
    docs: ['download-circle-communities-app-on-ios', 'download-circle-communities-app-on-android', 'switching-between-communities-on-the-circle-mobile-app', 'circle-features-desktop-vs-mobile-apps'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['App crashes or the issue reproduces on the latest version across devices'],
    proactive: { action: 'Share the public “Inform your members about Circle mobile apps” article with admins launching mobile.', impact: 'Sets correct expectations on mobile features.' },
  },
  {
    id: 'mobile-branded-app',
    category: 'mobile',
    label: 'Branded app questions',
    patterns: [/branded app|app store submission|developer account|in-app purchase/i],
    summary: '{who} has a branded-app question',
    likelyAreas: ['Branded app setup', 'App store submission'],
    likelyCauses: ['Submission prerequisites or developer account setup'],
    steps: [
      { text: 'Share the public “Get to know branded apps” and submission-preparation articles.', doc: 'get-to-know-branded-apps' },
      { text: 'Route account-specific branded-app questions to the appropriate specialist.' },
    ],
    customerSteps: ['Share where you are in the branded app setup process'],
    ack: 'you have questions about your branded app',
    infoToCollect: ['Setup stage', 'App store / developer account status'],
    docs: ['get-to-know-branded-apps', 'preparing-for-the-app-submission-process', 'setting-up-app-developer-accounts'],
    baseSeverity: 'low',
    escalationPath: 'specialist',
    escalateIf: ['Any account-specific branded-app request'],
    proactive: { action: 'Link the public submission-preparation article early in branded-app conversations.', impact: 'Avoids submission delays.' },
  },

  // -------------------------------------------------------------------------
  // API / Integrations
  // -------------------------------------------------------------------------
  {
    id: 'api-errors',
    category: 'api',
    label: 'API errors / tokens',
    patterns: [/\bapi\b|token|endpoint|401|403|429|500|rate limit|request/i],
    summary: '{who} is getting errors from the Circle API',
    likelyAreas: ['API token', 'Request format', 'Usage / limits'],
    likelyCauses: ['Invalid, expired or wrong-type token', 'Request not matching the API documentation', 'Usage limits'],
    steps: [
      { text: 'Ask for the endpoint, request (without secrets) and full error response.' },
      { text: 'Confirm the token is valid using the public token-management article.', doc: 'manage-api-tokens-and-whitelisted-domains' },
      { text: 'Check usage against the public “Monitor your API usage” article.', doc: 'monitor-your-api-usage' },
      { text: 'Compare the request against the official API documentation (linked from the public article).', doc: 'access-circle-api-documentation' },
    ],
    customerSteps: ['Share the endpoint you’re calling and the full error response (please don’t include your API token)', 'Confirm the token you’re using is still active'],
    ack: 'your API requests aren’t working',
    infoToCollect: ['Endpoint and HTTP method', 'Error status and response body (no secrets)', 'Timestamp of a failing request'],
    docs: ['manage-api-tokens-and-whitelisted-domains', 'monitor-your-api-usage', 'access-circle-api-documentation', 'create-an-api-token-in-your-community'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['Valid, well-formed requests return 5xx errors', 'Behaviour contradicts the API documentation'],
    proactive: { action: 'Create an API triage template (endpoint, method, status, timestamp — never the token).', impact: 'Gives engineering a reproducible report on the first escalation.' },
  },
  {
    id: 'api-zapier-webhooks',
    category: 'api',
    label: 'Zapier / webhooks / workflows',
    patterns: [/zapier|webhook|workflow|automation|integrately|make\.com|typeform|shopify/i],
    summary: '{who} has an integration or automation not running as expected',
    likelyAreas: ['Integration connection', 'Workflow configuration', 'Third-party service'],
    likelyCauses: ['Disconnected or expired integration connection', 'Workflow trigger or audience rules not matching'],
    steps: [
      { text: 'Check the connection using the public “Connect Zapier to your community” article.', doc: 'connect-zapier-to-your-community' },
      { text: 'For webhooks, review configuration with the public workflows-webhook article.', doc: 'configure-automation-workflows-to-send-webhooks' },
      { text: 'Confirm which trigger should fire and whether it fires for a test case.' },
    ],
    customerSteps: ['Share the name of the automation and the last time it ran successfully', 'Let us know which step is failing'],
    ack: 'your automation isn’t running as expected',
    infoToCollect: ['Integration name', 'Trigger and action', 'Last successful run'],
    docs: ['connect-zapier-to-your-community', 'configure-automation-workflows-to-send-webhooks', 'workflows-roadmap'],
    baseSeverity: 'medium',
    escalationPath: 'engineering',
    escalateIf: ['Triggers stop firing for a correctly configured workflow'],
    proactive: { action: 'Document a standard integration-triage checklist.', impact: 'Faster isolation of Circle vs. third-party issues.' },
  },

  // -------------------------------------------------------------------------
  // General account
  // -------------------------------------------------------------------------
  {
    id: 'account-domain',
    category: 'account',
    label: 'Custom domain setup',
    patterns: [/domain|cname|dns|subdomain|ssl|certificate/i],
    summary: '{who} has a custom domain issue',
    likelyAreas: ['DNS records', 'Domain configuration'],
    likelyCauses: ['DNS record not matching the values shown in the community’s domain settings', 'DNS propagation'],
    steps: [
      { text: 'Public docs: set up a CNAME record at the domain host, transferring the exact Host/Name and Target/Value from the community’s custom domain settings.', doc: 'set-up-a-custom-subdomain' },
      { text: 'For Cloudflare-hosted root domains, use the dedicated public article.', doc: 'custom-root-domain-hosted-by-cloudflare' },
      { text: 'Ask for a screenshot of the DNS record as configured.' },
    ],
    customerSteps: ['Send a screenshot of the DNS record you added at your domain provider', 'Confirm the values were copied exactly from your community’s domain settings'],
    ack: 'your custom domain isn’t working yet',
    infoToCollect: ['Domain', 'DNS provider', 'Screenshot of DNS records'],
    docs: ['set-up-a-custom-subdomain', 'set-up-a-custom-root-domain', 'custom-root-domain-hosted-by-cloudflare'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['DNS records are correct and propagated but the domain still doesn’t resolve'],
    proactive: { action: 'Add a DNS screenshot request to the domain macro.', impact: 'Removes a round-trip on almost every domain ticket.' },
  },
  {
    id: 'account-email-change',
    category: 'account',
    label: 'Account email / deactivation',
    patterns: [/change (my |the )?email|update (my )?email|deactivat|delete (my )?account|close (my )?account/i],
    summary: '{who} wants to change their account email or deactivate their account',
    likelyAreas: ['Account settings', 'SSO-managed accounts'],
    likelyCauses: ['Account is managed through SSO, so settings live with the SSO provider'],
    steps: [
      { text: 'Public docs: if the community uses SSO, the email can’t be updated in Circle and must be changed on the SSO provider.', doc: 'change-your-circle-account-email' },
      { text: 'Public docs: account deactivation is only available when signing in with a Circle email and password, not via SSO.', doc: 'deactivating-your-member-account' },
    ],
    customerSteps: ['Let us know whether you sign in with an email and password or through another login provider'],
    ack: 'you need to update your account',
    infoToCollect: ['Current account email', 'Login method (password or SSO)'],
    docs: ['change-your-circle-account-email', 'deactivating-your-member-account'],
    baseSeverity: 'low',
    escalationPath: 'specialist',
    escalateIf: ['Data deletion or privacy request'],
    proactive: { action: 'Add the SSO note to account-change macros.', impact: 'Prevents a common dead end.' },
  },
  {
    id: 'account-plan',
    category: 'account',
    label: 'Community plan / billing / ownership',
    patterns: [/cancel (our |my )?(community )?plan|downgrade|upgrade|owner|ownership|admin access|export/i],
    summary: '{who} has a community plan or ownership request',
    likelyAreas: ['Plan management', 'Account ownership', 'Data export'],
    likelyCauses: ['Account-level change that requires verification'],
    steps: [
      { text: 'Verify the requester is the community owner/admin before discussing account changes.' },
      { text: 'For cancellations, public docs say active member subscriptions must be cancelled (and refunds provided, if any) and that the Stripe business remains active.', doc: 'canceling-your-community-plan' },
      { text: 'For exports, share the public “Export your community data” article.', doc: 'export-your-community-data' },
    ],
    customerSteps: ['Confirm you’re the community owner or an admin', 'Let us know what change you’d like to make'],
    ack: 'you need help with your community plan',
    infoToCollect: ['Community URL', 'Requester role', 'Requested change'],
    docs: ['canceling-your-community-plan', 'export-your-community-data', 'p/administration/account'],
    baseSeverity: 'medium',
    escalationPath: 'specialist',
    escalateIf: ['Ownership transfer or billing dispute'],
    proactive: { action: 'Add an identity-verification step to account-change macros.', impact: 'Protects customers’ accounts.' },
  },
];

/** Fallback when no specific problem matches inside a category. */
export const GENERAL_PROBLEM: Omit<Problem, 'id' | 'category' | 'label' | 'docs'> = {
  patterns: [],
  summary: '{who} reports an issue that needs clarification',
  likelyAreas: ['Configuration', 'Account / access', 'Device / browser'],
  likelyCauses: ['Not enough detail yet to narrow the cause'],
  steps: [
    { text: 'Restate the problem back to the customer and confirm the expected vs. actual behaviour.' },
    { text: 'Ask whether it affects one person or several, and when it started.' },
    { text: 'Search the public Help Center for the feature involved (see knowledge sources).' },
    { text: 'Reproduce the issue if possible, on the same device type the customer uses.' },
  ],
  customerSteps: ['Describe what you expected to happen and what happened instead', 'Share a screenshot or short screen recording'],
  ack: 'you’ve run into this issue',
  infoToCollect: GENERAL_INFO,
  baseSeverity: 'low',
  escalationPath: 'specialist',
  escalateIf: ['The issue reproduces and isn’t covered by public documentation'],
  proactive: { action: 'Review whether a Help Center article exists for this topic.', impact: 'Closes documentation gaps.' },
};
