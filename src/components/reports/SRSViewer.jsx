import { useState, useRef } from 'react';
import { Download, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType
} from 'docx';

const SECTIONS = [
  {
    title: '1. סקירת מערכת',
    content: `מערכת **רגבים** מנהלת שיבוצים יומיים לתלמידים בתכנית התנדבות חקלאית.

**מה המערכת עושה:**
- שיבוץ תלמידים למקומות עבודה (חוות חקלאיות)
- ניהול לוגיסטיקת הסעות ורכבים
- דיווח זמנים יומי ואישורו על ידי מנהל
- קבלה ועיבוד בקשות היעדרות המגיעות ב-SMS
- יצירת דוחות תקופתיים לחשבונאות

**משתמשי הקצה:**
- **מנהל (admin)** — גישה מלאה לכל הדפים, ניהול נתונים ואישור דיווחים
- **מפקד / תלמיד מדווח** — גישה לדף דיווח זמנים בלבד (קישור ציבורי /time-reporting)
- **חקלאי** — גישה לקישור /schedule לצפייה בסידור העבודה`,
  },
  {
    title: '2. מבנה מסד הנתונים',
    subsections: [
      {
        title: '2.1 תלמיד (Student)',
        content: `כל תלמיד מוגדר עם השדות הבאים:
- **שם מלא** — שם מלא (חובה)
- **טלפון** — מספר נייד
- **מחזור** — שם הקבוצה (לדוגמה: "מחזור א'")
- **יום חופש** — א/ב/ג/ד/ה
- **סטטוס מרחק** — קרוב / רחוק / אאא- לפני שיבוץ / תתת - לא עובד (משמש לשיבוץ אוטומטי ביום ראשון)
- **פעיל** — האם התלמיד פעיל במערכת (ברירת מחדל: כן)
- **מקומות עבודה אסורים** — רשימת מקומות שהתלמיד אינו יכול לעבוד בהם
- **הערות** — טקסט חופשי

תלמיד לא פעיל לא מוצג בטבלת השיבוצים אלא אם כבר יש לו שיבוץ לאותו תאריך.`,
      },
      {
        title: '2.2 מקום עבודה (Workplace)',
        content: `כל מקום עבודה (חווה) מוגדר עם:
- **שם** — שם מקום העבודה (חובה)
- **שם משק** — שם המשק (עשוי להיות שונה מהשם)
- **כתובת, ח.פ., טלפון ומייל** — לצורכי חשבונאות

**מקומות עבודה מיוחדים** (מסוננים מהדוחות):
- "לא עובד" — תלמיד לא יצא לעבודה
- "לימודים" — תלמיד בלימודים
- "לא יצא" — תלמיד לא יצא ללא ציון סיבה`,
      },
      {
        title: '2.3 שיבוץ (Assignment)',
        content: `כל שיבוץ מקשר תלמיד למקום עבודה בתאריך מסוים:
- **תאריך, תלמיד, מקום עבודה** — חובה
- **תפקיד** — נהג / ראש צוות / אחראי פק"ל
- **תעריף** — ₪ לשעה (ברירת מחדל: 40)
- **שעות** — כמות שעות עבודה (ברירת מחדל: 4.75)
- **תשלום נוסף** — בונוס חד-פעמי
- **הערות**

**תלמיד יומי (אורח):** student_id מתחיל ב-"guest_" — מופיע ביום בלבד ולא מועתק בשכפול יום.`,
      },
      {
        title: '2.4 לוגיסטיקה יומית (WorkplaceLogistics)',
        content: `לכל מקום עבודה ביום מסוים ניתן להגדיר:
- **נהג** — תלמיד שינהג לאותו מקום
- **עד 3 רכבים** — הרכבים שייצאו
- **שעת יציאה** — ברירת מחדל 06:35
- **הערות** — הודעות מיוחדות לאותו יום`,
      },
      {
        title: '2.5 דיווח זמנים (TimeReport)',
        content: `דיווח זמנים יומי לכל תלמיד:
- **שעת כניסה** — ברירת מחדל 07:00
- **שעת יציאה** — ברירת מחדל 11:45
- **סטטוס** — ממתין / אושר / נדחה

דיווחים עם שעות ברירת מחדל (07:00–11:45) אינם מוצגים בממשק האדמין כ"שינויים" — רק דיווחים ששונו מהברירת מחדל מופיעים לאישור.`,
      },
      {
        title: '2.6 SMS נכנס (IncomingSMS)',
        content: `כל SMS שמגיע ממספר 019 נשמר עם:
- **מספר הטלפון ותוכן ה-SMS** — הגולמי
- **שם תלמיד, תאריך וסיבה** — כפי שנותחו אוטומטית על ידי AI
- **תלמיד מקושר** — קישור ידני או אוטומטי לתלמיד במערכת
- **סטטוס** — ממתין / אושר / נדחה`,
      },
    ],
  },
  {
    title: '3. לוגיקה עסקית',
    subsections: [
      {
        title: '3.1 שכפול יום',
        content: `כפתור "שכפל שיבוצים" מעתיק את כל השיבוצים מיום מקור ליום יעד.

**מצב רגיל:** מועתק מקום העבודה בלבד. תפקיד ובונוס מאופסים.

**יום ראשון — כלל מיוחד:** כשיום היעד הוא יום ראשון, השיבוץ נקבע לפי **סטטוס המרחק** של כל תלמיד:
- קרוב → מקום עבודה "קרוב"
- רחוק → מקום עבודה "רחוק"
- תתת - לא עובד → מקום "תתת - לא עובד"
- אאא- לפני שיבוץ → מקום "אאא- לפני שיבוץ"

תלמידים יומיים (אורחים) **לא** מועתקים בשכפול.`,
      },
      {
        title: '3.2 מניעת שיבוץ לאתר אסור',
        content: `אם תלמיד מוגדר עם "מקומות עבודה אסורים" ומנסים לשבץ אותו לאחד מהם — המערכת חוסמת את הפעולה ומציגה הודעת שגיאה.`,
      },
      {
        title: '3.3 אישור דיווחי זמנים',
        content: `לאחר שהמפקד שולח דיווח זמנים, המנהל רואה בדף "עדכון זמנים" רק את הדיווחים **ששונו** מהשעות הרגילות.

**תצוגה:**
1. **שינויי מחלקה** — מקום עבודה שלכל התלמידים שלו יש שינוי זהה
2. **שינויים פרטניים** — תלמידים שסוטים משעות המחלקה שלהם

לאחר אישור — כמות השעות מתעדכנת גם בשיבוץ עצמו.`,
      },
    ],
  },
  {
    title: '4. עמודים ומסכים',
    subsections: [
      {
        title: '4.1 שיבוצים יומיים (מסך ראשי)',
        content: `המסך הראשי מציג טבלה עם כל התלמידים לתאריך הנבחר.

**אפשרויות:**
- ניווט בין ימים (חצים, בחירת תאריך, כפתור "היום")
- שיבוץ מקום עבודה לכל תלמיד
- הגדרת תפקיד, תעריף, שעות ובונוס
- עריכה מרובה (בחירת מספר תלמידים + שינוי בבת אחת)
- בחירה לפי מחזור
- הוספת תלמיד יומי (אורח)
- שכפול שיבוצים ליום אחר
- ייצוא סידור עבודה ל-PDF ופרסומו

**סיידבר לוגיסטיקה** — בצד ימין המסך מוצגים כרטיסי לוגיסטיקה לכל מקום עבודה (רכבים, שעת יציאה, הערות).`,
      },
      {
        title: '4.2 דיווח זמנים (ציבורי)',
        content: `דף ציבורי (ללא התחברות) לדיווח שעות כניסה ויציאה.

**אופן השימוש:**
1. המפקד בוחר תאריך
2. רואה את כל מקומות העבודה עם התלמידים
3. יכול לשנות שעות ברמת מחלקה שלמה או לכל תלמיד בנפרד
4. לוחץ "שלח דיווח" — המערכת שומרת את כל השעות

שעת יציאה חייבת להיות **מאוחרת** משעת כניסה — אחרת מוצגת הודעת שגיאה.`,
      },
      {
        title: '4.3 בקשות היעדרות',
        content: `כל SMS שמגיע מתלמיד מנותח אוטומטית ע"י AI ומוצג לאישור.

המנהל יכול:
- לאשר או לדחות בקשות
- לקשר ידנית תלמיד לבקשה
- לוסיף הערות`,
      },
    ],
  },
  {
    title: '5. דוחות',
    subsections: [
      {
        title: '5.1 סידור עבודה יומי (PDF)',
        content: `כפתור "סידור עבודה PDF" בראש מסך השיבוצים מייצר PDF עם:
- שם כל מקום עבודה
- רשימת תלמידים
- שם הנהג, ראש הצוות ואחראי הפק"ל
- הרכב ושעת היציאה

ניתן גם **לפרסם** את הסידור — הקובץ מועלה לענן והחקלאים יכולים לצפות בו בקישור ציבורי.`,
      },
      {
        title: '5.2 דוח עבודה לתקופה',
        content: `דוח המסכם את כל ימי העבודה לפי מקום עבודה בטווח תאריכים שנבחר.

מציג לכל מקום עבודה: מספר תלמידים, סך שעות, תעריף ועלות כוללת.

ניתן לייצא ל-PDF או ל-Excel.`,
      },
      {
        title: '5.3 דוח תלמיד',
        content: `דוח המציג את כל ימי העבודה של תלמיד בודד (או קבוצת תלמידים) בטווח תאריכים.`,
      },
    ],
  },
  {
    title: '6. ממשקים חיצוניים',
    subsections: [
      {
        title: '6.1 SMS (019)',
        content: `כל SMS שנשלח למספר הפרויקט מועבר אוטומטית ל-Webhook.
המערכת מנתחת אותו עם AI ושומרת את בקשת ההיעדרות לאישור מנהל.`,
      },
      {
        title: '6.2 גיבוי חודשי',
        content: `בתחילת כל חודש נשלח מייל אוטומטי עם גיבוי הנתונים לכתובות המוגדרות בהגדרות הגיבוי.`,
      },
    ],
  },
];

function Section({ section, isOpen, onToggle }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-secondary/40 hover:bg-secondary/70 transition-colors text-right"
      >
        <h2 className="font-bold text-base text-foreground">{section.title}</h2>
        <span className="text-muted-foreground text-lg">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="p-5 space-y-5 bg-card">
          {section.content && <MarkdownText text={section.content} />}
          {section.subsections?.map((sub, i) => (
            <div key={i} className="border-r-4 border-primary/30 pr-4">
              <h3 className="font-semibold text-sm text-primary mb-2">{sub.title}</h3>
              <MarkdownText text={sub.content} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MarkdownText({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm text-foreground leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;

        // Bold + regular text (inline)
        const renderInline = (str) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
              : part
          );
        };

        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }

        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

// Render all sections as HTML for PDF capture
function SRSPrintContent({ innerRef }) {
  return (
    <div ref={innerRef} style={{ display: 'none', position: 'fixed', top: '-9999px', left: 0, width: '794px', background: 'white', padding: '32px', fontFamily: 'Arial, sans-serif', direction: 'rtl' }}>
      <div style={{ marginBottom: '24px', borderBottom: '2px solid #3b4fa8', paddingBottom: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e2864', margin: 0 }}>מפרט דרישות מערכת — רגבים</h1>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>גרסה 1.0 | 2026-05-11</p>
      </div>
      {SECTIONS.map((section, si) => (
        <div key={si} style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e2864', borderBottom: '1px solid #b4bce8', paddingBottom: '4px', marginBottom: '10px' }}>{section.title}</h2>
          {section.content && <SRSPrintText text={section.content} />}
          {section.subsections?.map((sub, subi) => (
            <div key={subi} style={{ marginBottom: '12px', paddingRight: '12px', borderRight: '3px solid #3b4fa8' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#3b4fa8', marginBottom: '6px' }}>{sub.title}</h3>
              <SRSPrintText text={sub.content} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SRSPrintText({ text }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: '11px', lineHeight: '1.7', color: '#222' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: '6px' }} />;
        const renderInline = (str) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          );
        };
        if (line.startsWith('- ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '2px' }}>
              <span style={{ color: '#3b4fa8', flexShrink: 0 }}>•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        return <p key={i} style={{ margin: '2px 0' }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function buildDocxParagraphs() {
  const paragraphs = [];

  // Title
  paragraphs.push(new Paragraph({
    text: 'מפרט דרישות מערכת — רגבים',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }));
  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: 'גרסה 1.1 | 2026-05-12', color: '888888', size: 22 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  for (const section of SECTIONS) {
    // Section heading
    paragraphs.push(new Paragraph({
      text: section.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '3b4fa8' } },
    }));

    if (section.content) {
      for (const line of section.content.split('\n')) {
        paragraphs.push(...lineToDocxParagraph(line));
      }
    }

    for (const sub of section.subsections || []) {
      paragraphs.push(new Paragraph({
        text: sub.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 },
      }));
      for (const line of sub.content.split('\n')) {
        paragraphs.push(...lineToDocxParagraph(line));
      }
    }
  }

  return paragraphs;
}

function lineToDocxParagraph(line) {
  if (!line.trim()) return [new Paragraph({ text: '', spacing: { after: 60 } })];

  const isBullet = line.startsWith('- ');
  const text = isBullet ? line.slice(2) : line;

  // Parse bold (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const runs = parts.map(p =>
    p.startsWith('**') && p.endsWith('**')
      ? new TextRun({ text: p.slice(2, -2), bold: true, size: 22 })
      : new TextRun({ text: p, size: 22 })
  );

  return [new Paragraph({
    children: runs,
    bullet: isBullet ? { level: 0 } : undefined,
    spacing: { after: 60 },
  })];
}

export default function SRSViewer() {
  const [openSections, setOpenSections] = useState({ 0: true });
  const [exporting, setExporting] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const printRef = useRef(null);

  const toggle = (i) => setOpenSections(prev => ({ ...prev, [i]: !prev[i] }));

  const handleDownloadWord = async () => {
    setExportingWord(true);
    const doc = new Document({
      sections: [{ properties: {}, children: buildDocxParagraphs() }],
    });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'מפרט_מערכת_רגבים.docx';
    a.click();
    URL.revokeObjectURL(url);
    setExportingWord(false);
  };

  const handleDownloadPdf = async () => {
    setExporting(true);
    const el = printRef.current;
    el.style.display = 'block';
    await new Promise(r => setTimeout(r, 150));

    const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
    el.style.display = 'none';

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;
    const pxPerMM = canvas.width / contentW;
    const pageHeightPx = contentH * pxPerMM;

    let srcY = 0;
    let firstPage = true;
    while (srcY < canvas.height) {
      const sliceH = Math.min(pageHeightPx, canvas.height - srcY);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceH;
      slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (!firstPage) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, contentW, sliceH / pxPerMM);
      srcY += sliceH;
      firstPage = false;
    }

    pdf.save('מפרט_מערכת_רגבים.pdf');
    setExporting(false);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <SRSPrintContent innerRef={printRef} />
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">מפרט דרישות מערכת רגבים — גרסה 1.0</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadWord} disabled={exportingWord}>
            {exportingWord ? <Loader2 size={14} className="animate-spin ml-1" /> : <FileText size={14} className="ml-1" />}
            {exportingWord ? 'מייצא...' : 'הורד Word'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={exporting}>
            {exporting ? <Loader2 size={14} className="animate-spin ml-1" /> : <Download size={14} className="ml-1" />}
            {exporting ? 'מייצא...' : 'הורד PDF'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {SECTIONS.map((section, i) => (
          <Section
            key={i}
            section={section}
            isOpen={!!openSections[i]}
            onToggle={() => toggle(i)}
          />
        ))}
      </div>
    </div>
  );
}