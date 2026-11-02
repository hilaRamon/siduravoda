/**
 * Helpers for the single system spec (src/docs/SRS_Regivim_System.md).
 * Heading ids follow the GitHub slug rules used by the document's table of contents.
 */

const SLUG_DROP = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;

export function parseSrsVersion(markdown) {
  const match = String(markdown).match(/גרסה\s+(\d+(?:\.\d+)*)/);
  return match ? match[1] : "";
}

export function slugifyHeading(text) {
  return String(text)
    .toLowerCase()
    .replace(SLUG_DROP, "")
    .replace(/ /g, "-");
}

/**
 * Title and note stay above the chapters. Each ## heading is one chapter.
 * @returns {{ title: string, preamble: string, chapters: { id: string, title: string, markdown: string }[] }}
 */
export function splitMarkdownChapters(markdown) {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const preamble = [];
  /** @type {{ title: string, lines: string[] } | null} */
  let current = null;
  const rawChapters = [];

  for (const line of lines) {
    if (line.startsWith("# ") && !line.startsWith("## ") && !title) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      if (current) rawChapters.push(current);
      current = { title: line.slice(3).trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) rawChapters.push(current);

  const counts = new Map();
  const chapters = rawChapters.map((chapter) => {
    const base = slugifyHeading(chapter.title) || "section";
    const seen = counts.get(base) || 0;
    counts.set(base, seen + 1);
    return {
      id: seen === 0 ? base : `${base}-${seen}`,
      title: chapter.title,
      markdown: chapter.lines.join("\n").trim(),
    };
  });

  return {
    title,
    preamble: preamble.join("\n").trim(),
    chapters,
  };
}

function headingPlainText(node) {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") return node.value || "";
  if (Array.isArray(node.children)) {
    return node.children.map(headingPlainText).join("");
  }
  return "";
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child, visit);
  }
}

/** remark plugin: set heading ids so in-document links resolve. */
export function remarkHeadingIds() {
  return (tree) => {
    const counts = new Map();
    walk(tree, (node) => {
      if (node.type !== "heading") return;
      const base = slugifyHeading(headingPlainText(node)) || "section";
      const seen = counts.get(base) || 0;
      counts.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen}`;
      node.data = node.data || {};
      node.data.hProperties = { ...(node.data.hProperties || {}), id };
    });
  };
}
