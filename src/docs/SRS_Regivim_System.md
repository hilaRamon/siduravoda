# מפרט דרישות מערכת (SRS) — מערכת "רגבים"
## Software Requirements Specification — גרסה 1.0

---

> **מטרת המסמך:** מפרט טכני מקיף המאפשר לכל מפתח לבנות מחדש את מערכת רגבים מאפס, על בסיס מסמך זה בלבד.  
> **שפת פיתוח:** React + TypeScript/JavaScript, Tailwind CSS, shadcn/ui  
> **פלטפורמה:** Base44 (BaaS — Backend as a Service)  
> **כיוון ממשק:** RTL (ימין לשמאל), עברית

---

## תוכן עניינים

1. [סקירת מערכת](#1-סקירת-מערכת)
2. [מבנה מסד הנתונים](#2-מבנה-מסד-הנתונים)
3. [לוגיקה עסקית והתניות](#3-לוגיקה-עסקית-והתניות)
4. [תיאור עמודים וממשק משתמש](#4-תיאור-עמודים-וממשק-משתמש)
5. [מנוע דוחות](#5-מנוע-דוחות)
6. [אימות ובקרת שגיאות](#6-אימות-ובקרת-שגיאות)
7. [ממשקים חיצוניים](#7-ממשקים-חיצוניים)
8. [ארכיטקטורת קבצים](#8-ארכיטקטורת-קבצים)
9. [אינדקס מונחים ורכיבים](#9-אינדקס-מונחים-ורכיבים)

---

## 1. סקירת מערכת

מערכת **רגבים** היא מערכת ניהול שיבוצים יומיים לתלמידים בתכנית התנדבות חקלאית. המערכת מנהלת:

- שיבוץ תלמידים למקומות עבודה (חוות חקלאיות)
- לוגיסטיקת הסעות ורכבים
- דיווח זמנים יומי ואישורו
- בקשות היעדרות המגיעות ב-SMS
- דוחות תקופתיים לחשבונאות

### 1.1 משתמשי הקצה

| תפקיד | גישה | תיאור |
|-------|------|--------|
| מנהל (admin) | מלאה | גישה לכל הדפים, ניהול נתונים, אישור דיווחים |
| תלמיד/מפקד (user) | דף דיווח זמנים בלבד | גישה לקישור `/time-reporting` ללא התחברות |
| חקלאי | קישור ציבורי | גישה לקישור `/schedule` לצפייה בסידור |

---

## 2. מבנה מסד הנתונים

> **הערה:** כל ישות כוללת באופן אוטומטי שדות built-in:
> - `id` — מזהה ייחודי (string UUID)
> - `created_date` — חותמת זמן יצירה (ISO 8601)
> - `updated_date` — חותמת זמן עדכון אחרון
> - `created_by` — כתובת מייל המשתמש היוצר

---

### 2.1 ישות: Student (תלמיד)

**קובץ:** `entities/Student.json`

| שם שדה | סוג | ערכים אפשריים | חובה | תיאור |
|--------|-----|--------------|------|--------|
| `full_name` | string | — | ✅ | שם מלא של התלמיד |
| `phone` | string | — | ❌ | מספר טלפון נייד |
| `cohort` | string | — | ❌ | שם המחזור (לדוגמה: "מחזור א'", "צוות") |
| `free_day` | enum | א, ב, ג, ד, ה | ❌ | יום חופש שבועי |
| `distance_status` | enum | קרוב, רחוק, אאא- לפני שיבוץ, תתת - לא עובד | ❌ | סטטוס מרחק מהבסיס — משמש בכלל ראשון |
| `is_active` | boolean | true/false | ❌ | האם פעיל. ברירת מחדל: true |
| `forbidden_workplaces` | array[string] | — | ❌ | רשימת **שמות** (לא IDs) של מקומות עבודה אסורים |
| `notes` | string | — | ❌ | הערות חופשיות |

**קשרים:**
- `id` ← `Assignment.student_id` (One-to-Many)
- `id` ← `TimeReport.student_id` (One-to-Many)

**הערות עסקיות:**
- תלמיד עם `is_active = false` אינו מוצג בטבלת שיבוצים אלא אם כבר קיים לו שיבוץ לאותו תאריך
- תלמיד עם cohort = "צוות" מופיע ברשימת הנהגים האפשריים בלוגיסטיקה
- תלמידים חדשים (created_date > selectedDate) אינם מוצגים בשיבוצים לתאריכים עתידיים מבחינת התאריך

---

### 2.2 ישות: Workplace (מקום עבודה)

**קובץ:** `entities/Workplace.json`

| שם שדה | סוג | חובה | תיאור |
|--------|-----|------|--------|
| `name` | string | ✅ | שם מקום העבודה / חווה |
| `farm_name` | string | ❌ | שם המשק (עשוי להיות שונה) |
| `address` | string | ❌ | כתובת מלאה |
| `company_id` | string | ❌ | ח.פ. / מספר חברה לחשבוניות |
| `contact_phone` | string | ❌ | טלפון איש קשר |
| `accounting_phone` | string | ❌ | טלפון הנהלת חשבונות |
| `accounting_email` | string | ❌ | מייל הנהלת חשבונות |

**קשרים:**
- `id` ← `Assignment.workplace_id` (One-to-Many)
- `id` ← `WorkplaceLogistics.workplace_id` (One-to-Many)

**מקומות עבודה מיוחדים (ערכים שמורים):**
מקומות העבודה הבאים מקבלים טיפול מיוחד בלוגיקה ואינם מופיעים בדוחות:
- `"לא עובד"` — תלמיד לא יצא לעבודה
- `"לימודים"` — תלמיד בלימודים
- `"לא יצא"` — תלמיד לא יצא (ללא ציון סיבה)

**ערכים המשמשים בכלל ראשון (Sunday Rule):**
- `"קרוב"` — עבודה קרובה לבסיס
- `"רחוק"` — עבודה רחוקה מהבסיס
- `"תתת - לא עובד"` — תלמיד לא עובד ביום זה
- `"אאא- לפני שיבוץ"` — עדיין לא שובץ

---

### 2.3 ישות: Assignment (שיבוץ)

**קובץ:** `entities/Assignment.json`

| שם שדה | סוג | ברירת מחדל | חובה | תיאור |
|--------|-----|-----------|------|--------|
| `date` | string (date) | — | ✅ | תאריך השיבוץ בפורמט YYYY-MM-DD |
| `student_id` | string | — | ✅ | ID של התלמיד (FK → Student.id) |
| `student_name` | string | — | ❌ | שם התלמיד (denormalized, לנוחות) |
| `workplace_id` | string | — | ✅ | ID של מקום העבודה (FK → Workplace.id) |
| `workplace_name` | string | — | ❌ | שם מקום העבודה (denormalized) |
| `role` | string | — | ❌ | תפקיד (FK → Role.name) |
| `rate` | number | 40 | ❌ | תעריף שעתי בשקלים |
| `hours` | number | 4.75 | ❌ | כמות שעות עבודה |
| `bonus` | number | — | ❌ | תשלום נוסף חד-פעמי |
| `notes` | string | — | ❌ | הערות לשיבוץ הספציפי |

**קשרים:**
- `student_id` → Student.id
- `workplace_id` → Workplace.id
- `role` → Role.name (loosy reference, לא FK קשיח)

**כלל כפילויות:** ייתכנו כפילויות (שני רשומות לאותו student_id+date). המערכת מטפלת בהן ע"י deduplicate — שמירת הרשומה עם `updated_date` האחרון ביותר.

**תלמיד יומי (Guest):**
- `student_id` מתחיל ב-`"guest_"` (לדוגמה: `"guest_1700000000000"`)
- מופיע בשיבוצים של אותו יום בלבד
- **לא** מועתק בפעולת שכפול יום

---

### 2.4 ישות: Vehicle (רכב)

**קובץ:** `entities/Vehicle.json`

| שם שדה | סוג | חובה | תיאור |
|--------|-----|------|--------|
| `name` | string | ✅ | שם הרכב / מספר רישוי תצוגתי |
| `license_plate` | string | ❌ | לוחית רישוי |
| `insurance` | string | ❌ | פרטי ביטוח |

**קשרים:**
- `id` ← `WorkplaceLogistics.vehicle_id` (One-to-Many)

---

### 2.5 ישות: Role (תפקיד)

**קובץ:** `entities/Role.json`

| שם שדה | סוג | חובה | תיאור |
|--------|-----|------|--------|
| `name` | string | ✅ | שם התפקיד (לדוגמה: נהג, ראש צוות, אחראי פק"ל) |
| `description` | string | ❌ | תיאור התפקיד |
| `color` | string | ❌ | צבע הקס לתצוגה (לדוגמה: #FF5733) |

**תפקידים מיוחדים המשמשים בדוח PDF:**
- `"נהג"` — מוצג בעמודת נהג בטבלת הדוח
- `"ראש צוות"` — מוצג בעמודת ראש צוות
- `'אחראי פק"ל'` — מוצג בעמודת ציוד

---

### 2.6 ישות: WorkplaceLogistics (לוגיסטיקה)

**קובץ:** `entities/WorkplaceLogistics.json`

| שם שדה | סוג | חובה | תיאור |
|--------|-----|------|--------|
| `date` | string (date) | ✅ | תאריך הלוגיסטיקה |
| `workplace_id` | string | ✅ | FK → Workplace.id |
| `workplace_name` | string | ❌ | שם מקום העבודה (denormalized) |
| `driver_student_id` | string | ❌ | FK → Student.id (נהג) |
| `driver_student_name` | string | ❌ | שם הנהג (denormalized) |
| `vehicle_id` | string | ❌ | FK → Vehicle.id (רכב ראשי) |
| `vehicle_name` | string | ❌ | שם הרכב (denormalized) |
| `vehicle_id_2` | string | ❌ | FK → Vehicle.id (רכב שני) |
| `vehicle_name_2` | string | ❌ | שם רכב שני |
| `vehicle_id_3` | string | ❌ | FK → Vehicle.id (רכב שלישי) |
| `vehicle_name_3` | string | ❌ | שם רכב שלישי |
| `exit_time` | string | ❌ | שעת יציאה (HH:MM), ברירת מחדל: "06:35" |
| `notes` | string | ❌ | הערות למקום העבודה לאותו יום |

**כלל כפילויות:** כמו ב-Assignment — dedup לפי updated_date אחרון, מפתח: `workplace_id`.

---

### 2.7 ישות: TimeReport (דיווח זמנים)

**קובץ:** `entities/TimeReport.json`

| שם שדה | סוג | ברירת מחדל | חובה | תיאור |
|--------|-----|-----------|------|--------|
| `date` | string (date) | — | ✅ | תאריך הדיווח |
| `student_id` | string | — | ✅ | FK → Student.id |
| `student_name` | string | — | ❌ | שם (denormalized) |
| `workplace_id` | string | — | ✅ | FK → Workplace.id |
| `workplace_name` | string | — | ❌ | שם (denormalized) |
| `start_time` | string | "07:00" | ❌ | שעת כניסה (HH:MM) |
| `end_time` | string | "11:45" | ❌ | שעת יציאה (HH:MM) |
| `status` | enum | ממתין | ❌ | ממתין / אושר / נדחה |
| `notes` | string | — | ❌ | הערות |

**קבועים:**
- `DEFAULT_START = "07:00"` — שעת כניסה ברירת מחדל
- `DEFAULT_END = "11:45"` — שעת יציאה ברירת מחדל

**כלל סינון:** רשומות עם שעות ברירת מחדל (07:00–11:45) **אינן** מוצגות בממשק האדמין כדיווחים "שונים".

---

### 2.8 ישות: IncomingSMS (SMS נכנס)

**קובץ:** `entities/IncomingSMS.json`

| שם שדה | סוג | ברירת מחדל | חובה | תיאור |
|--------|-----|-----------|------|--------|
| `phone` | string | — | ✅ | מספר טלפון השולח |
| `dest` | string | — | ❌ | מספר היעד (המספר שלך) |
| `message` | string | — | ✅ | תוכן ה-SMS הגולמי |
| `sms_date` | string | — | ❌ | חותמת זמן קבלה מ-019 |
| `parsed_student_name` | string | — | ❌ | שם תלמיד שנותח ע"י AI |
| `parsed_date` | string (date) | — | ❌ | תאריך היעדרות שנותח |
| `parsed_reason` | string | — | ❌ | סיבת היעדרות שנותחה |
| `student_id` | string | — | ❌ | FK → Student.id (ידני או אוטומטי) |
| `student_name` | string | — | ❌ | שם תלמיד מקושר |
| `status` | enum | ממתין | ❌ | ממתין / אושר / נדחה |
| `notes` | string | — | ❌ | הערות מנהל |

---

### 2.9 ישות: FarmerRequest (בקשת חקלאי)

**קובץ:** `entities/FarmerRequest.json`

| שם שדה | סוג | חובה | תיאור |
|--------|-----|------|--------|
| `date` | string (date) | ✅ | תאריך הדרישה |
| `workplace_id` | string | ✅ | FK → Workplace.id |
| `workplace_name` | string | ❌ | שם (denormalized) |
| `requested_volunteers` | number | ❌ | כמות מתנדבים מבוקשת |

---

### 2.10 ישות: PublishedSchedule (סידור מפורסם)

**קובץ:** `entities/PublishedSchedule.json`

| שם שדה | סוג | חובה | תיאור |
|--------|-----|------|--------|
| `date` | string (date) | ✅ | תאריך הסידור |
| `file_url` | string | ✅ | URL ל-PDF המפורסם בענן |

**כלל:** המערכת מחזיקה **רשומה אחת בלבד** בכל עת. בפרסום חדש — כל הרשומות הקיימות נמחקות ונוצרת רשומה חדשה.

---

### 2.11 ישות: BackupSettings (הגדרות גיבוי)

**קובץ:** `entities/BackupSettings.json`

| שם שדה | סוג | חובה | תיאור |
|--------|-----|------|--------|
| `emails` | array[string] | ❌ | רשימת כתובות מייל לגיבוי חודשי |

---

## 3. לוגיקה עסקית והתניות

### 3.1 מנגנון שכפול יום (Clone Day)

**קובץ:** `pages/Assignments.jsx` — פונקציה `handleCloneDay`

#### 3.1.1 תהליך כללי

1. **בדיקת יום:** בדיקה האם יום היעד הוא יום ראשון (`getDay() === 0`)
2. **טעינת נתונים:** טעינת תלמידים עדכניים (`freshStudents`) + שיבוצים קיימים בתאריך היעד
3. **ניקוי כפילויות:** מחיקת כפילויות בתאריך היעד לפני הוספה
4. **בנית רשימת פעולות:** `toCreate[]` ו-`toUpdate[]`
5. **ביצוע:** שליחה בחלקים (chunks) של 40 לפונקציה `bulkUpdateAssignments`

#### 3.1.2 מצב רגיל (לא יום ראשון)

- **מה מועתק:** מקום העבודה בלבד
- **מה מאופס:** `role = null`, `bonus = null`
- **מה נשמר:** `rate`, `hours`
- **תלמידים יומיים (guest_*):** **לא** מועתקים

#### 3.1.3 כלל יום ראשון (Sunday Rule)

**תנאי:** `new Date(cloneTargetDate + 'T12:00:00').getDay() === 0`

**לוגיקה:**
```
לכל תלמיד ביום המקור:
  student = freshStudents[student_id]
  distanceStatus = student.distance_status

  אם distanceStatus ∈ DISTANCE_WORKPLACE_MAP:
    targetWorkplace = DISTANCE_WORKPLACE_MAP[distanceStatus]
  אחרת:
    targetWorkplace = מקום העבודה המקורי (fallback)
```

**מיפוי מרחק → מקום עבודה:**
| distance_status | שם מקום עבודה |
|----------------|--------------|
| קרוב | "קרוב" |
| רחוק | "רחוק" |
| תתת - לא עובד | "תתת - לא עובד" |
| אאא- לפני שיבוץ | "אאא- לפני שיבוץ" |

> **חשוב:** המיפוי הוא דינמי — המערכת מחפשת את שם מקום העבודה ב-DB בזמן ריצה. אם לא נמצא — נשאר מקום העבודה המקורי.

#### 3.1.4 Upsert Logic

```
לכל תלמיד ביום המקור:
  אם קיים שיבוץ לאותו student_id בתאריך היעד:
    → UPDATE (workplace, role=null, bonus=null)
  אחרת:
    → CREATE (date=targetDate, rate=40, hours=4.75, role=null, bonus=null)
```

---

### 3.2 סינון לוגיסטיקה (Logistics Filter)

**קובץ:** `components/assignments/LogisticsSidebar.jsx`

**מקומות עבודה מוצגים בסיידבר:**
רק מקומות עבודה שיש להם לפחות תלמיד אחד משובץ **ואשר שם מקום העבודה קיים ואינו ריק**.

**מקומות עבודה שאינם מוצגים בסיידבר:**
```javascript
// אין פילטר מפורש לפי שם — רק workplace_id + workplace_name שאינם ריקים
assignments.filter(a => a.workplace_id && a.workplace_name)
```

> **הערה:** בסיידבר אין פילטר ל-NON_WORK. הפילטר קיים רק בדוח ה-PDF ובדוח התקופתי.

---

### 3.3 ניהול שיבוץ ומניעת שיבוץ לאתר אסור

**קובץ:** `pages/Assignments.jsx` — פונקציה `handleAssign`

```
אם workplace.name ∈ student.forbidden_workplaces:
  → הצג alert: "⛔ לא ניתן לשבץ את {שם} ל-{מקום} — זה מקום עבודה אסור"
  → return false (ביטול)
  
אחרת:
  אם קיימות כפילויות לאותו student+date:
    → מחק כל הכפילויות מלבד הראשונה
    → עדכן את הראשונה
  אחרת אם קיים שיבוץ אחד:
    → עדכן אותו
  אחרת:
    → צור חדש (rate=40, hours=4.75)
```

---

### 3.4 עריכה מרובה (Bulk Edit)

**קובץ:** `pages/Assignments.jsx` — פונקציה `handleBulkSave`

**ביצוע:** 
- שדות ריקים → לא משתנים
- מקום עבודה חדש לתלמיד ללא שיבוץ → יוצר שיבוץ חדש
- שליחה בחלקים של 40 רשומות לפונקציה `bulkUpdateAssignments`
- מוצגת פס התקדמות עם אחוזים בזמן הריצה

---

### 3.5 דיווח זמנים ואישורו

#### 3.5.1 שליחת דיווח (TimeReporting)

**קובץ:** `pages/TimeReporting.jsx`

1. כל תלמיד מקבל שעות ברירת מחדל: `07:00 – 11:45`
2. ניתן לשנות שעות ברמת מקום עבודה (משפיע על כל התלמידים שם)
3. ניתן לדרוס ברמת תלמיד בודד (override)
4. **ולידציה:** שעת יציאה חייבת להיות מאוחרת משעת כניסה
5. בלחיצה על "שלח דיווח" — נוצרת/מעודכנת רשומת TimeReport לכל תלמיד
6. לאחר שליחה — מצב `submitted` נשמר ב-localStorage (`time_report_submitted_YYYY-MM-DD`)
7. **גרפיקת התקדמות:** overlay עם עיגול SVG + אחוזים + טקסט "מעדכן תלמיד X מתוך N"

#### 3.5.2 אישור דיווחים (TimeReportsAdmin)

**קובץ:** `pages/TimeReportsAdmin.jsx`

**סינון:** רק דיווחים שנבדלים מברירת המחדל:
```javascript
reports.filter(r => r.start_time !== "07:00" || r.end_time !== "11:45")
```

**לוגיקת תצוגה:**
1. **שינויים במחלקות:** קיבוץ לפי workplace. מזוהה השעה הדומיננטית (הנפוצה ביותר). כפתור "אשר הכל" / "דחה הכל" לכל מחלקה.
2. **שינויים פרטניים:** תלמידים שסוטים מהשעה הדומיננטית של המחלקה שלהם.

**אחרי אישור:** מעדכן גם את `Assignment.hours` עם משך השעות המחושב.

**חישוב משך:**
```javascript
diff = (eh * 60 + em) - (sh * 60 + sm)  // בדקות
hours = Math.round(diff / 60 * 100) / 100
```

---

### 3.6 בחירה לפי מחזור

**קובץ:** `pages/Assignments.jsx` — דיאלוג `showCohortSelectDialog`

1. המשתמש בוחר מחזור/ות מרשימה
2. כל תלמידי המחזורים הנבחרים **הנראים בפילטר הנוכחי** מסומנים
3. מספר הנבחרים מוצג בכפתור האישור

---

## 4. תיאור עמודים וממשק משתמש

### 4.1 Layout (פריסה כללית)

**קובץ:** `components/Layout.jsx`

- סיידבר שמאלי ברוחב 256px עם רקע `--sidebar-bg` (כחול כהה)
- תוכן ראשי מתגלגל בצד ימין
- Badge אדום על "בקשות היעדרות" כאשר יש SMS ממתינים
- Badge כחול על "עדכון זמנים" כאשר יש דיווחי זמנים ממתינים
- שני ה-badge רענון כל 60 שניות

**פריטי ניווט:**
| תווית | נתיב | אייקון |
|-------|------|--------|
| שיבוצים יומיים | / | CalendarDays |
| יומן | /calendar | BookOpen |
| תלמידים וצוות | /students | GraduationCap |
| מקומות עבודה | /workplaces | Building2 |
| תפקידים | /roles | ShieldCheck |
| רכבים | /vehicles | Truck |
| דוחות | /reports | BarChart2 |
| בקשות היעדרות | /absence-requests | MessageSquare |
| עדכון זמנים | /time-reports | ClipboardCheck |

---

### 4.2 עמוד שיבוצים יומיים (Assignments)

**קובץ:** `pages/Assignments.jsx`  
**נתיב:** `/`

#### 4.2.1 כותרת ופעולות

- מוצג: "X משובצים מתוך Y תלמידים"
  - Y = תלמידים פעילים שנוצרו לפני/ביום הנבחר
  - X = תלמידים עם שיבוץ שאינו `['לא עובד','לימודים','לא יצא']`
- כפתורי פעולה: סידור עבודה PDF, בחירה לפי מחזור, הוסף תלמיד יומי, שכפל שיבוצים

#### 4.2.2 ניווט תאריכים

- ← → לימים הבאים/קודמים
- input[type=date] ישיר
- כפתור "היום"
- תצוגת יום בשבוע בעברית

#### 4.2.3 טבלת שיבוצים

עמודות:
1. Checkbox בחירה
2. מספר שורה (#)
3. שם תלמיד (עם חיפוש)
4. מחזור (dropdown סינון)
5. מקום עבודה (dropdown סינון + popover בחירה)
6. תפקיד (Select)
7. תעריף (EditableNumberCell)
8. שעות (EditableNumberCell)
9. תשלום נוסף (EditableNumberCell)
10. הערות

**מיון:** לפי מקום עבודה → מחזור → שם (עברית)

**EditableNumberCell:** 
- לחיצה על התא → שדה input מספרי
- Enter/blur → שמירה
- Escape → ביטול

**WorkplaceCell:**
- Popover עם Command (חיפוש) לבחירת מקום עבודה
- X לביטול שיבוץ

#### 4.2.4 סיידבר לוגיסטיקה

ראה סעיף 4.7

---

### 4.3 עמוד יומן (Calendar)

**קובץ:** `pages/Calendar.jsx`  
**נתיב:** `/calendar`

- תצוגה שבועית (א'-ה')
- לכל יום: כמות מבוקשת מחקלאים + כמות נעדרים מאושרים
- ניהול בקשות חקלאים (CRUD)

---

### 4.4 עמוד תלמידים (Students)

**קובץ:** `pages/Students.jsx`  
**נתיב:** `/students`

- חיפוש, סינון לפי מחזור, סינון לפי פעיל/לא פעיל
- CRUD מלא
- ייבוא מ-Excel
- ייבוא מספרי טלפון מ-Excel
- כפתור השבתת מחזור שלם

---

### 4.5 עמוד מקומות עבודה (Workplaces)

**קובץ:** `pages/Workplaces.jsx`  
**נתיב:** `/workplaces`

- CRUD מלא
- חיפוש לפי שם
- ייבוא מ-Excel
- שדה חיפוש משק בפופאובר

---

### 4.6 עמוד בקשות היעדרות (AbsenceRequests)

**קובץ:** `pages/AbsenceRequests.jsx`  
**נתיב:** `/absence-requests`

- שלוש לשוניות: ממתינות / אושרו / נדחו
- כרטיסי סטטיסטיקה עם מעבר ישיר ללשונית
- בחירה מרובה + אישור/דחייה מרובה
- דיאלוג פרטי: קישור ידני לתלמיד, עריכת הערות

---

### 4.7 סיידבר לוגיסטיקה (LogisticsSidebar)

**קובץ:** `components/assignments/LogisticsSidebar.jsx`

#### 4.7.1 תצוגה

- רוחב 256px, מוצמד לראש בגלילה (`sticky top-4`)
- גלילה פנימית: `max-h-[calc(100vh-8rem)]`
- כרטיס לכל מקום עבודה פעיל

#### 4.7.2 רכיב WorkplaceLogisticsCard

לכל מקום עבודה:
- **שעת יציאה:** input[type=time] + כפתור ✓ (commit בלחיצה, לא בשינוי)
- **הערות:** textarea, שמירה ב-onBlur
- **3 חריצי רכב:** VehicleSlot × 3

#### 4.7.3 VehicleSlot

- Select לבחירת רכב
- רכב שכבר נבחר במחלקה אחרת → לא מופיע בבחירה (אבל מופיע במחלקה שבחרה אותו)
- מחיקה: בחירת "ריק"

#### 4.7.4 שמירה

- כל שינוי → Upsert מיידי:
  - `exists(workplace_id, date)` → UPDATE
  - אחרת → CREATE

---

### 4.8 עמוד דיווח זמנים (TimeReporting)

**קובץ:** `pages/TimeReporting.jsx`  
**נתיב:** `/time-reporting` (ציבורי — ללא auth)

#### 4.8.1 רכיב TimeInput

```
state: local (string HH:MM)
dirty = (local !== value)

onChange → עדכון local בלבד
כפתור ✓:
  - תמיד מוצג
  - אפור: local === value
  - כחול: local !== value
  - לחיצה → commit (קורא ל-onChange של ההורה)
```

#### 4.8.2 WorkplaceGroup

- כותרת מתקפלת/פותחת
- ברירת מחדל: **מכווץ** (collapsed=true)
- שעות קבוצתיות: משפיעות על כל תלמידי המחלקה
- שורות תלמידים: override פרטני (רקע צהוב + תג "שינוי פרטני")

#### 4.8.3 ולידציה שעות

```
validateTimes(start, end):
  diff = (eh*60+em) - (sh*60+sm)
  return diff > 0

אם false:
  → הצג toast אדום: "שעת יציאה חייבת להיות מאוחרת משעת כניסה"
  → אחרי 3000ms → הסתר
  → אל תשמור את השינוי
```

#### 4.8.4 מצב "נשלח"

- localStorage key: `time_report_submitted_YYYY-MM-DD`
- אחרי שליחה מוצג מסך הצלחה עם אפשרות לבחור תאריך אחר

---

### 4.9 עמוד אישור זמנים (TimeReportsAdmin)

**קובץ:** `pages/TimeReportsAdmin.jsx`  
**נתיב:** `/time-reports`

- לשוניות: ממתינים / אושרו / נדחו
- קיבוץ לפי מחלקה (שינויי מחלקה) + פרטניים
- אישור/דחיית כל המחלקה בפעולה אחת
- לחיצת "אשר" → גם מעדכנת `Assignment.hours`

---

## 5. מנוע דוחות

### 5.1 דוח סידור עבודה יומי (PDF)

**קובץ:** `components/reports/DailyReportPDFButton.jsx`

#### 5.1.1 בנית הדוח

**פונקציה:** `buildReportGroups(assignments, logisticsMap)`

1. סינון: `shouldSkip(workplace_name)` → מסנן 'לא עובד', 'לימודים', 'לא יצא'
2. קיבוץ לפי `workplace_id`
3. Deduplication תלמידים (לפי `student_id`)
4. מיון: מקומות עבודה לפי שם עברי

**שדות שנבנים לכל קבוצה:**
- `workplaceName` — שם מקום העבודה
- `students[]` — רשימת תלמידים ממוינת לפי שם
- `vehicleName` — שמות רכבים מחוברים (`vehicle_name + vehicle_name_2 + vehicle_name_3`)
- `exitTime` — שעת יציאה (מ-WorkplaceLogistics, ברירת מחדל "06:35")
- `notes` — הערות
- `driverName` — שם הנהג (מ-Assignment.role="נהג", רק אם באותה מחלקה)
- `teamLeaderName` — שם ראש צוות
- `equipName` — שם אחראי פק"ל

#### 5.1.2 מבנה ה-HTML הנסתר

```
div (width=794px, font-family=Arial, dir=rtl)
  └── כותרת: "סידור עבודה" + תאריך גרגוריאני + עברי
  └── לכל מחלקה:
        └── header: שם + הערות + רכב (כחול) + שעה (ירוק)
        └── table:
              thead: שם תלמיד | אחראי פק"ל | נהג | ראש צוות
              tbody: שורה לכל תלמיד
              tfoot: סה"כ תלמידים: N
```

#### 5.1.3 ייצוא PDF

```
scale = 1.5
orientation = portrait
format = a4
margin = 10mm
```

**אלגוריתם חיתוך חכם (smart page breaks):**
1. חישוב `safeCutsPx` — y-offset תחתון של כל block
2. לכל עמוד: מחפש את safeCut האחרון שנמצא לפני גבול העמוד
3. חתך ב-safeCut ולא באמצע מחלקה

#### 5.1.4 פרסום

- יצירת Blob → UploadFile API → שמירת URL ב-PublishedSchedule
- מחיקת כל הרשומות הישנות לפני שמירת החדשה

---

### 5.2 דוח עבודה תקופתי

**קובץ:** `components/reports/PeriodWorkReport.jsx`

#### 5.2.1 פילטרים

- תאריך התחלה וסוף (חובה)
- מקומות עבודה (multi-select עם Command+Popover, ברירת מחדל = הכל)

#### 5.2.2 אגרגציה

```
לכל assignment בטווח:
  key = workplace_name + "__" + date
  
  grouped[key].students.push(assignment)
  
לכל key:
  totalHours = sum(hours)
  avgHours = totalHours / count
  rate = rate של הרשומה הראשונה
  totalPrice = Math.round(totalHours * rate)
```

**סינון:** `SKIP_WORKPLACES = ['לא עובד', 'לימודים']` — לא נכללים

#### 5.2.3 תצוגת הדוח

- מיון: מקומות עבודה לפי שם עברי
- לכל מקום עבודה: טבלה + שורת סה"כ
- כותרת: "לכבוד: {שם מקום עבודה}"

#### 5.2.4 ייצוא

**PDF:** portrait A4, scale=1.5, חיתוך לפי sections
**Excel (XLSX):** 
- עמודות: מקום עבודה, תאריך, תעריף, כמות תלמידים, סך שעות, ממוצע שעות, מחיר
- שורת סיכום לכל מקום עבודה
- שם גיליון: "דוח לתקופה"

---

### 5.3 דוח תלמיד-עבודה (StudentWorkReport)

**קובץ:** `components/reports/StudentWorkReport.jsx`

- פילטור לפי טווח תאריכים + מחזור + תלמידים בודדים (multi-select)
- טבלת ימי עבודה לכל תלמיד עם מקומות עבודה
- ייצוא PDF

---

## 6. אימות ובקרת שגיאות

### 6.1 הודעות שגיאה ואזהרה

| מצב | הודעה | סוג |
|-----|-------|-----|
| שיבוץ לאתר אסור | `⛔ לא ניתן לשבץ את {שם} ל-{מקום} — זה מקום עבודה אסור` | alert() |
| שעת יציאה לפני כניסה | `שעת יציאה חייבת להיות מאוחרת משעת כניסה` | Toast אדום (3 שניות) |
| שכפול שלם | `✅ הושלם! שוכפלו {N} שיבוצים לתאריך {date} ({מצב})` | alert() |
| שגיאה בשכפול | `❌ שגיאה בשכפול: {error.message}` | alert() |
| פרסום סידור | badge ירוק: `✓ הסידור פורסם בהצלחה!` | inline |

### 6.2 ולידציות שדה

| שדה | כלל |
|-----|-----|
| TimeInput | שעת יציאה > שעת כניסה |
| Assignment.student_id | לא ניתן לשבץ תלמיד לאתר אסור |
| Clone target date | חובה לבחור תאריך לפני הפעלה |
| Bulk edit | ביצוע רק אם לפחות שדה אחד מלא |

### 6.3 פעולות אטומיות

| פעולה | מנגנון |
|-------|--------|
| שכפול יום | try/finally — setCloning(false) תמיד |
| שמירה מרובה | try/finally — setBulkSaving(false) תמיד |
| דיווח זמנים | try/finally — setSaving(false) תמיד |
| פרסום סידור | try-catch משתמע (AxiosError מוצג לא מנוהל) |

> **הערה:** המערכת **אינה** מבצעת rollback מלא — פעולות שכבר בוצעו לפני השגיאה נשמרות.

---

## 7. ממשקים חיצוניים

### 7.1 Webhook קבלת SMS (019)

**קובץ:** `functions/receiveSMS.js`  
**נתיב:** `/receiveSMS` (Deno Deploy edge function)

#### 7.1.1 בקשה נכנסת

**שיטה:** POST  
**Content-Types נתמכים:**
1. `application/x-www-form-urlencoded`
2. `application/json`
3. טקסט גולמי (ניסיון parse כ-URL-encoded)

**פרמטרים:**
| שם | חובה | תיאור |
|----|------|--------|
| `message` | ✅ | גוף ה-SMS |
| `phone` | ✅ | מספר השולח |
| `date` | ❌ | חותמת זמן קבלה מ-019 |
| `dest` | ❌ | מספר היעד |

#### 7.1.2 עיבוד

1. **ולידציה:** אם `!message || !phone` → 400 Bad Request
2. **ניתוח AI:** קריאה ל-`InvokeLLM` עם prompt בעברית לחילוץ:
   - `student_name` — שם התלמיד
   - `absence_date` — תאריך בפורמט YYYY-MM-DD
   - `reason` — סיבת היעדרות
3. **שמירה:** יצירת רשומת `IncomingSMS` עם `status = 'ממתין'`
4. **תגובה:** `{ success: true }` / `{ error: "..." }`

#### 7.1.3 האזנה

עם מינימום הנדרש — כל SMS שנשלח לנייד המוגדר ב-019 יועבר אוטומטית לכתובת ה-webhook.

---

### 7.2 גיבוי חודשי (Monthly Backup)

**קובץ:** `functions/sendMonthlyBackup.js`  
**הפעלה:** Automation מתוזמן (1 בחודש)

- שולח מייל עם נתוני גיבוי לכתובות מ-BackupSettings.emails

---

### 7.3 עדכון שיבוצים בכמות (Bulk Update)

**קובץ:** `functions/bulkUpdateAssignments.js`

**קלט:**
```json
{
  "toCreate": [{ ...assignmentData }],
  "toUpdate": [{ "id": "...", "fullRecord": { ...data } }]
}
```

**פעולה:** יצירה ועדכון של רשומות Assignment בכמות.

---

## 8. ארכיטקטורת קבצים

```
src/
├── App.jsx                          # Router ראשי
├── index.css                        # משתני CSS + Tailwind
├── tailwind.config.js               # ערכות עיצוב
├── main.jsx                         # נקודת כניסה React
│
├── api/
│   └── base44Client.js              # SDK מאותחל
│
├── lib/
│   ├── AuthContext.jsx              # ספק Auth
│   ├── PageNotFound.jsx             # 404
│   ├── query-client.js              # React Query instance
│   └── utils.js                     # cn() utility
│
├── entities/
│   ├── Assignment.json
│   ├── BackupSettings.json
│   ├── FarmerRequest.json
│   ├── IncomingSMS.json
│   ├── PublishedSchedule.json
│   ├── Role.json
│   ├── Student.json
│   ├── TimeReport.json
│   ├── Vehicle.json
│   ├── Workplace.json
│   └── WorkplaceLogistics.json
│
├── functions/
│   ├── bulkUpdateAssignments.js
│   ├── cleanupDuplicateAssignments.js
│   ├── fixIncorrectAssignments.js
│   ├── onStudentDeactivated.js
│   ├── receiveSMS.js
│   └── sendMonthlyBackup.js
│
├── pages/
│   ├── AbsenceRequests.jsx
│   ├── Assignments.jsx
│   ├── Calendar.jsx
│   ├── Dashboard.jsx
│   ├── PublicSchedule.jsx
│   ├── Reports.jsx
│   ├── Roles.jsx
│   ├── Students.jsx
│   ├── TimeReporting.jsx
│   ├── TimeReportsAdmin.jsx
│   ├── Vehicles.jsx
│   └── Workplaces.jsx
│
└── components/
    ├── Layout.jsx
    ├── UserNotRegisteredError.jsx
    ├── assignments/
    │   ├── LogisticsSidebar.jsx
    │   └── VehicleSlot.jsx
    ├── reports/
    │   ├── DailyReportPDFButton.jsx
    │   ├── DailyAssignmentReport.jsx
    │   ├── PeriodWorkReport.jsx
    │   ├── StudentWorkReport.jsx
    │   ├── TimeReportingLink.jsx
    │   ├── BackupEmailSettings.jsx
    │   ├── BackupExport.jsx
    │   ├── ImportAssignments.jsx
    │   ├── PeriodicWorkReport.jsx
    │   └── PublishedScheduleCard.jsx
    ├── students/
    │   ├── ForbiddenWorkplacesCell.jsx
    │   ├── ImportModal.jsx
    │   ├── ImportPhonesModal.jsx
    │   └── StudentFormModal.jsx
    ├── vehicles/
    │   └── ImportVehiclesModal.jsx
    ├── workplaces/
    │   └── ImportWorkplacesModal.jsx
    └── ui/                          # shadcn/ui components
```

---

## 9. אינדקס מונחים ורכיבים

> מסודר לפי א'-ב' (עברית), ולאחר מכן לפי A-Z (אנגלית).

### א

**אאא- לפני שיבוץ** — ערך distance_status לתלמיד שטרם שובץ. ראה: [Sunday Rule](#313-כלל-יום-ראשון-sunday-rule)

**אחראי פק"ל** — תפקיד. מוצג בעמודה נפרדת בדוח ה-PDF. ראה: [Role](#25-ישות-role-תפקיד)

**אישור דיווחי זמנים** — ראה: [TimeReportsAdmin](#49-עמוד-אישור-זמנים-timereportsadmin)

**אתר אסור** — `forbidden_workplaces` ב-Student. ראה: [ניהול שיבוץ](#33-ניהול-שיבוץ-ומניעת-שיבוץ-לאתר-אסור)

### ב

**בקשות היעדרות** — ראה: [AbsenceRequests](#46-עמוד-בקשות-היעדרות-absencerequests)

**ברירת מחדל שעות עבודה** — `07:00 – 11:45`. ראה: [TimeReport](#27-ישות-timereport-דיווח-זמנים)

### ג

**גיבוי חודשי** — ראה: [sendMonthlyBackup](#72-גיבוי-חודשי-monthly-backup)

**גרפיקת התקדמות** — Overlay SVG עגול + פס + אחוזים בדיווח זמנים. ראה: [דיווח זמנים](#481-שליחת-דיווח-timereporting)

### ד

**דיווח זמנים** — ראה: [TimeReporting](#48-עמוד-דיווח-זמנים-timereporting)

**דיווח תקופתי** — ראה: [PeriodWorkReport](#52-דוח-עבודה-תקופתי)

**דנורמליזציה (Denormalization)** — שמירת שם מקום עבודה/תלמיד ישירות ברשומת Assignment לנוחות שאילתות.

### ה

**השבתת מחזור** — כפתור בדף תלמידים להשבית קבוצה שלמה.

### ו

**ולידציה שעות** — ראה: [ולידציה שעות](#483-ולידציה-שעות)

### י

**יום ראשון** — ראה: [Sunday Rule](#313-כלל-יום-ראשון-sunday-rule)

**ייצוא Excel** — ראה: [דוח תקופתי ייצוא](#524-ייצוא)

**ייצוא PDF** — ראה: [דוח יומי](#513-ייצוא-pdf), [דוח תקופתי](#524-ייצוא)

### כ

**כלל ראשון** — מיפוי distance_status → workplace ביום ראשון. ראה: [Sunday Rule](#313-כלל-יום-ראשון-sunday-rule)

**כפילויות** — מנגנון dedup לפי updated_date. ראה: [Assignment](#23-ישות-assignment-שיבוץ)

### ל

**לא עובד / לימודים / לא יצא** — מקומות עבודה מיוחדים המסוננים מדוחות. ראה: [Workplace](#22-ישות-workplace-מקום-עבודה)

**לוגיסטיקה** — ראה: [LogisticsSidebar](#47-סיידבר-לוגיסטיקה-logisticssidebar)

**localStorage** — שמירת מצב "נשלח" לדיווח זמנים. ראה: [TimeReporting](#484-מצב-נשלח)

### מ

**מחזור** — cohort ב-Student. קבוצת תלמידים.

**מנוע דוחות** — ראה: [פרק 5](#5-מנוע-דוחות)

**מקום עבודה** — ראה: [Workplace](#22-ישות-workplace-מקום-עבודה)

### נ

**נהג** — תפקיד. מוצג בדוח PDF. ראה: [buildReportGroups](#511-בנית-הדוח)

### ס

**סידור עבודה יומי (PDF)** — ראה: [DailyReportPDFButton](#51-דוח-סידור-עבודה-יומי-pdf)

**סיידבר לוגיסטיקה** — ראה: [LogisticsSidebar](#47-סיידבר-לוגיסטיקה-logisticssidebar)

**סטטוס מרחק** — distance_status ב-Student. ראה: [Student](#21-ישות-student-תלמיד)

### ע

**עריכה מרובה (Bulk Edit)** — ראה: [עריכה מרובה](#34-עריכה-מרובה-bulk-edit)

### פ

**פרסום סידור** — ראה: [PublishedSchedule](#210-ישות-publishedschedule-סידור-מפורסם)

### ק

**קרוב/רחוק** — ערכי distance_status. ראה: [Sunday Rule](#313-כלל-יום-ראשון-sunday-rule)

### ר

**ראש צוות** — תפקיד. מוצג בדוח PDF.

**רכב** — ראה: [Vehicle](#24-ישות-vehicle-רכב)

### ש

**שכפול יום** — ראה: [Clone Day](#31-מנגנון-שכפול-יום-clone-day)

**שיבוץ** — ראה: [Assignment](#23-ישות-assignment-שיבוץ)

**שיבוץ יומי (guest)** — ראה: [תלמיד יומי](#23-ישות-assignment-שיבוץ)

### ת

**תלמיד** — ראה: [Student](#21-ישות-student-תלמיד)

**תלמיד יומי** — ראה: [Assignment — Guest](#23-ישות-assignment-שיבוץ)

**תפקיד** — ראה: [Role](#25-ישות-role-תפקיד)

---

### A–Z

**Assignment** — ראה: [ישות Assignment](#23-ישות-assignment-שיבוץ)

**BackupSettings** — ראה: [ישות BackupSettings](#211-ישות-backupsettings-הגדרות-גיבוי)

**bulkUpdateAssignments** — ראה: [7.3](#73-עדכון-שיבוצים-בכמות-bulk-update)

**Clone Day** — ראה: [3.1](#31-מנגנון-שכפול-יום-clone-day)

**Cohort** — ראה: מחזור

**DEFAULT_END / DEFAULT_START** — קבועים `"07:00"`, `"11:45"`. ראה: [TimeReport](#27-ישות-timereport-דיווח-זמנים)

**Denormalization** — ראה: דנורמליזציה

**DailyReportPDFButton** — ראה: [5.1](#51-דוח-סידור-עבודה-יומי-pdf)

**EditableNumberCell** — תא טבלה עם עריכה inline. ראה: [4.2.3](#423-טבלת-שיבוצים)

**FarmerRequest** — ראה: [ישות FarmerRequest](#29-ישות-farmerrequest-בקשת-חקלאי)

**forbidden_workplaces** — ראה: אתר אסור

**guest_** — prefix של student_id לתלמיד יומי. ראה: [Assignment](#23-ישות-assignment-שיבוץ)

**handleCloneDay** — ראה: [Clone Day](#31-מנגנון-שכפול-יום-clone-day)

**html2canvas** — ספריית יצירת תמונה מ-DOM. גרסה: `^1.4.1`

**IncomingSMS** — ראה: [ישות IncomingSMS](#28-ישות-incomingsms-sms-נכנס)

**jsPDF** — ספריית יצירת PDF. גרסה: `^4.0.0`

**LogisticsSidebar** — ראה: [4.7](#47-סיידבר-לוגיסטיקה-logisticssidebar)

**NON_WORK** — `['לא עובד', 'לימודים', 'לא יצא']`. ראה: [Workplace](#22-ישות-workplace-מקום-עבודה)

**PeriodWorkReport** — ראה: [5.2](#52-דוח-עבודה-תקופתי)

**PublishedSchedule** — ראה: [ישות PublishedSchedule](#210-ישות-publishedschedule-סידור-מפורסם)

**receiveSMS** — ראה: [7.1](#71-webhook-קבלת-sms-019)

**Role** — ראה: [ישות Role](#25-ישות-role-תפקיד)

**RTL** — כיוון ממשק (ימין לשמאל). `dir="rtl"` על `<body>`.

**SKIP_WORKPLACES** — `['לא עובד', 'לימודים']`. ראה: [PeriodWorkReport](#52-דוח-עבודה-תקופתי)

**Student** — ראה: [ישות Student](#21-ישות-student-תלמיד)

**Sunday Rule** — ראה: [3.1.3](#313-כלל-יום-ראשון-sunday-rule)

**TimeInput** — רכיב React לקלט שעה עם commit pattern. ראה: [4.8.1](#481-שליחת-דיווח-timereporting)

**TimeReport** — ראה: [ישות TimeReport](#27-ישות-timereport-דיווח-זמנים)

**TimeReporting** — ראה: [4.8](#48-עמוד-דיווח-זמנים-timereporting)

**TimeReportsAdmin** — ראה: [4.9](#49-עמוד-אישור-זמנים-timereportsadmin)

**Upsert** — CREATE אם לא קיים, UPDATE אם קיים. ראה: [Clone Day](#314-upsert-logic)

**Vehicle** — ראה: [ישות Vehicle](#24-ישות-vehicle-רכב)

**VehicleSlot** — רכיב בחירת רכב בסיידבר. ראה: [4.7.3](#473-vehicleslot)

**Workplace** — ראה: [ישות Workplace](#22-ישות-workplace-מקום-עבודה)

**WorkplaceGroup** — רכיב קבוצת מקום עבודה בדיווח זמנים. ראה: [4.8.2](#482-workplacegroup)

**WorkplaceLogistics** — ראה: [ישות WorkplaceLogistics](#26-ישות-workplacelogistics-לוגיסטיקה)

**XLSX** — ספריית Excel. גרסה: `^0.18.5`

---

*מסמך זה נוצר אוטומטית ב-2026-05-11 על בסיס קוד המערכת.*  
*גרסה: 1.0 | שפה: עברית | כיוון: RTL*