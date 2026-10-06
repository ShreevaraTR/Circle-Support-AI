# Circle Support Copilot

> **Portfolio prototype.** This is not an official Circle product and is not affiliated with or endorsed by Circle.
> It was built as part of an application for the **Customer Support Specialist (APAC)** role.

Circle Support Copilot is an internal-style tool for a support specialist. Its workflow:

```
Customer issue → Issue classification → Relevant Circle knowledge → Troubleshooting steps
             → Suggested customer response → Escalation recommendation → Support trend analysis
```

**The copilot does not replace the specialist.** It helps them understand the issue faster, find the right public documentation, write a better first reply, see patterns and decide when to escalate. Every output is labelled as a suggestion that needs human review.

## Features (V1)

| Area | What it does |
|---|---|
| **Support Copilot** | Classifies an issue into one of 12 categories and a narrower problem type. Assesses severity, lists likely causes and gives a troubleshooting checklist where each step is tagged *Doc-backed* (with a link) or *General practice*. Drafts an editable reply, cites public Help Center articles and recommends an escalation level. A "Why this classification?" panel shows the matched terms and signals. |
| **Support Trends** | Dashboard over 50 synthetic tickets: KPIs, top categories, weekly volume, open vs resolved, severity breakdown, trending issues (most recent 14 days vs the previous 14), most common problems, and **Proactive Support Opportunities** (problem → evidence with ticket IDs → recommended action). |
| **Product Feedback** | Turns recurring patterns from the *same* Support Trends analysis (3+ related synthetic tickets) into product signals: trend, severity, affected area, supporting `DEMO-###` tickets and a prototype investigation recommendation. **Generate Product Handoff** builds a 10-section report (title, problem, impact, evidence, pattern, what support tried, suggested investigation, priority, source, human review). **Copy for Slack / Copy for Jira / Copy report** only copy formatted text — there are no integrations. Reachable from the sidebar and from each Support Trends opportunity (**Generate Product Feedback**). |
| **Demo Tickets** | Filterable list of `DEMO-001`–`DEMO-050`. Clicking a ticket opens it in the Copilot and analyses it. |
| **Knowledge Base** | 295 public Circle Help Center articles (title, URL, search excerpt), searchable and filterable by category. |
| **Escalation** | No escalation / First-line troubleshooting / Escalate to specialist / Escalate to engineering, each with reasons and "escalate further if" triggers. Labelled *Prototype recommendation*. |

## Data integrity

Every piece of output carries a provenance badge:

- **FACT · Public Circle docs.** Backed by a linked public `help.circle.so` article. A doc-backed step only restates what that article's public title or search excerpt says.
- **PROTOTYPE RECOMMENDATION.** This prototype's suggestion. It is not Circle policy, an internal procedure, an SLA or an escalation rule.
- **DEMO DATA.** *Synthetic support scenarios, created for this portfolio prototype. Not Circle customer data.* Every trend statement is phrased as "In this synthetic dataset, …".

Rules the code and tests enforce:

- **Links resolve to the index.** Every link the app shows comes from the knowledge index. Tests fail if a playbook references an article that isn't indexed.
- **No invented sources.** When nothing matches, the UI says *"No public Circle documentation found for this issue."*
- **Safe drafts.** Draft replies never claim an issue is fixed, and never promise refunds, timelines or outcomes. Tests check this across every scenario and every demo ticket.
- **No real people.** Demo tickets use fictional names and communities, with no emails, phone numbers or real domains.

## Architecture

```
src/
  engine/
    types.ts            Shared contract (SupportAnalysis, TrendReport, SupportEngine…)
    index.ts            analyzeSupportIssue(issue, knowledge) · analyzeSupportTrends(tickets, knowledge) · setSupportEngine()
    categories.ts       Category labels + keyword weights
    rules/
      classify.ts       Category/problem classification + signal detection (multi-user, regression, billing…)
      playbooks.ts      Per-problem causes, steps, replies, docs, escalation paths, proactive actions
      retrieve.ts       Knowledge retrieval (playbook-pinned docs + lexical scoring)
      analyze.ts        Severity, escalation, summary, response drafting
      trends.ts         Trend & opportunity analysis
      feedback.ts       Product signals + handoff (reuses trend clusters and per-ticket analysis)
      productSignals.ts Product-facing framing per problem type
    feedbackFormat.ts   Slack / Jira / Markdown text exports
  data/
    knowledge.json      Build-time index of public Help Center articles
    demoTickets.ts      50 synthetic tickets
  ui/                   React views: Copilot, Support Trends, Demo Tickets, Knowledge Base, About
scripts/build-kb.mjs    Rebuilds knowledge.json
tests/                  Vitest: engine, trends, integrity, UI workflow
```

**Swappable reasoning layer.** The UI only calls `analyzeSupportIssue()`, `analyzeSupportTrends()`, `analyzeProductSignals()` and `generateProductFeedback()`. Both are async and return typed objects. To use an LLM later, implement the `SupportEngine` interface and call `setSupportEngine(llmEngine)`. No UI changes are needed. A test proves this by swapping in a fake engine.

## Knowledge index: how it was built

`scripts/build-kb.mjs` runs about 30 topic searches limited to `help.circle.so` through the **Brave Search API**. It stores only each result's title, URL and snippet, then categorises and de-duplicates them.

- **No direct access to Circle's site.** The script never requests `help.circle.so` itself. The site returns 403 to automated clients, and the script respects that rather than working around it.
- **No login, credentials or private content.**
- **Bundled output.** The JSON is committed and bundled, so the app makes **no network calls at runtime**.

```bash
npm run kb:build          # needs Brave Search access (BRAVE_API_KEY, or a proxy that injects it)
npm run kb:recategorize   # offline: re-run categorisation over the existing JSON
```

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 52 tests
npm run build      # static site in dist/
npm run preview    # serve the production build
```

Everything is free to run: there are no paid APIs, no backend and no runtime network access.

### Deploying (static)

- **Vercel:** import the repo. `vercel.json` sets `npm run build` → `dist`.
- **GitHub Pages:** publish `dist/`. Asset paths are relative (`base: './'`) and routing is hash-based (`#/trends`), so sub-paths work.

## Limitations

- **Rules, not reasoning.** Classification uses keyword rules. Unusual wording can land in the wrong category; the panel shows the alternatives considered and the confidence level.
- **Knowledge depth.** The engine sees only article titles and search excerpts, not full article bodies. Excerpts can be stale or generic. Doc-backed steps are limited to what those excerpts say, and the UI always points to the full article.
- **Prototype policy.** Escalation and severity rules are illustrative and are not Circle's actual policies.
- **Synthetic trends.** The trend analysis runs on synthetic data only. The patterns were designed in so the dashboard has something to find.
- **One language.** The prototype is English-only.
- **Product Feedback is prototype logic.** Signal priority and investigation suggestions are rules applied to synthetic tickets. The tickets carry no conversation history, so "What support tried" shows this prototype's playbook steps, not recorded actions.
