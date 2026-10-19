// Type definitions for the Work Item model.
// See docs/work-items.md for the authoritative description.

/** Supported work item types. */
export type WorkItemType = "feature" | "bug";

/**
 * MVP work-item outcome status.
 *
 * The status is `null` / unset while a work item is active. It is persisted in
 * `runtime/state.json` (not in the descriptor file) once a terminal outcome
 * is reached. See docs/work-items.md §Lifecycle and SPEC.md §11.
 */
export type WorkItemStatus = "passed" | "failed" | "cancelled" | "human_required";

/** A workflow template selection on a work item. */
export interface WorkflowSelection {
  template: string;
  version?: number;
}

/** Bug provenance: references the work item(s) where the defect originated. */
export interface BugSource {
  feature?: string;
  bug?: string;
  [key: string]: unknown;
}

/** Fields shared by every work item descriptor. */
export interface WorkItemCommon {
  id: string;
  type: WorkItemType;
  title: string;
  description: string;
  workflow?: WorkflowSelection;
  createdAt: string;
  updatedAt: string;
}

/** A feature work item descriptor. */
export interface Feature extends WorkItemCommon {
  type: "feature";
  /** The original user request that initiated this work item. */
  request?: string;
  /** Capabilities (e.g. `frontend`, `backend`) used for future workflow inference. */
  capabilities?: string[];
}

/** A bug work item descriptor. */
export interface Bug extends WorkItemCommon {
  type: "bug";
  /** Provenance: which feature (or other item) the defect relates to. */
  source?: BugSource;
}

/** Union of all supported work item metadata types. */
export type WorkItemMetadata = Feature | Bug;

/**
 * A combined view of work item metadata that exposes every field from
 * both `Feature` and `Bug` as optional. The `WorkItem` class uses this
 * as the return type of its `metadata` getter so callers can access
 * type-specific properties (e.g. `request`, `source`) without having
 * to narrow the union first.
 */
export type WorkItemView = WorkItemCommon & {
  request?: string;
  capabilities?: string[];
  source?: BugSource;
};

/** A work item record loaded from disk. */
export interface WorkItemRecord {
  /** Absolute path to the work item root directory. */
  root: string;
  /** Absolute path to the descriptor file (`feature.md` or `bug.md`). */
  descriptorPath: string;
  /** Parsed metadata from the descriptor frontmatter. */
    metadata: WorkItemMetadata;
  /** Markdown body of the descriptor file (after the frontmatter). */
  body: string;
}

/** Options for creating a new feature. */
export interface CreateFeatureOptions {
  title: string;
  description: string;
  request?: string;
  capabilities?: string[];
  workflow?: WorkflowSelection;
}

/** Options for creating a new bug. */
export interface CreateBugOptions {
  title: string;
  description: string;
  source?: BugSource;
  workflow?: WorkflowSelection;
}

/** A single validation error. */
export interface ValidationError {
  field: string;
  message: string;
}

/** Result of validating a work item. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
