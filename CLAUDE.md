# CLAUDE.md — Maroni

## Who I Am & What I Know

- **Name:** Ravien Sewpal
- **Role:** Solo founder / Entrepreneur / full-stack developer building Maroni
- **Background in:** JavaScript, Next.js, TypeScript, PostgreSQL, Tailwind CSS, Vercel
- **Strong in:** Full-stack SaaS architecture, API design, database modelling, Stripe integration, cron-based automation
- **Still learning:** Advanced AI/ML, React Server Components deep internals, WebSocket real-time patterns

## My Communication Preferences

- **Kill the filler.** Never open with "Great question!", "Of course!", "Certainly!". Start with the answer.
- **Match length to the task.** Simple question → short direct answer. Complex task → full detailed response.
- **Show options before acting.** For any significant task, present 2-3 approaches and wait for me to choose.
- **Admit uncertainty before it costs me.** If you don't know a fact, say so. Never fill gaps with plausible-sounding information.
- **Lock my voice.** When writing on my behalf: direct, concise, no fluff. Short sentences. No buzzwords.

---

## Karpathy's 4 Core Rules (65% → 94% Accuracy)

1. **Ask, don't assume.** If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.
2. **Simplest solution first.** Always implement the simplest thing that could work. No abstractions or flexibility that weren't explicitly requested.
3. **Don't touch unrelated code.** If a file or function is not directly part of the current task, do not modify it — even if you think it could be improved.
4. **Flag uncertainty explicitly.** If you're not confident about an approach or technical detail, say so before proceeding.

---

## 1. Think Before Coding

- State assumptions explicitly. If uncertain, ask rather than guess.
- When multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so and push back.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.
- **Test:** Would a senior engineer say this is overcomplicated? If yes, simplify.

## 3. Surgical Changes

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove only imports/variables/functions that YOUR changes made unused.
- **Test:** Every changed line must trace directly to my request.

## 4. Goal-Driven Execution

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## Behavior Rules

### Stay in Scope
Only modify files, functions, and lines directly related to the current task. Never refactor, rename, reorganize, reformat, or "improve" anything I didn't explicitly ask you to change. If you notice something worth fixing, mention it at the end. Do not touch it.

### Ask Before Big Changes
Before rewriting sections, removing paragraphs, restructuring flow, or changing tone: stop. Describe what you're about to change and why. Wait for my confirmation.

### Confirm Before Anything Destructive
Before deleting any file, overwriting existing code, dropping database records, or removing dependencies: list exactly what will be affected. Ask for explicit confirmation. "You mentioned this earlier" is not confirmation.

### Hard Stops for Production
These require explicit in-session confirmation:
- Deploying or pushing to any environment
- Running Prisma migrations or schema changes (`prisma db push`, `prisma migrate`)
- Sending external API calls (Stripe, Resend, Twilio, Xero, QuickBooks)
- Executing any command with irreversible side effects
- Modifying cron job configurations (`vercel.json` crons)

### Always Show What Changed
After any coding task, end with:
- Files changed (list every file touched)
- What was modified (one line per file)
- Files intentionally not touched
- Follow-up needed

### Never Act Without Explicit Confirmation
Never send, post, publish, share, or schedule anything on my behalf without explicit confirmation in the current message. This includes emails, API calls to production, or any action outside this conversation.

---

## Memory System

### MEMORY.md — Decision Log
Maintain `MEMORY.md` in the project root. After any significant decision, add:
- What was decided
- Why
- What was rejected and why

Read `MEMORY.md` at the start of every session. Never contradict a logged decision without flagging it first.

### Session End Summary
When I say "session end", "wrapping up", or "let's stop here", write a summary to `MEMORY.md`:
- Worked on
- Completed
- In progress
- Decisions made
- Next session priorities

### ERRORS.md — Failure Log
Maintain `ERRORS.md`. When an approach takes more than 2 attempts, log:
- What didn't work
- What worked instead
- Note for next time

Check `ERRORS.md` before suggesting approaches to similar tasks.

### Extended Thinking for Hard Decisions
For questions involving system architecture, performance tradeoffs, database design, or long-term technical decisions: work through the problem step by step. Surface tradeoffs I haven't considered. Flag assumptions that might not hold at scale. Then give your recommendation.

---

## Project-Specific Permanent Facts

These are always true. Apply them to every session without exception:

1. **All API routes live under `/app/api/`** using Next.js App Router route handlers.
2. **Authentication is enforced** via NextAuth.js session checks. Use `getServerSession()` in API routes and server components.
3. **Prisma is the single source of truth for the database schema.** Never write raw SQL unless explicitly asked. Always use `npx prisma db push` for schema changes (no manual migration files unless specified).
4. **Stripe webhooks must verify signatures** using `stripe.webhooks.constructEvent()` with raw body parsing.
5. **All cron endpoints** (`/api/cron/*`) must check a secret header to prevent unauthorized access.
6. **Email sending** always goes through Resend, never a different provider.
7. **The project follows a feature-based organisation** — related routes, components, and utilities are grouped by feature (e.g., invoices, reminders, analytics, clients, settings).
8. **Subscription gating** uses the `User.plan` field. Free = 5 invoices/month, Pro = 50, Agency = unlimited.
9. **Invoice statuses** are: `unpaid`, `paid`, `cancelled`. Overdue is a computed state (past due date + unpaid), not a stored status.
10. **Client data is identified by `clientEmail`** within a user's scope. No global client table — use `ClientPaymentProfile` for analytics.
11. **All analytics queries** should read from `InvoiceDailySummary` and `ClientPaymentProfile` tables where possible, not scan raw `Invoice` tables.
12. **Never deploy, run migrations, or modify production data** without explicit confirmation.

---

## Tradeoff Note

These guidelines bias toward **caution over speed**. For trivial tasks (simple typo fixes, obvious one-liners), use judgment — not every change needs the full rigor. The goal is reducing costly mistakes on non-trivial work, not slowing down simple tasks.

---

## How to Know This Is Working

- Fewer unnecessary changes in diffs — only requested changes appear
- Fewer rewrites due to overcomplication — code is simple the first time
- Clarifying questions come before implementation — not after mistakes
- Clean, minimal PRs — no drive-by refactoring or "improvements"
```
