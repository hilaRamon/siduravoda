import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileText, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import userGuideMarkdown from "@/docs/UserGuide_Regivim.md?raw";
import developerMarkdown from "@/docs/SRS_Regivim_System.md?raw";
import { markdownToDocxBlob } from "@/lib/srsDocx";
import { chooseSliceEnds } from "@/lib/srsPdf";
import {
  parseSrsVersion,
  remarkHeadingIds,
  slugifyHeading,
  splitMarkdownChapters,
} from "@/lib/srsMarkdown";

const remarkPlugins = [remarkGfm, remarkHeadingIds];

const DOCUMENTS = [
  {
    id: "user",
    label: "מדריך למשתמש",
    markdown: userGuideMarkdown,
    downloadBase: "מדריך_משתמש_רגבים",
  },
  {
    id: "developer",
    label: "מפרט למפתחים",
    markdown: developerMarkdown,
    downloadBase: "מפרט_מערכת_רגבים",
  },
];

function headingClass(level) {
  if (level === 1) return "text-2xl font-bold text-foreground mb-3";
  if (level === 2) return "text-xl font-bold text-foreground mt-8 mb-3 pb-2 border-b border-border scroll-mt-4";
  if (level === 3) return "text-lg font-semibold text-primary mt-6 mb-2 scroll-mt-4";
  return "text-base font-semibold text-foreground mt-4 mb-2 scroll-mt-4";
}

function createComponents(withIds, forPrint = false) {
  const blockProps = forPrint ? { "data-pdf-block": "true" } : {};
  const heading = (level) =>
    function MarkdownHeading({ id, children }) {
      const Tag = `h${level}`;
      return (
        <Tag
          id={withIds ? id : undefined}
          className={headingClass(level)}
          {...blockProps}
          {...(forPrint && level === 2 ? { "data-pdf-chapter": "true" } : {})}
        >
          {children}
        </Tag>
      );
    };

  return {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    p: ({ children }) => (
      <p className="my-2 leading-relaxed" {...blockProps}>
        {children}
      </p>
    ),
    a: ({ href, children }) => (
      <a href={href} className="text-primary underline underline-offset-2">
        {children}
      </a>
    ),
    ul: ({ children }) => <ul className="list-disc pr-5 my-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pr-5 my-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li {...blockProps}>{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-r-4 border-primary/40 pr-3 my-3 text-muted-foreground" {...blockProps}>
        {children}
      </blockquote>
    ),
    hr: () => (forPrint ? null : <hr className="my-6 border-border" />),
    pre: ({ children }) => (
      <pre className="bg-secondary rounded-lg p-3 overflow-x-auto text-xs my-3" dir="ltr" {...blockProps}>
        {children}
      </pre>
    ),
    code: ({ className, children }) => {
      if (className) {
        return <code className={className}>{children}</code>;
      }
      return (
        <code className="bg-secondary rounded px-1 py-0.5 text-[0.85em]" dir="ltr">
          {children}
        </code>
      );
    },
    table: ({ children }) => (
      <div className="overflow-x-auto my-3">
        <table className="w-full text-sm border-collapse border border-border">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-secondary/60">{children}</thead>,
    tr: ({ children }) => <tr {...blockProps}>{children}</tr>,
    th: ({ children }) => (
      <th className="border border-border px-2 py-1.5 text-right font-semibold align-top">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-2 py-1.5 text-right align-top">{children}</td>
    ),
  };
}

const screenComponents = createComponents(true);
const printComponents = createComponents(false, true);

function MarkdownBlock({ markdown, components }) {
  if (!markdown) return null;
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}

const sectionStyle = {
  width: "794px",
  boxSizing: "border-box",
  padding: "24px",
  background: "#ffffff",
};

function PrintCopy({ markdown }) {
  const parsed = useMemo(() => splitMarkdownChapters(markdown), [markdown]);
  const [first, ...rest] = parsed.chapters;
  return (
    <article className="text-sm leading-relaxed text-foreground" dir="rtl">
      <section data-pdf-section="true" style={sectionStyle}>
        <h1 className={headingClass(1)}>{parsed.title}</h1>
        {parsed.preamble ? (
          <MarkdownBlock markdown={parsed.preamble} components={printComponents} />
        ) : null}
        {first ? (
          <>
            <h2 className="text-xl font-bold text-foreground mb-3 pb-2 border-b border-border">
              {first.title}
            </h2>
            <MarkdownBlock markdown={first.markdown} components={printComponents} />
          </>
        ) : null}
      </section>
      {rest.map((chapter) => (
        <section key={chapter.id} data-pdf-section="true" style={sectionStyle}>
          <h2 className="text-xl font-bold text-foreground mb-3 pb-2 border-b border-border">
            {chapter.title}
          </h2>
          <MarkdownBlock markdown={chapter.markdown} components={printComponents} />
        </section>
      ))}
    </article>
  );
}

function chapterOwnsAnchor(chapter, anchorId) {
  if (chapter.id === anchorId) return true;
  return chapter.markdown.split("\n").some((line) => {
    const match = /^(#{1,6})\s+(.+)$/.exec(line);
    return Boolean(match && slugifyHeading(match[2]) === anchorId);
  });
}

function ChapterAccordions({ markdown }) {
  const parsed = useMemo(() => splitMarkdownChapters(markdown), [markdown]);
  const [open, setOpen] = useState({});
  const [scrollTo, setScrollTo] = useState("");

  useEffect(() => {
    if (!scrollTo) return;
    const target = document.getElementById(scrollTo);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setScrollTo("");
  }, [scrollTo, open]);

  const handleClick = (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href") || "";
    if (!href.startsWith("#")) return;
    const anchorId = decodeURIComponent(href.slice(1));
    const chapter = parsed.chapters.find((item) => chapterOwnsAnchor(item, anchorId));
    if (!chapter) return;
    event.preventDefault();
    setOpen((prev) => ({ ...prev, [chapter.id]: true }));
    setScrollTo(anchorId);
  };

  return (
    <div className="space-y-3" onClick={handleClick}>
      {parsed.preamble ? (
        <MarkdownBlock markdown={parsed.preamble} components={screenComponents} />
      ) : null}
      {parsed.chapters.map((chapter) => {
        const isOpen = open[chapter.id] === true;
        return (
          <section key={chapter.id} className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setOpen((prev) => ({ ...prev, [chapter.id]: !isOpen }))
              }
              className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-secondary/40 hover:bg-secondary/70 transition-colors text-right"
              aria-expanded={isOpen}
            >
              <h2 id={chapter.id} className="font-bold text-base text-foreground scroll-mt-4">
                {chapter.title}
              </h2>
              <span className="text-muted-foreground text-lg shrink-0">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen ? (
              <div className="p-5 bg-card">
                <MarkdownBlock markdown={chapter.markdown} components={screenComponents} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function inkRows(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(height);
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const i = row + x * 4;
      if (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230) {
        mask[y] = 1;
        break;
      }
    }
  }
  return mask;
}

function subtitleFor(markdown) {
  const { title } = splitMarkdownChapters(markdown);
  const version = parseSrsVersion(markdown);
  return version ? `${title} — גרסה ${version}` : title;
}

export default function SRSViewer() {
  const printRef = useRef(null);
  const [docId, setDocId] = useState("user");
  const [exporting, setExporting] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const activeDoc = DOCUMENTS.find((item) => item.id === docId) || DOCUMENTS[0];

  const handleDownloadWord = async () => {
    setExportingWord(true);
    try {
      const blob = await markdownToDocxBlob(activeDoc.markdown);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${activeDoc.downloadBase}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingWord(false);
    }
  };

  const handleDownloadPdf = async () => {
    setExporting(true);
    const root = printRef.current;
    root.style.display = "block";
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentW = pageW - margin * 2;
      const contentH = pageH - margin * 2;
      const sections = [...root.querySelectorAll("[data-pdf-section]")];
      let pageIndex = 0;
      for (const section of sections) {
        const canvas = await html2canvas(section, {
          scale: 1,
          backgroundColor: "#ffffff",
          useCORS: true,
          windowWidth: 794,
          width: section.scrollWidth,
          height: section.scrollHeight,
        });
        const pxPerMM = canvas.width / contentW;
        const pageHeightPx = Math.floor(contentH * pxPerMM) - 12;
        const mask = inkRows(canvas);
        const cuts = chooseSliceEnds({
          height: canvas.height,
          pageHeight: pageHeightPx,
          isTextRow: (y) => mask[y] === 1,
        });
        let srcY = 0;
        for (const cut of cuts) {
          const top = Math.round(srcY);
          const end = Math.min(canvas.height, Math.max(top + 1, Math.round(cut)));
          const sliceH = end - top;
          const slice = window.document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          slice
            .getContext("2d")
            .drawImage(canvas, 0, top, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(
            slice.toDataURL("image/jpeg", 0.92),
            "JPEG",
            margin,
            margin,
            contentW,
            sliceH / pxPerMM,
          );
          srcY = end;
          pageIndex += 1;
        }
      }
      pdf.save(`${activeDoc.downloadBase}.pdf`);
    } finally {
      root.style.display = "none";
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={printRef}
        aria-hidden="true"
        style={{
          display: "none",
          position: "absolute",
          left: "-10000px",
          top: 0,
          width: "794px",
          background: "#ffffff",
          padding: "24px",
          fontFamily: "Heebo, Arial, sans-serif",
        }}
      >
        <PrintCopy markdown={activeDoc.markdown} />
      </div>

      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        {DOCUMENTS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setDocId(item.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              docId === item.id
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{subtitleFor(activeDoc.markdown)}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadWord}
            disabled={exportingWord}
          >
            {exportingWord ? (
              <Loader2 size={14} className="animate-spin ml-1" />
            ) : (
              <FileText size={14} className="ml-1" />
            )}
            {exportingWord ? "מייצא..." : "הורד Word"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin ml-1" />
            ) : (
              <Download size={14} className="ml-1" />
            )}
            {exporting ? "מייצא..." : "הורד PDF"}
          </Button>
        </div>
      </div>

      <ChapterAccordions key={activeDoc.id} markdown={activeDoc.markdown} />
    </div>
  );
}
