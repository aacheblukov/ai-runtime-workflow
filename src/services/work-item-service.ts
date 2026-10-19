import { join } from "node:path";
import type { Filesystem } from "@/storage/filesystem.js";
import { WorkItem } from "@/work-items/work-item.js";
import { validateProjectName } from "@/services/validation.js";

const DEFAULT_BACKLOG = "# Backlog\n\n## Features\n\n## Bugs\n";

export class WorkItemService {
  constructor(private readonly filesystem: Filesystem) {}

  private formatBacklogEntry(id: string, request: string): string {
    return `- [ ] ${id} — ${request}`;
  }

  private async projectExists(projectRoot: string): Promise<boolean> {
    try {
      await this.filesystem.readFile(join(projectRoot, "project.md"));
      return true;
    } catch {
      return false;
    }
  }

  private validateRequest(request: string): void {
    if (typeof request !== "string" || request.trim().length === 0) {
      throw new Error("Request must be a non-empty string");
    }
  }

  async appendFeatureToBacklog(
    backlogPath: string,
    id: string,
    request: string,
  ): Promise<void> {
    let contents: string;
    try {
      contents = await this.filesystem.readFile(backlogPath);
    } catch {
      contents = DEFAULT_BACKLOG;
    }

    const alreadyListed = contents
      .split("\n")
      .some(
        (line) =>
          line.startsWith(`- [ ] ${id}`) || line.startsWith(`- [x] ${id}`),
      );
    if (alreadyListed) {
      return;
    }

    const entry = this.formatBacklogEntry(id, request);
    const lines = contents.split("\n");
    const featuresIdx = lines.findIndex(
      (line) => line.trim() === "## Features",
    );

    let updated: string;
    if (featuresIdx === -1) {
      const trimmed = contents.replace(/\n+$/, "");
      updated = `${trimmed}\n\n## Features\n\n${entry}\n`;
    } else {
      lines.splice(featuresIdx + 1, 0, entry);
      updated = lines.join("\n");
    }

    await this.filesystem.writeFile(backlogPath, updated);
  }

  async createFeature(
    targetProject: string,
    request: string,
  ): Promise<WorkItem> {
    validateProjectName(targetProject);
    this.validateRequest(request);

    const projectRoot = join("projects", targetProject);

    if (!(await this.projectExists(projectRoot))) {
      throw new Error(`Project "${targetProject}" does not exist.`);
    }

    const workItem = await WorkItem.createFeature(
      this.filesystem,
      projectRoot,
      {
        title: request,
        description: request,
        request,
      },
    );

    await this.filesystem.createDirectory(join(workItem.root, "runtime"));
    await this.appendFeatureToBacklog(
      join(projectRoot, "backlog.md"),
      workItem.id,
      request,
    );

    return workItem;
  }
}
