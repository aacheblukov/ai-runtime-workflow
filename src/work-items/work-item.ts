// Work Item entity: the executable unit of work ("what needs to be done").
// See docs/work-items.md for the authoritative description of the model.

import { join } from "node:path";
import type { Filesystem } from "@/storage/filesystem.js";
import { parseFrontmatter, serializeFrontmatter } from "./yaml.js";
import { validate as validateMetadata } from "./validation.js";
import type {
  Bug,
  CreateBugOptions,
  CreateFeatureOptions,
  Feature,
  WorkItemMetadata,
  WorkItemRecord,
  WorkItemView,
  WorkItemType,
  ValidationResult,
} from "./types.js";

// Re-export types so callers (tests, runtime, CLI) can reference them from one module.
export type {
  Bug,
  CreateBugOptions,
  CreateFeatureOptions,
  Feature,
  WorkflowSelection,
  WorkItemMetadata,
  WorkItemRecord,
  WorkItemView,
  WorkItemStatus,
  WorkItemType,
  ValidationResult,
} from "./types.js";

/** Regex for valid work-item directory names, e.g. `FEAT-001`, `BUG-001`. */
const ID_DIR_PATTERN = /^(FEAT|BUG)-\d{3,}$/;

/**
 * A Work Item is an executable unit of work against a target project.
 *
 * It encapsulates the work item's metadata (parsed from the descriptor
 * frontmatter), the markdown body, and on-disk locations. Persistence is
 * handled through the `Filesystem` abstraction.
 *
 * See `docs/work-items.md` for the full model.
 */
export class WorkItem {
  readonly #root: string;
  readonly #descriptorPath: string;
  #metadata: WorkItemMetadata;
  #body: string;

  constructor(record: WorkItemRecord) {
    this.#root = record.root;
    this.#descriptorPath = record.descriptorPath;
    this.#metadata = record.metadata;
    this.#body = record.body;
  }

  // ── Public properties ───────────────────────────────────────────────

  /** Absolute path to the work item root directory. */
  get root(): string {
    return this.#root;
  }

  /** Absolute path to the descriptor file (`feature.md` or `bug.md`). */
  get descriptorPath(): string {
    return this.#descriptorPath;
  }

  /** Work item identifier, e.g. `FEAT-001`. */
  get id(): string {
    return this.#metadata.id;
  }

  /** Work item type: `"feature"` or `"bug"`. */
  get type(): WorkItemType {
    return this.#metadata.type;
  }

  /** Parsed metadata from the descriptor frontmatter. */
  get metadata(): WorkItemView {
    return this.#metadata as WorkItemView;
  }

  /** Markdown body of the descriptor file (text after the frontmatter). */
  get body(): string {
    return this.#body;
  }

  set body(value: string) {
    this.#body = value;
  }

  // ── Instance methods ───────────────────────────────────────────────

  /** Validate this work item's metadata against the structural rules. */
  validate(): ValidationResult {
    return validateMetadata(this.#metadata);
  }

  /** Write the work item descriptor to disk. */
  async save(filesystem: Filesystem): Promise<void> {
    const content = serializeFrontmatter(
      this.#metadata as unknown as Record<string, unknown>,
      this.#body,
    );
    await filesystem.writeFile(this.#descriptorPath, content);
  }

  // ── Static helpers ───────────────────────────────────────────────

  /** Return the descriptor file name for a given work item type. */
  static descriptorFile(type: WorkItemType): string {
    return type === "feature" ? "feature.md" : "bug.md";
  }

  /** Return the ID prefix for a given work item type. */
  static typePrefix(type: WorkItemType): string {
    return type === "feature" ? "FEAT" : "BUG";
  }

  /**
   * Generate the next available work item ID of the given type.
   *
   * IDs of the other type are ignored. The highest existing numeric
   * suffix is found and incremented. New IDs are padded to at least
   * three digits.
   */
  static generateId(type: WorkItemType, existingIds: string[]): string {
    const prefix = WorkItem.typePrefix(type);
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);

    let max = 0;
    for (const id of existingIds) {
      const match = id.match(pattern);
      if (match) {
        const num = Number.parseInt(match[1]!, 10);
        if (num > max) {
          max = num;
        }
      }
    }

    const next = max + 1;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  }

  /**
   * Load a work item from disk by scanning its root directory for a
   * descriptor file. `feature.md` is preferred over `bug.md` when both
   * exist.
   *
   * @throws Error with "no descriptor" when neither file is found.
   */
  static async load(filesystem: Filesystem, root: string): Promise<WorkItem> {
    // Prefer feature.md, then fall back to bug.md.
    const featurePath = join(root, "feature.md");
    try {
      const content = await filesystem.readFile(featurePath);
      const { data, body } = parseFrontmatter(content);
      return new WorkItem({
        root,
        descriptorPath: featurePath,
        metadata: data as unknown as WorkItemMetadata,
        body,
      });
    } catch {
      // feature.md not found — try bug.md next.
    }

    const bugPath = join(root, "bug.md");
    try {
      const content = await filesystem.readFile(bugPath);
      const { data, body } = parseFrontmatter(content);
      return new WorkItem({
        root,
        descriptorPath: bugPath,
        metadata: data as unknown as WorkItemMetadata,
        body,
      });
    } catch {
      // bug.md not found either.
    }

    throw new Error(
      `No descriptor file found in ${root} (expected feature.md or bug.md)`,
    );
  }

  /**
   * Create a new feature work item on disk with a generated ID.
   *
   * Scans the project's `features/` directory for existing IDs, generates
   * the next one, creates the work item directory and descriptor file,
   * and returns the loaded `WorkItem`.
   */
  static async createFeature(
    filesystem: Filesystem,
    projectRoot: string,
    options: CreateFeatureOptions,
  ): Promise<WorkItem> {
    const featuresDir = join(projectRoot, "features");
    const existingIds = await WorkItem.scanExistingIds(filesystem, featuresDir);
    const id = WorkItem.generateId("feature", existingIds);

    const root = join(featuresDir, id);
    const descriptorPath = join(root, "feature.md");

    const now = new Date().toISOString();
    const metadata: Feature = {
      id,
      type: "feature",
      title: options.title,
      description: options.description,
      createdAt: now,
      updatedAt: now,
      ...(options.request !== undefined && { request: options.request }),
      ...(options.capabilities !== undefined && {
        capabilities: options.capabilities,
      }),
      ...(options.workflow !== undefined && { workflow: options.workflow }),
    };

    const workItem = new WorkItem({
      root,
      descriptorPath,
      metadata,
      body: "",
    });

    await workItem.save(filesystem);
    return workItem;
  }

  /**
   * Create a new bug work item on disk with a generated ID.
   *
   * Scans the project's `bugs/` directory for existing IDs, generates
   * the next one, creates the work item directory and descriptor file,
   * and returns the loaded `WorkItem`.
   */
  static async createBug(
    filesystem: Filesystem,
    projectRoot: string,
    options: CreateBugOptions,
  ): Promise<WorkItem> {
    const bugsDir = join(projectRoot, "bugs");
    const existingIds = await WorkItem.scanExistingIds(filesystem, bugsDir);
    const id = WorkItem.generateId("bug", existingIds);

    const root = join(bugsDir, id);
    const descriptorPath = join(root, "bug.md");

    const now = new Date().toISOString();
    const metadata: Bug = {
      id,
      type: "bug",
      title: options.title,
      description: options.description,
      createdAt: now,
      updatedAt: now,
      ...(options.source !== undefined && { source: options.source }),
      ...(options.workflow !== undefined && { workflow: options.workflow }),
    };

    const workItem = new WorkItem({
      root,
      descriptorPath,
      metadata,
      body: "",
    });

    await workItem.save(filesystem);
    return workItem;
  }

  // ── Private helpers ───────────────────────────────────────────────

  /**
   * List existing work-item IDs (directory names matching `FEAT-NNN`
   * or `BUG-NNN`) inside a directory. Returns an empty array when the
   * directory does not exist.
   */
  private static async scanExistingIds(
    filesystem: Filesystem,
    directory: string,
  ): Promise<string[]> {
    try {
      const entries = await filesystem.listDirectory(directory);
      return entries.filter((entry) => ID_DIR_PATTERN.test(entry));
    } catch {
      return [];
    }
  }
}
