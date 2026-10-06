/**
 * Product-facing framing for recurring problem types, keyed by playbook problem id.
 *
 * DATA-INTEGRITY RULES FOR THIS FILE
 *  - `impact` only restates what the synthetic tickets describe (what members said they
 *    couldn't do). No business metrics, revenue, customer counts or real incidents.
 *  - `investigation` is a PROTOTYPE RECOMMENDATION — a question for Product/Engineering
 *    to look into, never a claim that a defect exists.
 */
export interface ProductFraming {
  /** Short signal name, e.g. "Live Stream join issues". */
  name: string;
  /** Engineering-friendly headline for the handoff title. */
  headline: string;
  /** Plain description of what the synthetic tickets report. */
  problem: string;
  /** What members in the synthetic tickets said they could not do. */
  impact: string;
  /** Suggested investigation for Product/Engineering (prototype recommendation). */
  investigation: string;
}

export const PRODUCT_FRAMING: Record<string, ProductFraming> = {
  'live-join': {
    headline: 'Members unable to join Live Streams',
    name: 'Live Stream join issues',
    problem: 'Members report they cannot join a live stream or live room — the Join option is missing, a link does not work, or the session does not load.',
    impact: 'Members in these tickets could not take part in a live session they were trying to attend.',
    investigation:
      'Investigate the live-stream join flow and check whether failures correlate with specific app, browser or device combinations. If no product defect is found, consider improving the join troubleshooting guidance and pre-event checklist.',
  },
  'auth-sso-access': {
    headline: 'Members unable to access the community after SSO sign-in',
    name: 'SSO sign-in access failures',
    problem: 'Members sign in through an SSO provider but do not end up inside the community (errors, access pages or redirect loops after sign-in).',
    impact: 'Members in these tickets could not get into the community after signing in.',
    investigation:
      'Review the SSO sign-in flow for the providers named in these tickets and check whether failures cluster around particular provider configurations or protocols. Consider clearer in-product error messages and setup validation for admins.',
  },
  'notifications-not-received': {
    headline: 'Members not receiving notifications',
    name: 'Notifications not arriving',
    problem: 'Members report push or email notifications not arriving, or arriving late.',
    impact: 'Members in these tickets were not alerted to new community activity when they expected to be.',
    investigation:
      'Check whether the reported delivery gaps correlate with platform (iOS / Android / email) or with a time window. If preferences and device settings explain most cases, consider surfacing notification-permission status more clearly to members.',
  },
  'spaces-access': {
    headline: 'Members unable to see or open expected spaces',
    name: 'Space access and visibility confusion',
    problem: 'Members cannot see or open a space that admins expect them to have access to.',
    impact: 'Members in these tickets could not reach content in a specific space.',
    investigation:
      'Review whether admins can easily see why a member does or does not have access to a space (e.g. visibility type, space-group or access-group membership) and whether behaviour differs between desktop and mobile.',
  },
  'auth-login-loop': {
    headline: 'Members stuck in a login loop',
    name: 'Login loop after entering credentials',
    problem: 'Members enter credentials and are returned to the login screen.',
    impact: 'Members in these tickets could not sign in from their usual browser.',
    investigation: 'Check whether loops correlate with browser privacy settings or embedded communities, and whether an in-product hint could point members to the documented fix.',
  },
  'auth-verification-code': {
    headline: 'Members not receiving sign-in verification codes',
    name: 'Verification codes not received',
    problem: 'Members do not receive sign-in verification codes.',
    impact: 'Members in these tickets could not complete sign-in.',
    investigation: 'Check whether missing codes cluster by email domain or provider, and whether the sign-in screen could link to the documented allow-list steps.',
  },
  'payments-access-after-payment': {
    headline: 'Members without access after paying',
    name: 'Paid but no access',
    problem: 'Members complete a payment but do not get access to the paywalled content.',
    impact: 'Members in these tickets paid but could not reach the content they paid for.',
    investigation: 'Review how checkout email and account email are matched and whether admins can see the paywall-to-space mapping clearly.',
  },
  'email-delivery': {
    headline: 'Community emails not reaching members',
    name: 'Community email delivery problems',
    problem: 'Community emails are reported as bouncing or landing in spam.',
    impact: 'Members in these tickets did not reliably receive community emails.',
    investigation: 'Check whether reports correlate with recent sender/domain changes and whether setup validation could flag misconfiguration earlier.',
  },
  'mobile-app-access': {
    headline: 'Members unable to use the community in the mobile app',
    name: 'Mobile app access problems',
    problem: 'Members have trouble using the community in the mobile app.',
    impact: 'Members in these tickets could not use the community on their phone as expected.',
    investigation: 'Check whether reports correlate with app version, OS or community switching.',
  },
};

export const genericFraming = (label: string): ProductFraming => ({
  name: label,
  headline: label,
  problem: `Several synthetic tickets describe the same problem type: ${label}.`,
  impact: 'Members in these tickets could not complete the task described in their ticket.',
  investigation: 'Review the supporting tickets for a shared cause and decide whether this needs product investigation or improved documentation.',
});
