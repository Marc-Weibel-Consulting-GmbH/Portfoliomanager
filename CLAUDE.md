# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes, plus project-specific
instructions for the Portfolio Manager codebase.

> The general guidelines (sections 1–4) are adapted from forrestchang's
> "andrej-karpathy-skills" CLAUDE.md. The project-specific section is local to this repo.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## 5. Project-Specific Instructions

**Stack:** TypeScript monorepo. `client/` (Vite + React frontend), `server/` (Express-style
backend via `tsx`/`esbuild`, entry `server/_core/index.ts`), `shared/` (shared types),
Drizzle ORM (`drizzle/`), plus auxiliary services (`analytics_service/`, `tradingview-service/`,
`mcp-servers/`). Package manager: **pnpm**.

**Commands (verify your work with these):**
- `pnpm check` — TypeScript typecheck (run before every commit; must be green).
- `pnpm test` — Vitest test suite.
- `pnpm dev` — local dev server.
- `pnpm build` — production build (client via Vite + server bundle via esbuild).
- `pnpm db:push` — generate + apply Drizzle migrations.

**Deploy & live verification:**
- The hosted app (manus.space) **auto-deploys from `main`**. Deploy lag is roughly
  8–28 minutes depending on build queue; multiple rapid merges queue up.
- "Done" means **verified live**, not just merged. After a merge, re-test the affected
  pages on the live URL (no console errors) before considering a task complete.
- Build against the design mockups in `design/`. Do not fake completion — leave genuinely
  unfinished items explicitly marked with a reason rather than a false check.

**Data integrity:** Prefer real server data over mock/placeholder values in UI. When a
feature needs data the backend doesn't expose yet, say so rather than hardcoding.
