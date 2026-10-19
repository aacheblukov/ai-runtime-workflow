// Minimal YAML frontmatter parser and serializer.
//
// This is NOT a general-purpose YAML 1.2 implementation. It supports the subset
// used by work-item descriptors (and other simple frontmatter configs):
//
//   - Top-level mappings `key: value`
//   - Nested mappings via indentation
//   - Block sequences (`key:` followed by indented `- item` lines)
//   - Inline sequences (`key: [a, b, c]`)
//   - Scalar types: null, string (quoted/unquoted), number, boolean
//   - Comments (`#`)
//
// See docs/work-items.md for descriptor shape.

interface ParsedLine {
  indent: number;
  content: string;
}

/** Split text into logical lines with indentation info, skipping blanks/comments. */
function tokenize(text: string): ParsedLine[] {
  const lines = text.split("\n");
  const result: ParsedLine[] = [];

  for (const raw of lines) {
    const trimmed = raw.trimEnd();
    const content = trimmed.trim();
    if (content === "") {
      continue;
    }
    if (content.startsWith("#")) {
      continue;
    }
    const indent = trimmed.length - trimmed.trimStart().length;
    result.push({ indent, content });
  }

  return result;
}

class YamlParser {
  private lines: ParsedLine[] = [];
  private cursor = 0;

  parse(text: string): Record<string, unknown> {
    this.lines = tokenize(text);
    this.cursor = 0;
    if (this.lines.length === 0) {
      return {};
    }
    const baseIndent = this.peek()!.indent;
    const result = this.parseBlock(baseIndent);
    return (result as Record<string, unknown>) ?? {};
  }

  private peek(): ParsedLine | undefined {
    return this.lines[this.cursor];
  }

  private next(): ParsedLine | undefined {
    return this.lines[this.cursor++];
  }

  private parseBlock(indent: number): unknown {
    const line = this.peek();
    if (!line) {
      return null;
    }
    if (line.indent !== indent) {
      return null;
    }
    if (line.content.startsWith("- ") || line.content === "-") {
      return this.parseSequence(indent);
    }
    return this.parseMapping(indent);
  }

  private parseMapping(indent: number): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    while (this.peek() && this.peek()!.indent === indent && !this.isSequenceEntry(this.peek()!)) {
      const line = this.next()!;
      const [key, value] = this.splitKeyValue(line.content);

      if (value === undefined) {
        const next = this.peek();
        if (next && next.indent > indent) {
          result[key] = this.parseBlock(next.indent);
        } else {
          result[key] = null;
        }
      } else {
        result[key] = this.parseInlineValue(value);
      }
    }

    return result;
  }

  private parseSequence(indent: number): unknown[] {
    const result: unknown[] = [];

    while (this.peek() && this.peek()!.indent === indent && this.isSequenceEntry(this.peek()!)) {
      const line = this.next()!;
      const itemContent = line.content.startsWith("- ")
        ? line.content.slice(2).trim()
        : "";

      if (itemContent === "") {
        const next = this.peek();
        if (next && next.indent > indent) {
          result.push(this.parseBlock(next.indent));
        } else {
          result.push(null);
        }
      } else {
        result.push(this.parseInlineValue(itemContent));
      }
    }

    return result;
  }

  private isSequenceEntry(line: ParsedLine): boolean {
    return line.content.startsWith("- ") || line.content === "-";
  }

  private splitKeyValue(content: string): [string, string | undefined] {
    const colonIdx = content.indexOf(":");
    if (colonIdx === -1) {
      return [content, undefined];
    }
    const key = content.slice(0, colonIdx).trim();
    const rawValue = content.slice(colonIdx + 1).trim();
    return [key, rawValue === "" ? undefined : rawValue];
  }

  private parseInlineValue(text: string): unknown {
    text = text.trim();
    if (text === "") {
      return null;
    }

    // Inline array: [a, b, c]
    if (text.startsWith("[") && text.endsWith("]")) {
      const inner = text.slice(1, -1).trim();
      if (inner === "") {
        return [];
      }
      return inner.split(",").map((s) => this.parseScalar(s.trim()));
    }

    // Quoted strings
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      return text.slice(1, -1);
    }

    return this.parseScalar(text);
  }

  private parseScalar(text: string): string | number | boolean | null {
    text = text.trim();
    if (text === "" || text === "null" || text === "~") {
      return null;
    }
    if (text === "true") {
      return true;
    }
    if (text === "false") {
      return false;
    }
    if (/^-?\d+$/.test(text)) {
      return parseInt(text, 10);
    }
    if (/^-?\d+\.\d+$/.test(text)) {
      return parseFloat(text);
    }
    return text;
  }
}

/** Parse a YAML string into a JavaScript object. */
export function parseYaml(text: string): Record<string, unknown> {
  return new YamlParser().parse(text);
}

/** Format a scalar value for YAML output. */
function formatScalar(value: unknown): string {
  if (typeof value === "string") {
    if (value === "") {
      return '""';
    }
    if (
      /^-?\d+$|^[-?:,[\]{}#&*!|>'"%@`]/.test(value) ||
      value.includes(": ") ||
      value.includes("\n")
    ) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value.toString();
  }
  if (value === null || value === undefined) {
    return "null";
  }
  return String(value);
}

/** Serialize a plain object to YAML lines. */
export function serializeYaml(
  data: Record<string, unknown>,
  indent: number,
  lines: string[],
): void {
  const padding = " ".repeat(indent);

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      lines.push(`${padding}${key}:`);
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${padding}${key}: []`);
        continue;
      }
      lines.push(`${padding}${key}:`);
      const childPadding = " ".repeat(indent + 2);
      for (const item of value) {
        lines.push(`${childPadding}- ${formatScalar(item)}`);
      }
      continue;
    }

    if (typeof value === "object" && value !== null) {
      lines.push(`${padding}${key}:`);
      serializeYaml(value as Record<string, unknown>, indent + 2, lines);
      continue;
    }

    lines.push(`${padding}${key}: ${formatScalar(value)}`);
  }
}

/**
 * Parse a markdown file with YAML frontmatter.
 * Returns the parsed metadata object and the markdown body.
 */
export function parseFrontmatter(
  content: string,
): { data: Record<string, unknown>; body: string } {
  const lines = content.split("\n");

  // Files without a leading --- delimiter have no frontmatter.
  if (lines[0] !== "---") {
    return { data: {}, body: content };
  }

  // Find the closing --- delimiter on its own line.
  let closingIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") {
      closingIdx = i;
      break;
    }
  }

  if (closingIdx === -1) {
    const yamlText = lines.slice(1).join("\n");
    return { data: parseYaml(yamlText), body: "" };
  }

  const yamlText = lines.slice(1, closingIdx).join("\n");
  const body = lines.slice(closingIdx + 1).join("\n").replace(/^\n+/, "");

  return { data: parseYaml(yamlText), body };
}

/** Serialize metadata + markdown body into a markdown file with YAML frontmatter. */
export function serializeFrontmatter(
  data: Record<string, unknown>,
  body: string,
): string {
  const lines: string[] = [];
  lines.push("---");
  serializeYaml(data, 0, lines);
  lines.push("---");
  if (body) {
    lines.push("");
    lines.push(body);
  }
  return lines.join("\n");
}
