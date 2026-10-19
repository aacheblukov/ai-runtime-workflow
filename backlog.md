# Backlog

## 0. Project foundation

- [x] Initialize Node.js + TypeScript project
- [x] Configure package manager
- [x] Configure TypeScript
- [x] Configure linting / formatting
- [x] Configure test runner
- [x] Create basic `src/` structure
- [x] Add development scripts to `package.json`
- [x] Verify project builds and tests run

### Documentation

- [ ] Create `README.md`
- [x] Create `AGENTS.md`
- [x] Create `docs/architecture.md`
- [x] Create `docs/work-items.md`
- [x] Create `docs/workflows.md`
- [x] Create `docs/roles.md`
- [x] Create `docs/permissions.md`
- [x] Create `docs/runtime.md`
- [x] Create `docs/storage.md`
- [x] Create `docs/execution.md`
- [x] Create `docs/development.md`
- [x] Review documentation against `SPEC.md`

---

# 1. Filesystem storage

Implement filesystem as the source of truth for the MVP.

- [x] Define project directory structure
- [x] Implement filesystem abstraction
- [x] Implement directory creation
- [x] Implement file creation
- [x] Implement file reading
- [x] Implement file writing
- [x] Implement JSON read/write helpers
- [x] Implement append-only JSONL event writing
- [x] Add filesystem unit tests

Expected structure:

```text
projects/
└── <project>/
    ├── project.md
    ├── backlog.md
    ├── features/
    └── bugs/
```

---

# 2. Project creation

Implement:

```bash
pnpm exec create-project <name>
```

- [x] Create project directory
- [x] Create `project.md`
- [x] Create project `backlog.md`
- [x] Create `features/`
- [x] Create `bugs/`
- [x] Validate project name
- [x] Prevent accidental overwrite of existing project
- [x] Add tests
- [x] Verify generated structure

---

# 3. Work items

Implement the Work Item model.

- [x] Add tests
- [x] Define Work Item structure
- [x] Support `feature`
- [x] Support `bug`
- [x] Define work item IDs
- [x] Define MVP work-item outcome status enum: `passed | failed | cancelled | human_required`
- [x] Define common metadata

The persisted outcome status is unset while a work item is active. `passed` means QA passed and the item is PR-ready; `failed` means an unrecoverable role, tool, or runtime failure; `cancelled` means execution was stopped or the target application/process crashed; and `human_required` means the third Developer attempt failed QA. QA results use the separate `status: passed | failed` schema.

- [x] Define feature-specific fields
- [x] Define bug provenance (`source.feature`, etc.)
- [x] Implement Work Item filesystem storage
- [x] Implement Work Item loading
- [x] Implement Work Item validation

Target structure:

```text
projects/<project>/
├── features/
│   └── FEAT-001/
│       └── feature.md
└── bugs/
    └── BUG-001/
        └── bug.md
```

---

# 4. Create work items from the CLI

Implement:

- [x] Create a Feature from a user request
- [x] Generate Feature ID
- [x] Create feature directory
- [x] Create `feature.md`
- [x] Create feature runtime directory
- [x] Add feature to project backlog
- [x] Add tests

```typescript
WorkItemService.createFeature("Create a Save button");
```

Result:

```text
projects/demo-app/
└── features/
    └── FEAT-001/
        ├── feature.md
        └── runtime/
```

---

# 5. Workflow templates

Implement reusable workflow definitions.

Create:

```text
workflows/
├── default.yaml
├── ui.yaml
└── full-stack.yaml
```

- [ ] Define workflow template schema
- [ ] Implement workflow loader
- [ ] Validate workflow templates
- [ ] Support ordered role steps
- [ ] Support workflow template version
- [ ] Add default workflow
- [ ] Add UI workflow
- [ ] Add full-stack workflow
- [ ] Add tests
- [ ] Define optional workflow behavior
- [ ] Define retry behavior
- [ ] Define transitions
- [ ] Define approval points
- [ ] Validate supported and reserved workflow fields

Initial workflows:

```text
default:
PO → Developer → QA

ui:
PO → Designer → Developer → QA

full-stack:
PO → Designer → Backend Developer → Developer → QA
```

---

# 6. Execution plan

A Work Item selects a workflow template.

Resolve the template into an immutable execution plan.

- [ ] Implement execution plan model
- [ ] Load selected workflow template
- [ ] Resolve role order
- [ ] Store workflow template name
- [ ] Store workflow version
- [ ] Store resolved steps
- [ ] Persist `execution-plan.json`
- [ ] Ensure future workflow changes do not alter existing execution plans
- [ ] Add tests

Expected:

```text
projects/<project>/features/FEAT-001/runtime/
└── execution-plan.json
```

---

# 7. Role system

Roles are configuration, not hard-coded agent classes.

Create:

```text
roles/
├── product-owner/
│   ├── manifest.yaml
│   └── role.md
├── developer/
│   ├── manifest.yaml
│   └── role.md
└── qa/
    ├── manifest.yaml
    └── role.md
```

- [ ] Define role manifest schema
- [ ] Define role instruction format
- [ ] Implement role loader
- [ ] Validate role manifests
- [ ] Load role instructions from `role.md`
- [ ] Load role model configuration
- [ ] Load role tool configuration
- [ ] Load role permissions
- [ ] Add tests

---

# 8. Permission system

Permissions must be enforced by the runtime.

## Tool permissions

- [ ] Define tool permission model
- [ ] Implement tool permission checking
- [ ] Support `filesystem.read`
- [ ] Support `filesystem.write`
- [ ] Support `terminal.run`
- [ ] Support `git.status`
- [ ] Support `git.diff`
- [ ] Support `git.commit`
- [ ] Support `git.push`
- [ ] Support browser tool permission checks (`browser.*`) for the optional MVP interface

## Resource permissions

- [ ] Define filesystem path permissions
- [ ] Validate read access
- [ ] Validate write access
- [ ] Prevent access outside allowed paths

## Operation permissions

- [ ] Distinguish read-only git operations from mutations
- [ ] Enforce operation-level permissions

## Runtime enforcement

- [ ] Route every tool call through permission checking
- [ ] Return structured permission errors
- [ ] Log permission decisions
- [ ] Add permission tests

Important rule:

```text
Role instructions are not a security boundary.
Runtime permissions are the security boundary.
```

---

# 9. Runtime

Implement the core execution runtime.

- [ ] Load Work Item
- [ ] Load workflow
- [ ] Create execution plan
- [ ] Load roles
- [ ] Execute roles in order
- [ ] Pass role context
- [ ] Pass role instructions
- [ ] Pass artifacts
- [ ] Handle role output
- [ ] Persist runtime state
- [ ] Handle execution errors
- [ ] Add runtime tests

Core flow:

```text
Work Item
  ↓
Workflow Template
  ↓
Execution Plan
  ↓
Role Execution
  ↓
LLM + Context + Tools
  ↓
Permission Check
  ↓
Tool Execution
  ↓
Artifacts / State / Logs
```

---

# 10. Mock role execution

Before connecting a real LLM, prove that the runtime works.

- [ ] Implement mock LLM/provider
- [ ] Implement mock Product Owner
- [ ] Implement mock Developer
- [ ] Implement mock QA
- [ ] Execute a complete workflow without an external API
- [ ] Verify artifacts are produced
- [ ] Verify state transitions
- [ ] Verify execution events
- [ ] Verify failures can stop execution
- [ ] Add deterministic integration test

Target:

```text
FEAT-001
   ↓
PO
   ↓
Developer
   ↓
QA
   ↓
QA result: passed
   ↓
work-item status: passed
```

---

# 11. Execution state and logging

Implement inspectable execution history.

Feature runtime:

```text
runtime/
├── state.json
├── events.jsonl
├── execution-plan.json
└── executions/
    ├── 001/
    ├── 002/
    └── 003/
```

- [ ] Define runtime state schema, including the work-item outcome status enum
- [ ] Implement state persistence
- [ ] Define execution schema
- [ ] Generate execution IDs
- [ ] Store execution input
- [ ] Store execution output
- [ ] Store execution metadata
- [ ] Store role
- [ ] Store attempt number
- [ ] Store provider/model
- [ ] Store execution result/status
- [ ] Store failure reason
- [ ] Store timestamps
- [ ] Store changed files
- [ ] Store tool calls
- [ ] Implement append-only event log
- [ ] Add tests

---

# 12. Retry and failure handling

Implement the MVP failure loop.

Maximum:

```text
3 attempts in total (initial Developer execution + up to 2 retries)
```

An **attempt** is one Developer execution against this work item. The QA runs that verify each attempt are recorded as their own executions but are not counted as attempts.

Flow:

```text
QA result: failed
   ↓
attempt < 3?
   ├── yes → Developer (next attempt)
   │          ↓
   │         QA
   │
   └── no → work-item status: human_required
```

Sequence when all attempts fail:

```text
Developer #1 → QA #1: failed → Developer #2 → QA #2: failed → Developer #3 → QA #3: failed → work-item status: human_required
```

- [ ] Define failure state
- [ ] Define retry state
- [ ] Implement attempt counter
- [ ] Re-run Developer after QA failure
- [ ] Pass QA failure information back to Developer
- [ ] Re-run QA
- [ ] Stop after the third Developer attempt fails QA and persist `human_required`
- [ ] Persist all attempts
- [ ] Add deterministic retry tests

---

# 13. Git integration

Each Work Item gets its own branch.

- [ ] Detect target repository
- [ ] Validate git repository
- [ ] Create Work Item branch
- [ ] Implement git status
- [ ] Implement git diff
- [ ] Implement commit
- [ ] Associate branch with Work Item
- [ ] Store branch information in runtime state
- [ ] Verify one logical completed subtask can produce one commit
- [ ] Prepare PR-ready state
- [ ] Add tests
- [ ] Implement git push

Initial rule (id + slug):

```text
FEAT-001 → feature/FEAT-001-save-button
BUG-001  → bug/BUG-001-save-button-persistence
```

Do not implement automatic merge.

---

# 14. LLM provider abstraction

Only after the runtime works with mocks.

- [ ] Define provider-agnostic LLM interface
- [ ] Define request model
- [ ] Define response model
- [ ] Define tool-call representation
- [ ] Define provider errors
- [ ] Implement provider configuration
- [ ] Add mock provider
- [ ] Add tests

Important:

```text
Runtime
   ↓
LLM Provider Interface
   ↓
Provider implementation
```

The core runtime must not depend on OpenRouter.

---

# 15. OpenRouter provider

Initial real provider.

- [ ] Implement OpenRouter provider
- [ ] Read API key from environment/configuration
- [ ] Configure model per role
- [ ] Send role instructions
- [ ] Send role context
- [ ] Handle tool calls
- [ ] Handle provider errors
- [ ] Record provider/model in execution metadata
- [ ] Add integration test strategy without requiring a real API key

---

# 16. Tool execution

Connect LLM tool calls to the local runtime.

## Filesystem

- [ ] `filesystem.read`
- [ ] `filesystem.write`

## Terminal

- [ ] `terminal.run`
- [ ] Restrict working directory
- [ ] Enforce permissions
- [ ] Capture stdout
- [ ] Capture stderr
- [ ] Capture exit code
- [ ] Log execution

## Git

- [ ] `git.status`
- [ ] `git.diff`
- [ ] `git.commit`
- [ ] `git.push`

## Browser interface (conditional MVP)

The browser interface is an optional MVP contract. Add it only when the selected QA workflow requires browser validation.

- [ ] Define browser tool interface
- [ ] Define browser permission model
- [ ] Define browser operation names (`browser.start`, `browser.goto`, `browser.click`, `browser.fill`, `browser.screenshot`, `browser.close`)

These items define the interface and permission surface only; they do not implement Playwright. Playwright integration and browser-based QA remain future work.

Browser tools are primarily needed for QA.

---

# 17. Target project runtime

Allow the AI team to operate on a replaceable target project.

- [ ] Define target project configuration
- [ ] Define project runtime configuration
- [ ] Support start command
- [ ] Support healthcheck URL
- [ ] Start target application
- [ ] Wait for application readiness
- [ ] Pass base URL to QA
- [ ] Stop target application after execution
- [ ] Handle process failures
- [ ] Add tests

Example:

```yaml
runtime:
  start: pnpm exec dev
  url: http://localhost:3000
```

---

# 18. Product Owner role

Implement the first real AI role.

Responsibilities:

- [ ] Read Work Item
- [ ] Read project context
- [ ] Understand business request
- [ ] Define requirements
- [ ] Define acceptance criteria
- [ ] Identify dependencies
- [ ] Produce `requirements.md`
- [ ] Do not modify target source code
- [ ] Respect role permissions

---

# 19. Developer role

Implement the first real coding role.

Responsibilities:

- [ ] Read requirements
- [ ] Read project context
- [ ] Inspect target project
- [ ] Modify target source
- [ ] Run relevant commands/tests
- [ ] Produce `implementation.md`
- [ ] Respect filesystem permissions
- [ ] Respect git permissions
- [ ] Return structured execution result

---

# 20. QA role

Implement the first real QA role.

Responsibilities:

- [ ] Read requirements
- [ ] Read acceptance criteria
- [ ] Inspect implementation
- [ ] Run application
- [ ] Validate behavior
- [ ] Use terminal and tests where appropriate
- [ ] Use the browser interface only when enabled by the selected QA workflow
- [ ] Produce `qa.md`
- [ ] Return PASS/FAIL result
- [ ] Include failure explanation
- [ ] Do not modify implementation

Initial QA result:

```text
PASS
FAIL
```

QA does not create issues in MVP.

---

# 21. First real end-to-end scenario

Use a deliberately trivial feature.

Example:

```text
Create a Save button.
```

- [ ] Create demo target project
- [ ] Create `demo-app` project
- [ ] Create FEAT-001
- [ ] Select appropriate workflow
- [ ] Run Product Owner
- [ ] Verify `requirements.md`
- [ ] Run Developer
- [ ] Verify implementation
- [ ] Run QA
- [ ] Verify QA result
- [ ] Reach GREEN
- [ ] Verify git branch
- [ ] Verify execution logs
- [ ] Verify all artifacts
- [ ] Verify human-review-ready state

Target flow:

```text
User
 ↓
FEAT-001
 ↓
Product Owner
 ↓
requirements.md
 ↓
Developer
 ↓
implementation
 ↓
QA
 ↓
PASS
 ↓
GREEN
 ↓
Human review
 ↓
Merge
```

---

# 22. First failure scenario

Prove the retry loop works.

- [ ] Create intentionally failing feature/test case
- [ ] QA returns FAIL
- [ ] Developer receives failure information
- [ ] Developer attempt #2 runs
- [ ] QA runs again
- [ ] Developer attempt #3 runs if necessary
- [ ] QA runs final attempt
- [ ] Execution stops after 3 failed attempts (3 Developer executions total)
- [ ] Feature enters `HUMAN_REQUIRED`
- [ ] All attempts remain inspectable
- [ ] Event log contains complete failure history

---

# 23. MVP cleanup

Only after the vertical slice works.

- [ ] Review architecture against SPEC
- [ ] Remove unnecessary abstractions
- [ ] Remove dead code
- [ ] Improve error messages
- [ ] Improve CLI output
- [ ] Improve tests
- [ ] Update documentation
- [ ] Update README
- [ ] Update backlog
- [ ] Document known limitations
- [ ] Tag first MVP release

---

# Future — do not implement yet

These are intentionally outside the MVP.

- [ ] Smart workflow selection
- [ ] Capability-based workflow resolution
- [ ] Feature-specific workflow overrides
- [ ] Designer / Backend-developer / Security roles
- [ ] Manual QA role
- [ ] Automated test-generation role
- [ ] Regression check system
- [ ] Browser-based QA
- [ ] Playwright integration
- [ ] Cross-role review loops
- [ ] Automatic issue creation
- [ ] Automatic PR creation
- [ ] Automatic merge
- [ ] Fully autonomous mode
- [ ] Web dashboard
- [ ] Database storage
- [ ] Vector database
- [ ] Long-term agent memory
- [ ] Distributed execution
- [ ] Model comparison UI
- [ ] Prompt/model evaluation system
- [ ] Multiple LLM providers
- [ ] Local model support
- [ ] Figma integration
- [ ] Advanced security/sandboxing
- [ ] Parallel role execution

---

# MVP Definition of Done

The MVP is considered complete when the following works:

```bash
pnpm exec create-project demo-app

pnpm exec new-request <target_project> "Create a Save button"

pnpm exec execute FEAT-001
```

And the system can autonomously execute:

```text
Feature
  ↓
Workflow
  ↓
Execution Plan
  ↓
Product Owner
  ↓
Developer
  ↓
QA
  ↓
GREEN
```

with:

- filesystem persistence
- configurable roles
- runtime-enforced permissions
- provider abstraction
- OpenRouter provider
- tool execution
- browser tool interface and permission model only when required by the selected QA workflow
- git branch
- execution state
- execution logs
- artifacts
- QA PASS/FAIL
- maximum 3 attempts
- human intervention after repeated failure

Playwright integration and browser-based QA are future capabilities and are not required for MVP completion.

The final MVP flow is:

```text
User
  ↓
Work Item
  ↓
Workflow Template
  ↓
Execution Plan
  ↓
Role Execution
  ↓
LLM + Context + Tools
  ↓
Permission Check
  ↓
Tool Execution
  ↓
Artifacts / State / Logs
  ↓
QA
  ↓
GREEN / HUMAN_REQUIRED
  ↓
Human Review
```
