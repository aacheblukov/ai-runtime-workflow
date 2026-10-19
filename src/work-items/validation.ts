// Validation logic for work item metadata.
// See docs/work-items.md for field definitions and SPEC.md §3.2 for types.

import type { Bug, Feature, ValidationError, ValidationResult, WorkItemMetadata } from "./types.js";

/** Regex for a valid work item ID (e.g. FEAT-001, BUG-001). */
const ID_PATTERN = /^(FEAT|BUG)-\d{3,}$/;

/** ISO 8601 date-time regex (relaxed – just enough to reject obvious junk). */
const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function isRequiredString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Validate a work item's metadata.
 *
 * Checks structural correctness: required fields, ID/type consistency,
 * field types, and date validity. This does NOT check filesystem state.
 */
export function validate(metadata: WorkItemMetadata): ValidationResult {
  const errors: ValidationError[] = [];

  // --- Common required fields ---
  if (!isRequiredString(metadata.id)) {
    errors.push({ field: "id", message: "id is required" });
  } else if (!ID_PATTERN.test(metadata.id)) {
    errors.push({
      field: "id",
      message: "id must match FEAT-NNN or BUG-NNN (at least 3 digits)",
    });
  } else {
    // Check id/type prefix consistency
    const prefix = metadata.id.slice(0, 4);
    const expectedType = prefix === "FEAT" ? "feature" : "bug";
    if (metadata.type !== expectedType) {
      errors.push({
        field: "id",
        message: `id prefix ${prefix} does not match type ${metadata.type}`,
      });
    }
  }

  if (metadata.type !== "feature" && metadata.type !== "bug") {
    errors.push({
      field: "type",
      message: "type must be 'feature' or 'bug'",
    });
  }

  if (!isRequiredString(metadata.title)) {
    errors.push({ field: "title", message: "title is required" });
  }

  if (!isRequiredString(metadata.description)) {
    errors.push({ field: "description", message: "description is required" });
  }

  if (!isValidDate(metadata.createdAt)) {
    errors.push({ field: "createdAt", message: "createdAt must be a valid ISO date" });
  }

  if (!isValidDate(metadata.updatedAt)) {
    errors.push({ field: "updatedAt", message: "updatedAt must be a valid ISO date" });
  } else if (
    isValidDate(metadata.createdAt) &&
    metadata.updatedAt < metadata.createdAt
  ) {
    errors.push({
      field: "updatedAt",
      message: "updatedAt must not be earlier than createdAt",
    });
  }

  // --- Workflow (optional) ---
  if (metadata.workflow !== undefined) {
    if (typeof metadata.workflow !== "object" || metadata.workflow === null) {
      errors.push({ field: "workflow", message: "workflow must be an object" });
    } else {
      const wf = metadata.workflow;
      if (!isRequiredString(wf.template)) {
        errors.push({
          field: "workflow.template",
          message: "workflow.template is required when workflow is set",
        });
      }
      if (
        wf.version !== undefined &&
        (typeof wf.version !== "number" || !Number.isFinite(wf.version))
      ) {
        errors.push({
          field: "workflow.version",
          message: "workflow.version must be a number",
        });
      }
    }
  }

  // --- Type-specific validation ---
  if (metadata.type === "feature") {
    validateFeature(metadata, errors);
  } else if (metadata.type === "bug") {
    validateBug(metadata, errors);
  }

  return { valid: errors.length === 0, errors };
}

/** Validate feature-specific fields. */
function validateFeature(feature: Feature, errors: ValidationError[]): void {
  if (
    feature.request !== undefined &&
    (typeof feature.request !== "string" || feature.request.trim().length === 0)
  ) {
    errors.push({
      field: "request",
      message: "request must be a non-empty string",
    });
  }

  if (feature.capabilities !== undefined) {
    if (!Array.isArray(feature.capabilities)) {
      errors.push({
        field: "capabilities",
        message: "capabilities must be an array of strings",
      });
    } else {
      for (let i = 0; i < feature.capabilities.length; i++) {
        if (typeof feature.capabilities[i] !== "string") {
          errors.push({
            field: `capabilities[${i}]`,
            message: "each capability must be a string",
          });
        }
      }
    }
  }
}

/** Validate bug-specific fields. */
function validateBug(bug: Bug, errors: ValidationError[]): void {
  if (bug.source !== undefined) {
    if (typeof bug.source !== "object" || bug.source === null) {
      errors.push({
        field: "source",
        message: "source must be an object",
      });
    } else {
      const source = bug.source as Record<string, unknown>;
      const hasReference =
        typeof source.feature === "string" || typeof source.bug === "string";
      if (!hasReference) {
        errors.push({
          field: "source",
          message:
            "source must contain at least one reference (e.g. source.feature)",
        });
      }
    }
  }
}

/**
 * Check whether a work item ID matches its type prefix.
 */
export function isValidId(id: string, type: "feature" | "bug"): boolean {
  const prefix = id.slice(0, 4);
  if (type === "feature") {
    return prefix === "FEAT";
  }
  return prefix === "BUG";
}
