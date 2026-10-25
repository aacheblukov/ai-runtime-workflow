// Type definitions for the Workflow Template model.
// See docs/workflows.md for the authoritative description.

/**
 * Workflow template schema version (starts at 1).
 *
 * This is the default version applied when a template YAML does not
 * specify an explicit `version` field. The version is captured in the
 * resolved execution plan to ensure template changes do not silently
 * alter existing plans.
 */
export const WORKFLOW_SCHEMA_VERSION = 1;

/**
 * Reserved/supported top-level field names in a workflow template YAML.
 *
 * Templates containing any field not in this list will fail validation.
 * This prevents typos and accidental misuse of undocumented fields.
 */
export const SUPPORTED_WORKFLOW_FIELDS: readonly string[] = [
  "name",
  "version",
  "steps",
  "optional",
  "retry",
  "transitions",
  "approval",
];

/**
 * Retry behavior configuration for a workflow.
 *
 * Defines which role may be retried and the maximum number of attempts
 * (including the initial execution). The default MVP loop retries the
 * Developer role up to 3 attempts after QA failure.
 *
 * See SPEC.md §16 and docs/execution.md §Failure and retry.
 */
export interface RetryConfig {
  /** The role identity to retry on failure (e.g. "developer"). */
  role: string;
  /** Maximum number of attempts, including the initial execution (>= 1). */
  maxAttempts: number;
}

/**
 * A transition from one step to another based on a result condition.
 *
 * For example, on QA failure, transition back to Developer for another
 * attempt. Transitions describe orchestration behavior over the resolved
 * execution plan, not a rewrite of the plan.
 */
export interface WorkflowTransition {
  /** The step to transition from (a role identity). */
  from: string;
  /** The trigger condition (e.g. "failed", "passed"). */
  on: string;
  /** The target step to transition to (a role identity). */
  to: string;
}

/**
 * An approval point: a step result that requires human review.
 *
 * For example, when QA passes, a human review approval point ensures
 * a human must approve before the work item is considered complete.
 */
export interface ApprovalPoint {
  /** The step that may trigger an approval requirement (a role identity). */
  step: string;
  /** The condition that triggers the approval (e.g. "passed", "failed"). */
  when: string;
}

/**
 * A workflow template definition (parsed from YAML).
 *
 * A template defines _who participates and in what order_. It is a
 * reusable definition, not copied into every work item.
 *
 * Required fields: `name`, `steps`.
 * Optional fields: `version` (defaults to 1), `optional`, `retry`,
 * `transitions`, `approval`.
 *
 * @see docs/workflows.md §Workflow template
 */
export interface WorkflowTemplate {
  /** Template name (e.g. "default", "ui", "full-stack"). */
  name: string;
  /** Template schema version. Defaults to 1 if not specified in YAML. */
  version: number;
  /** Ordered list of role identities defining the workflow steps. */
  steps: string[];
  /**
   * Role identities that are optional — may be skipped if the role is
   * unavailable or its configuration is absent.
   */
  optional?: string[];
  /** Retry behavior configuration (e.g. max developer attempts). */
  retry?: RetryConfig;
  /** Transitions between steps based on result conditions. */
  transitions?: WorkflowTransition[];
  /** Approval points requiring human review under certain conditions. */
  approval?: ApprovalPoint[];
}

/**
 * A resolved execution plan for a specific work item.
 *
 * The execution plan is the immutable, resolved view of a workflow
 * template for one work item. It captures the template name and version
 * at resolution time so later template changes do not alter existing plans.
 *
 * @see docs/workflows.md §Resolution → execution plan
 */
export interface ExecutionPlan {
  /** The workflow template name that was selected. */
  template: string;
  /** The template version that was resolved at plan creation time. */
  version: number;
  /** Resolved ordered steps (role identities). */
  steps: string[];
}

/** A single field validation error. */
export interface WorkflowValidationError {
  field: string;
  message: string;
}

/** Result of validating a workflow template. */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
}
