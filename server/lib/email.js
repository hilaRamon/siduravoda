import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function getFromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_USER;
}

function formatHebrewDate(dateStr) {
  const date = dateStr ? new Date(`${dateStr}T12:00:00`) : new Date();
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekRangeLabel(weekRange) {
  if (!weekRange) return "";
  const { startStr, endStr } = weekRange;
  if (startStr === endStr) return formatHebrewDate(endStr);
  return `${formatHebrewDate(startStr)} – ${formatHebrewDate(endStr)}`;
}

async function sendBackupEmail({ to, subject, body, zipBuffer, zipFilename }) {
  const transporter = getTransporter();

  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text: body,
    attachments: [
      {
        filename: zipFilename,
        content: zipBuffer,
        contentType: "application/zip",
      },
    ],
  });
}

export async function sendWeeklyBackupToRecipients({ recipients, weekRange, zipBuffer, zipFilename }) {
  const label = formatWeekRangeLabel(weekRange);
  const subject = `גיבוי שבועי — ${label}`;
  const body =
    `שלום,\n\nמצורף גיבוי שבועי לתקופה ${weekRange.startStr} עד ${weekRange.endStr}.\n\n` +
    `• שיבוצים — קובץ Excel נפרד לכל יום בשבוע\n` +
    `• תלמידים, מקומות עבודה ורכבים — מצב עדכני\n\n` +
    `נשלח אוטומטית מהמערכת — רגבים.`;

  const results = {};
  for (const email of recipients) {
    try {
      await sendBackupEmail({ to: email, subject, body, zipBuffer, zipFilename });
      results[email] = { success: true };
    } catch (error) {
      results[email] = { success: false, error: error?.message || String(error) };
      console.error(`Failed to send weekly backup to ${email}:`, error?.message);
    }
  }

  return results;
}

export async function sendVerificationToRecipients({ recipients, weekRange, zipBuffer, zipFilename }) {
  const label = formatWeekRangeLabel(weekRange);
  const subject = `אימות כתובת גיבוי — ${label}`;
  const body =
    `שלום,\n\nנוספת כתובת זו לרשימת הגיבוי השבועי.\n\n` +
    `מצורף גיבוי השבוע האחרון (${weekRange.startStr} עד ${weekRange.endStr}) לאימות שהכתובת פעילה.\n\n` +
    `מעתה תקבלו גיבוי אוטומטי בכל יום ראשון בשעה 9:00.\n\n` +
    `נשלח מהמערכת — רגבים.`;

  const results = {};
  for (const email of recipients) {
    try {
      await sendBackupEmail({ to: email, subject, body, zipBuffer, zipFilename });
      results[email] = { success: true };
    } catch (error) {
      results[email] = { success: false, error: error?.message || String(error) };
      console.error(`Failed to send verification backup to ${email}:`, error?.message);
    }
  }

  return results;
}
