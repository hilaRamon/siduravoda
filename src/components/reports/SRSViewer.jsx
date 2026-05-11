import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';

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

// Strip ** bold markers for plain text
function stripBold(str) {
  return str.replace(/\*\*/g, '');
}

// Flatten all sections into lines for PDF
function buildPdfLines() {
  const lines = [];
  SECTIONS.forEach(section => {
    lines.push({ type: 'h1', text: section.title });
    if (section.content) {
      section.content.split('\n').forEach(line => {
        if (!line.trim()) return;
        lines.push({ type: line.startsWith('- ') ? 'bullet' : 'body', text: stripBold(line.startsWith('- ') ? line.slice(2) : line) });
      });
    }
    section.subsections?.forEach(sub => {
      lines.push({ type: 'h2', text: sub.title });
      sub.content.split('\n').forEach(line => {
        if (!line.trim()) return;
        lines.push({ type: line.startsWith('- ') ? 'bullet' : 'body', text: stripBold(line.startsWith('- ') ? line.slice(2) : line) });
      });
    });
  });
  return lines;
}

export default function SRSViewer() {
  const [openSections, setOpenSections] = useState({ 0: true });

  const toggle = (i) => setOpenSections(prev => ({ ...prev, [i]: !prev[i] }));

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxW = pageW - margin * 2;
    let y = margin;

    const checkPage = (needed) => {
      if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
    };

    const addWrappedText = (text, fontSize, isBold, color, indent = 0) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, maxW - indent);
      lines.forEach(line => {
        checkPage(fontSize * 0.4 + 1);
        // RTL: align right
        doc.text(line, pageW - margin - indent, y, { align: 'right' });
        y += fontSize * 0.4 + 1;
      });
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 40, 100);
    doc.text('מפרט דרישות מערכת — רגבים', pageW - margin, y, { align: 'right' });
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('גרסה 1.0 | 2026-05-11', pageW - margin, y, { align: 'right' });
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    const pdfLines = buildPdfLines();
    pdfLines.forEach(item => {
      if (item.type === 'h1') {
        y += 4;
        checkPage(10);
        addWrappedText(item.text, 13, true, [30, 40, 100]);
        y += 1;
        doc.setDrawColor(180, 190, 230);
        doc.line(margin, y, pageW - margin, y);
        y += 3;
      } else if (item.type === 'h2') {
        y += 2;
        checkPage(8);
        addWrappedText(item.text, 11, true, [60, 90, 180]);
        y += 1;
      } else if (item.type === 'bullet') {
        checkPage(6);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(item.text, maxW - 8);
        lines.forEach((line, idx) => {
          checkPage(5);
          doc.text(line, pageW - margin - 6, y, { align: 'right' });
          if (idx === 0) doc.text('•', pageW - margin - 1, y, { align: 'right' });
          y += 5;
        });
      } else {
        checkPage(5);
        addWrappedText(item.text, 10, false, [40, 40, 40]);
      }
    });

    doc.save('מפרט_מערכת_רגבים.pdf');
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">מפרט דרישות מערכת רגבים — גרסה 1.0</p>
        <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
          <Download size={14} className="ml-1" /> הורד PDF
        </Button>
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