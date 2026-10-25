// Validation logic for workflow templates.
// See docs/workflows.md for the template schema and SPEC.md §3.3.

import type { WorkflowValidationResult } from "./types.js";
import { SUPPORTED_WORKFLOW_FIELDS } from "./types.js";

/** Check that a value is a non-empty, non-whitespace string. */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Check that a value is a positive integer (>= 1). */
function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Check that a value is a plain object (not null, not array). */
function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate a workflow template's structure.
 *
 * Checks required fields (`name`, `steps`), optional fields
 * (`version`, `optional`, `retry`, `transitions`, `approval`), and
 * rejects any unknown top-level or nested fields.
 *
 * This does NOT check filesystem state — only the structure of the
 * provided object.
 */
export function validateTemplate(template: unknown): WorkflowValidationResult {
  const errors: WorkflowValidationResult["errors"] = [];

  // --- Must be a plain object ---
  if (!isPlainObject(template)) {
    return {
      valid: false,
      errors: [
        {
          field: "root",
          message: "workflow template must be an object",
        },
      ],
    };
  }

  const record = template as Record<string, unknown>;

  // --- Reject unknown top-level fields ---
  const knownFields = new Set<string>(SUPPORTED_WORKFLOW_FIELDS);
  for (const key of Object.keys(record)) {
    if (!knownFields.has(key)) {
      errors.push({
        field: key,
        message: `unknown field "${key}" is not a supported workflow template field`,
      });
    }
  }

  // --- name (required) ---
  if (!isNonEmptyString(record.name)) {
    errors.push({
      field: "name",
      message: "name is required and must be a non-empty string",
    });
  }

  // --- version (optional) ---
  if (record.version !== undefined) {
    if (!isPositiveInteger(record.version)) {
      errors.push({
        field: "version",
        message: "version must be a positive integer",
      });
    }
  }

  // --- steps (required) ---
  if (!Array.isArray(record.steps) || record.steps.length === 0) {
    errors.push({
      field: "steps",
      message: "steps is required and must be a non-empty array",
    });
  } else {
    for (let i = 0; i < record.steps.length; i++) {
      if (!isNonEmptyString(record.steps[i])) {
        errors.push({
          field: `steps[${i}]`,
          message: "each step must be a non-empty string",
        });
      }
    }
  }

  // --- optional (optional) ---
  if (record.optional !== undefined) {
    if (!Array.isArray(record.optional)) {
      errors.push({
        field: "optional",
        message: "optional must be an array of strings",
      });
    } else {
      for (let i = 0; i < record.optional.length; i++) {
        if (typeof record.optional[i] !== "string") {
          errors.push({
            field: `optional[${i}]`,
            message: "each optional entry must be a string",
          });
        }
      }
    }
  }

  // --- retry (optional) ---
  if (record.retry !== undefined) {
    errors.push(...validateRetry(record.retry));
  }

  // --- transitions (optional) ---
  if (record.transitions !== undefined) {
    errors.push(...validateTransitions(record.transitions));
  }

  // --- approval (optional) ---
  if (record.approval !== undefined) {
    errors.push(...validateApprovalPoints(record.approval));
  }

  return { valid: errors.length === 0, errors };
}

/** Validate the `retry` field. */
function validateRetry(value: unknown): WorkflowValidationResult["errors"] {
  const errors: WorkflowValidationResult["errors"] = [];

  if (!isPlainObject(value)) {
    errors.push({ field: "retry", message: "retry must be an object" });
    return errors;
  }

  const retry = value as Record<string, unknown>;

  for (const key of Object.keys(retry)) {
    if (key !== "role" && key !== "maxAttempts") {
      errors.push({
        field: `retry.${key}`,
        message: `unknown field "${key}" in retry configuration`,
      });
    }
  }

  if (!isNonEmptyString(retry.role)) {
    errors.push({
      field: "retry.role",
      message: "retry.role is required and must be a non-empty string",
    });
  }

  if (!isPositiveInteger(retry.maxAttempts)) {
    errors.push({
      field: "retry.maxAttempts",
      message: "retry.maxAttempts must be a positive integer",
    });
  }

  return errors;
}

/** Validate the `transitions` field. */
function validateTransitions(value: unknown): WorkflowValidationResult["errors"] {
  const errors: WorkflowValidationResult["errors"] = [];

  if (!Array.isArray(value)) {
    errors.push({
      field: "transitions",
      message: "transitions must be an array",
    });
    return errors;
  }

  const allowedKeys = new Set<string>(["from", "on", "to"]);

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];

    if (!isPlainObject(entry)) {
      errors.push({
        field: `transitions[${i}]`,
        message: "each transition must be an object",
      });
      continue;
    }

    const transition = entry as Record<string, unknown>;

    for (const key of Object.keys(transition)) {
      if (!allowedKeys.has(key)) {
        errors.push({
          field: `transitions[${i}].${key}`,
          message: `unknown field "${key}" in transition`,
        });
      }
    }

    if (!isNonEmptyString(transition.from)) {
      errors.push({
        field: `transitions[${i}].from`,
        message: "transition.from is required and must be a non-empty string",
      });
    }
    if (!isNonEmptyString(transition.on)) {
      errors.push({
        field: `transitions[${i}].on`,
        message: "transition.on is required and must be a non-empty string",
      });
    }
    if (!isNonEmptyString(transition.to)) {
      errors.push({
        field: `transitions[${i}].to`,
        message: "transition.to is required and must be a non-empty string",
      });
    }
  }

  return errors;
}

/** Validate the `approval` field. */
function validateApprovalPoints(value: unknown): WorkflowValidationResult["errors"] {
  const errors: WorkflowValidationResult["errors"] = [];

  if (!Array.isArray(value)) {
    errors.push({
      field: "approval",
      message: "approval must be an array",
    });
    return errors;
  }

  const allowedKeys = new Set<string>(["step", "when"]);

  for (let i = 0; i < value.length; i++) {
    const entry = value[i];

    if (!isPlainObject(entry)) {
      errors.push({
        field: `approval[${i}]`,
        message: "each approval point must be an object",
      });
      continue;
    }

    const point = entry as Record<string, unknown>;

    for (const key of Object.keys(point)) {
      if (!allowedKeys.has(key)) {
        errors.push({
          field: `approval[${i}].${key}`,
          message: `unknown field "${key}" in approval point`,
        });
      }
    }

    if (!isNonEmptyString(point.step)) {
      errors.push({
        field: `approval[${i}].step`,
        message: "approval.step is required and must be a non-empty string",
      });
    }
    if (!isNonEmptyString(point.when)) {
      errors.push({
        field: `approval[${i}].when`,
        message: "approval.when is required and must be a non-empty string",
      });
    }
  }

  return errors;
}
