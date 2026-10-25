// Workflow template loader.
// Reads, parses, and validates workflow templates from the filesystem.
// See docs/workflows.md for the template resolution flow.

import type { Filesystem } from "@/storage/filesystem.js";
import { parseYaml } from "@/work-items/yaml.js";
import type { WorkflowTemplate } from "./types.js";
import { WORKFLOW_SCHEMA_VERSION } from "./types.js";
import { validateTemplate } from "./validation.js";

/**
 * Loads workflow templates from a directory of YAML files.
 *
 * Each template file is named `<name>.yaml` and contains a YAML mapping
 * that is parsed and validated into a {@link WorkflowTemplate}.
 */
export class WorkflowLoader {
  constructor(
    private readonly filesystem: Filesystem,
    private readonly templatesDir: string,
  ) {}

  /**
   * Load and validate a workflow template by name.
   *
   * @param name The template name (filename without `.yaml` extension).
   * @returns The validated workflow template with defaults applied.
   * @throws {Error} If the template file cannot be read, the YAML is
   *   invalid, or the template fails validation.
   */
  async load(name: string): Promise<WorkflowTemplate> {
    this.assertValidName(name);

    const path = `${this.templatesDir}/${name}.yaml`;

    let content: string;
    try {
      content = await this.filesystem.readFile(path);
    } catch {
      throw new Error(`Workflow template not found: "${name}"`);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseYaml(content);
    } catch {
      throw new Error(`Failed to parse workflow template: "${name}"`);
    }

    const result = validateTemplate(parsed);
    if (!result.valid) {
      const details = result.errors.map((e) => `  ${e.field}: ${e.message}`).join("\n");
      throw new Error(`Invalid workflow template "${name}":\n${details}`);
    }

    // Apply defaults — version defaults to 1 when not specified.
    return buildTemplate(parsed);
  }

  /**
   * List all available template names in the templates directory.
   *
   * Returns only `.yaml` files (not `.yml`), sorted alphabetically.
   * Returns an empty array if the directory does not exist.
   *
   * Does NOT parse or validate individual templates — use {@link load}
   * to validate a specific template.
   */
  async list(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await this.filesystem.listDirectory(this.templatesDir);
    } catch {
      return [];
    }

    return entries
      .filter((entry) => entry.endsWith(".yaml"))
      .map((entry) => entry.replace(/\.yaml$/, ""))
      .sort();
  }

  /**
   * Guard against path traversal in the template name.
   * Only allows alphanumeric, hyphen, and underscore characters.
   */
  private assertValidName(name: string): void {
    if (name.includes("/") || name.includes("\\") || name.includes("..")) {
      throw new Error(
        `Invalid workflow template name: "${name}" — names must not contain path separators or parent-directory references`,
      );
    }
  }
}

/**
 * Construct a {@link WorkflowTemplate} from a validated plain object,
 * applying default values where fields are absent.
 */
function buildTemplate(parsed: Record<string, unknown>): WorkflowTemplate {
  const template: WorkflowTemplate = {
    name: parsed.name as string,
    version: parsed.version !== undefined ? (parsed.version as number) : WORKFLOW_SCHEMA_VERSION,
    steps: parsed.steps as string[],
  };

  if (parsed.optional !== undefined) {
    template.optional = parsed.optional as string[];
  }
  if (parsed.retry !== undefined) {
    template.retry = parsed.retry as {
      role: string;
      maxAttempts: number;
    };
  }
  if (parsed.transitions !== undefined) {
    template.transitions = parsed.transitions as Array<{
      from: string;
      on: string;
      to: string;
    }>;
  }
  if (parsed.approval !== undefined) {
    template.approval = parsed.approval as Array<{
      step: string;
      when: string;
    }>;
  }

  return template;
}
