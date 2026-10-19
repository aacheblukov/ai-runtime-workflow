# Development

This document describes how to work on the AI Dev Team runtime repository itself: toolchain, layout expectations, verification, and how documentation fits into changes.

`SPEC.md` is the architectural source of truth. `AGENTS.md` binds agent/contributor behavior. Prefer this file for local development practices for **this** codebase (not the replaceable target projects the runtime operates on).

---

## Purpose

Keep the runtime codebase small, typed, testable, and aligned with documented boundaries. Prefer the smallest change that correctly solves the current problem. Do not invent architecture to make progress look smoother.

---

## Toolchain

From the current project setup:

| Piece           | Choice                                                              |
| --------------- | ------------------------------------------------------------------- |
| Package manager | `pnpm` (`packageManager` in `package.json`)                         |
| Runtime         | Node.js `>=20`                                                      |
| Language        | TypeScript (`strict` options in `tsconfig.json`)                    |
| Module system   | ESM (`"type": "module"`, `module` / `moduleResolution`: `nodenext`) |
| Tests           | Vitest (with coverage package available)                            |
| Lint / format   | Biome                                                               |

`package.json` scripts and a populated `src/` tree are still backlog items. Until scripts exist, run tools via `pnpm exec` (for example `pnpm exec tsc`, `pnpm exec vitest`, `pnpm exec biome`) as appropriate.

Expected compile layout once sources exist:

- `src/**/*.ts` → `dist/` (`rootDir` / `outDir` in `tsconfig.json`)

---

## Source of truth for behavior

When implementing or changing behavior, prefer this order (`AGENTS.md`):

1. Existing implementation
2. Relevant `docs/*` for the subsystem
3. `SPEC.md`
4. Simplest reasonable solution
5. Ask if an important decision remains unclear

If a change conflicts with `SPEC.md`, stop and explain. If code already conflicts with docs, explain the discrepancy before silently redesigning.

---

## Architecture boundaries (reminder)

Do not move responsibilities across these without a concrete reason:

- Work Item — what
- Workflow / execution plan — who / when
- Role — how configured
- Permissions — what is allowed (runtime-enforced)
- Runtime — orchestrates and executes tools
- Artifacts — cross-role communication
- Target project — software being modified
- Filesystem — MVP persistence

Roles stay configuration. Permissions stay runtime checks. Providers stay behind an abstraction.

---

## Documentation

Subsystem docs under `docs/`:

| Doc               | Focus                   |
| ----------------- | ----------------------- |
| `architecture.md` | Overall shape           |
| `work-items.md`   | Features / bugs         |
| `workflows.md`    | Templates and plans     |
| `roles.md`        | Role manifests          |
| `permissions.md`  | Permission model        |
| `runtime.md`      | Orchestration and tools |
| `storage.md`      | On-disk layout          |
| `execution.md`    | Executions, logs, retry |
| `development.md`  | This file               |

When behavior or architecture changes, update the relevant doc. Docs should explain why, boundaries, contracts, and invariants—not restate every line of code.

The product backlog file in this repo is currently `backlog.md` (see discrepancy note in the documentation backlog review if renaming).

---

## Verification

After non-trivial changes:

1. Run relevant tests
2. Run typechecking / build when applicable
3. Run linting when applicable
4. Inspect the resulting diff
5. Fix failures before calling the task done

For bug fixes, reproduce when practical, then verify the fix.

Prefer deterministic tests: mock the LLM provider for orchestration, permissions, retry, and storage. Do not require a live API key for the default unit/integration suite.

---

## Implementation sequencing (MVP)

- **TDD Workflow**: All code contributions must adhere to Test-Driven Development (write tests -> verify failure -> implement -> verify success).

The backlog’s order is deliberate. In particular:

1. Filesystem and work-item storage
2. Workflow templates and execution plans
3. Roles and permissions
4. Runtime loop with **mock** role execution
5. Execution state and logging
6. Retry / Git / provider interface
7. Real provider (OpenRouter) and tools
8. Real PO → Developer → QA vertical slice

Do not wire a real vendor into core paths before the mock loop proves artifacts, state, events, and failure handling.

---

## Out of scope for MVP (do not build “early”)

Examples from `SPEC.md`: database, distributed execution, autonomous multi-agent chat, automatic merge, complex workflow inference, vector DB / long-term semantic memory, autonomous production deployment, Playwright integration, and browser-based QA. See `SPEC.md` §23–24.

If you discover useful future work, record it in the backlog; do not expand the current task to absorb it.

---

## Invariants for contributors

1. Smallest correct change; no speculative infrastructure.
2. Respect documented boundaries; do not hard-code roles or provider lock-in.
3. Verify with tests/types/lint as applicable.
4. Keep docs current when contracts change.
5. Clarify ambiguous decisions with the human before implementing the wrong one.

---

## Related documentation

| Doc                              | Focus                              |
| -------------------------------- | ---------------------------------- |
| `SPEC.md`                        | Full specification (authoritative) |
| `AGENTS.md`                      | Agent/contributor working rules    |
| `docs/architecture.md`           | System-wide boundaries             |
| `backlog.md`                     | Ordered implementation backlog     |
| `package.json` / `tsconfig.json` | Toolchain facts                    |
