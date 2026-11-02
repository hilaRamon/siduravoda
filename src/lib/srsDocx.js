import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const RTL = AlignmentType.RIGHT;
const HEADING_LEVEL = {
  1: HeadingLevel.TITLE,
  2: HeadingLevel.HEADING_1,
  3: HeadingLevel.HEADING_2,
  4: HeadingLevel.HEADING_3,
  5: HeadingLevel.HEADING_4,
  6: HeadingLevel.HEADING_5,
};

function parseMarkdown(markdown) {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

function runsFrom(nodes, opts = {}) {
  const out = [];
  for (const node of nodes || []) {
    out.push(...runFrom(node, opts));
  }
  return out;
}

function runFrom(node, opts) {
  const size = opts.size ?? 22;
  const bold = Boolean(opts.bold);
  const italics = Boolean(opts.italics);
  const font = opts.font;
  const base = { size, bold, italics, font, rightToLeft: !font };

  if (node.type === "text") {
    return [new TextRun({ ...base, text: node.value })];
  }
  if (node.type === "strong") {
    return runsFrom(node.children, { ...opts, bold: true });
  }
  if (node.type === "emphasis") {
    return runsFrom(node.children, { ...opts, italics: true });
  }
  if (node.type === "delete") {
    return runsFrom(node.children, opts);
  }
  if (node.type === "inlineCode") {
    return [
      new TextRun({
        text: node.value,
        size,
        bold,
        italics,
        font: "Consolas",
        rightToLeft: false,
      }),
    ];
  }
  if (node.type === "link") {
    const linked = runsFrom(node.children, opts);
    if (linked.length > 0) return linked;
    return [new TextRun({ ...base, text: node.url || "" })];
  }
  if (node.type === "break") {
    return [new TextRun({ break: 1 })];
  }
  if (node.children) return runsFrom(node.children, opts);
  return [];
}

function paragraphFrom(children, extra = {}, runOpts = {}) {
  const runs = runsFrom(children, runOpts);
  return new Paragraph({
    children: runs.length ? runs : [new TextRun({ text: "" })],
    alignment: RTL,
    bidirectional: true,
    spacing: { after: 80 },
    ...extra,
  });
}

function renderBlocks(nodes, ctx = {}) {
  const out = [];
  for (const node of nodes || []) {
    out.push(...renderBlock(node, ctx));
  }
  return out;
}

function renderList(node, level) {
  const out = [];
  const start = node.start || 1;
  (node.children || []).forEach((item, index) => {
    const kids = item.children || [];
    let usedFirst = false;
    for (const child of kids) {
      if (child.type === "paragraph") {
        const prefix = !node.ordered
          ? []
          : [new TextRun({ text: `${start + index}. `, size: 22, rightToLeft: true })];
        const body = runsFrom(child.children);
        out.push(
          new Paragraph({
            children: [...prefix, ...(body.length ? body : [new TextRun("")])],
            bullet: node.ordered ? undefined : { level },
            alignment: RTL,
            bidirectional: true,
            spacing: { after: 60 },
          }),
        );
        usedFirst = true;
      } else if (child.type === "list") {
        out.push(...renderList(child, level + 1));
      } else if (!usedFirst) {
        out.push(...renderBlock(child, {}));
      }
    }
  });
  return out;
}

function renderTable(node) {
  const rows = node.children || [];
  if (rows.length === 0) return [];
  const columnCount = Math.max(
    ...rows.map((row) => (row.children || []).length),
    1,
  );
  const tableRows = rows.map((row, rowIndex) => {
    const cells = row.children || [];
    const padded = Array.from({ length: columnCount }, (_, i) => cells[i]);
    return new TableRow({
      tableHeader: rowIndex === 0,
      children: padded.map(
        (cell) =>
          new TableCell({
            width: { size: Math.floor(9000 / columnCount), type: WidthType.DXA },
            children: [
              cell
                ? cellParagraph(cell, rowIndex === 0)
                : new Paragraph({ text: "", bidirectional: true }),
            ],
          }),
      ),
    });
  });
  return [
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      visuallyRightToLeft: true,
      rows: tableRows,
    }),
    new Paragraph({ text: "", spacing: { after: 120 } }),
  ];
}

function cellParagraph(cell, header) {
  const kids = cell.children || [];
  if (kids[0]?.type === "paragraph") {
    return paragraphFrom(kids[0].children, { spacing: { after: 40 } }, { bold: header, size: 18 });
  }
  return paragraphFrom(kids, { spacing: { after: 40 } }, { bold: header, size: 18 });
}

function renderBlock(node, ctx) {
  if (!node) return [];
  if (node.type === "heading") {
    const depth = Math.min(Math.max(node.depth || 1, 1), 6);
    return [
      paragraphFrom(node.children, {
        heading: HEADING_LEVEL[depth],
        spacing: { before: depth === 1 ? 0 : 280, after: 120 },
        border:
          depth === 2
            ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: "3b4fa8" } }
            : undefined,
      }),
    ];
  }
  if (node.type === "paragraph") {
    return [
      paragraphFrom(
        node.children,
        ctx.quote
          ? {
              italics: undefined,
              indent: { right: 360 },
              border: { right: { style: BorderStyle.SINGLE, size: 12, color: "3b4fa8" } },
            }
          : {},
        ctx.quote ? { italics: true } : {},
      ),
    ];
  }
  if (node.type === "list") return renderList(node, 0);
  if (node.type === "blockquote") return renderBlocks(node.children, { quote: true });
  if (node.type === "code") {
    const lines = String(node.value || "").split("\n");
    return lines.map(
      (line) =>
        new Paragraph({
          children: [
            new TextRun({
              text: line.length ? line : " ",
              font: "Consolas",
              size: 18,
              rightToLeft: false,
            }),
          ],
          alignment: AlignmentType.LEFT,
          bidirectional: false,
          spacing: { after: 0 },
        }),
    );
  }
  if (node.type === "thematicBreak") {
    return [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
        spacing: { before: 160, after: 160 },
      }),
    ];
  }
  if (node.type === "table") return renderTable(node);
  if (node.type === "html" || node.type === "definition") return [];
  if (node.children) return renderBlocks(node.children, ctx);
  return [];
}

export async function markdownToDocxBlob(markdown) {
  const tree = parseMarkdown(markdown);
  const children = renderBlocks(tree.children);
  const doc = new Document({
    sections: [
      {
        properties: { bidi: true },
        children: children.length
          ? children
          : [new Paragraph({ text: "", bidirectional: true })],
      },
    ],
  });
  return Packer.toBlob(doc);
}
