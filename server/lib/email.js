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

function formatExportDateLabel(exportDateStr) {
  return formatHebrewDate(exportDateStr);
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

export async function sendWeeklyBackupToRecipients({ recipients, exportDateStr, zipBuffer, zipFilename }) {
  const label = formatExportDateLabel(exportDateStr);
  const subject = `גיבוי שבועי — ${label}`;
  const body =
    `שלום,\n\nמצורף גיבוי שבועי מתאריך ${exportDateStr}.\n\n` +
    `• שיבוצים — קובץ Excel אחד עם כל השיבוצים במערכת (ממוין לפי תאריך)\n` +
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

export async function sendVerificationToRecipients({ recipients, exportDateStr, zipBuffer, zipFilename }) {
  const label = formatExportDateLabel(exportDateStr);
  const subject = `אימות כתובת גיבוי — ${label}`;
  const body =
    `שלום,\n\nנוספת כתובת זו לרשימת הגיבוי השבועי.\n\n` +
    `מצורף גיבוי עדכני (${exportDateStr}) לאימות שהכתובת פעילה.\n\n` +
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
