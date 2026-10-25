import { describe, expect, it } from "vitest";
import { SUPPORTED_WORKFLOW_FIELDS, WORKFLOW_SCHEMA_VERSION } from "@/workflows/types.js";
import { validateTemplate } from "@/workflows/validation.js";

describe("validateTemplate", () => {
  describe("valid templates", () => {
    it("accepts a minimal template with just name and steps", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["product-owner", "developer", "qa"],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts a template with explicit version", () => {
      const result = validateTemplate({
        name: "ui",
        version: 1,
        steps: ["product-owner", "designer", "developer", "qa"],
      });
      expect(result.valid).toBe(true);
    });

    it("accepts a template with version greater than 1", () => {
      const result = validateTemplate({
        name: "custom",
        version: 2,
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("required fields", () => {
    it("rejects missing name", () => {
      const result = validateTemplate({
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "name" }));
    });

    it("rejects empty name", () => {
      const result = validateTemplate({
        name: "",
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "name" }));
    });

    it("rejects whitespace-only name", () => {
      const result = validateTemplate({
        name: "   ",
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "name" }));
    });

    it("rejects non-string name (number)", () => {
      const result = validateTemplate({
        name: 123,
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "name" }));
    });

    it("rejects missing steps", () => {
      const result = validateTemplate({
        name: "default",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "steps" }));
    });

    it("rejects empty steps array", () => {
      const result = validateTemplate({
        name: "default",
        steps: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "steps" }));
    });

    it("rejects non-array steps (string)", () => {
      const result = validateTemplate({
        name: "default",
        steps: "developer",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "steps" }));
    });

    it("rejects steps with empty strings", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", ""],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "steps[1]" }));
    });

    it("rejects steps with non-string entries", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", 123],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "steps[1]" }));
    });

    it("reports all missing required fields at once", () => {
      const result = validateTemplate({});
      expect(result.valid).toBe(false);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain("name");
      expect(fields).toContain("steps");
    });
  });

  describe("version validation", () => {
    it("accepts a positive integer version", () => {
      const result = validateTemplate({
        name: "default",
        version: 5,
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(true);
    });

    it("rejects string version", () => {
      const result = validateTemplate({
        name: "default",
        version: "1",
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "version" }));
    });

    it("rejects zero version", () => {
      const result = validateTemplate({
        name: "default",
        version: 0,
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "version" }));
    });

    it("rejects negative version", () => {
      const result = validateTemplate({
        name: "default",
        version: -1,
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "version" }));
    });

    it("rejects float version", () => {
      const result = validateTemplate({
        name: "default",
        version: 1.5,
        steps: ["developer", "qa"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "version" }));
    });
  });

  describe("unknown fields", () => {
    it("rejects unknown top-level field", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        unknownField: "value",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "unknownField" }));
    });

    it("rejects multiple unknown top-level fields", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        foo: 1,
        bar: 2,
      });
      expect(result.valid).toBe(false);
      const fields = result.errors.map((e) => e.field);
      expect(fields).toContain("foo");
      expect(fields).toContain("bar");
    });

    it("rejects unknown field alongside valid fields", () => {
      const result = validateTemplate({
        name: "default",
        version: 1,
        steps: ["developer", "qa"],
        description: "a description",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "description" }));
    });

    it("rejects unknown nested field in retry", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        retry: { role: "developer", maxAttempts: 3, extra: true },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "retry.extra" }));
    });

    it("rejects unknown nested field in transition", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        transitions: [{ from: "qa", on: "failed", to: "developer", extra: true }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "transitions[0].extra" }),
      );
    });

    it("rejects unknown nested field in approval point", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        approval: [{ step: "qa", when: "passed", extra: true }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "approval[0].extra" }));
    });
  });

  describe("optional field validation", () => {
    it("rejects optional with non-array value", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        optional: "designer",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "optional" }));
    });

    it("rejects optional with non-string entry", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        optional: ["designer", 123],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "optional[1]" }));
    });
  });

  describe("retry field validation", () => {
    it("rejects retry with non-object value", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        retry: "invalid",
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "retry" }));
    });

    it("rejects retry with missing role", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        retry: { maxAttempts: 3 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "retry.role" }));
    });

    it("rejects retry with missing maxAttempts", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        retry: { role: "developer" },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "retry.maxAttempts" }));
    });

    it("rejects retry with zero maxAttempts", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        retry: { role: "developer", maxAttempts: 0 },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "retry.maxAttempts" }));
    });

    it("rejects retry with string maxAttempts", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        retry: { role: "developer", maxAttempts: "3" },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "retry.maxAttempts" }));
    });
  });

  describe("transitions field validation", () => {
    it("rejects transitions with non-array value", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        transitions: { from: "qa", on: "failed" },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "transitions" }));
    });

    it("rejects transition entry that is not an object", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        transitions: ["not-an-object"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "transitions[0]" }));
    });

    it("rejects transition with missing from", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        transitions: [{ on: "failed", to: "developer" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ field: "transitions[0].from" }),
      );
    });
  });

  describe("approval field validation", () => {
    it("rejects approval with non-array value", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        approval: { step: "qa", when: "passed" },
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "approval" }));
    });

    it("rejects approval entry that is not an object", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        approval: ["not-an-object"],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "approval[0]" }));
    });

    it("rejects approval with missing step", () => {
      const result = validateTemplate({
        name: "default",
        steps: ["developer", "qa"],
        approval: [{ when: "passed" }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: "approval[0].step" }));
    });
  });

  describe("non-object input", () => {
    it("rejects null", () => {
      const result = validateTemplate(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects undefined", () => {
      const result = validateTemplate(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects arrays", () => {
      const result = validateTemplate(["name", "steps"]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects strings", () => {
      const result = validateTemplate("not a template");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects numbers", () => {
      const result = validateTemplate(42);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects booleans", () => {
      const result = validateTemplate(true);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("constants", () => {
    it("exports the supported workflow fields including all reserved fields", () => {
      expect(SUPPORTED_WORKFLOW_FIELDS).toContain("name");
      expect(SUPPORTED_WORKFLOW_FIELDS).toContain("version");
      expect(SUPPORTED_WORKFLOW_FIELDS).toContain("steps");
      expect(SUPPORTED_WORKFLOW_FIELDS).toContain("optional");
      expect(SUPPORTED_WORKFLOW_FIELDS).toContain("retry");
      expect(SUPPORTED_WORKFLOW_FIELDS).toContain("transitions");
      expect(SUPPORTED_WORKFLOW_FIELDS).toContain("approval");
    });

    it("exports the default schema version of 1", () => {
      expect(WORKFLOW_SCHEMA_VERSION).toBe(1);
    });
  });
});
