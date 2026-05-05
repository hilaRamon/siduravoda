import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    // 019 sends POST with form-encoded or JSON body
    const contentType = req.headers.get('content-type') || '';
    let params = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const urlParams = new URLSearchParams(text);
      for (const [k, v] of urlParams.entries()) {
        params[k] = v;
      }
    } else if (contentType.includes('application/json')) {
      params = await req.json();
    } else {
      // Try form first, fallback to text
      const text = await req.text();
      try {
        const urlParams = new URLSearchParams(text);
        for (const [k, v] of urlParams.entries()) {
          params[k] = v;
        }
      } catch {
        // ignore
      }
    }

    const { message, date: smsDate, phone, dest } = params;

    if (!message || !phone) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use service role to save (no user auth in webhook context)
    const base44 = createClientFromRequest(req);

    // Parse with AI
    const today = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const parsed = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `אתה מנתח הודעות SMS מתלמידים בישראל שרוצים לבקש היעדרות.
      
הודעת SMS: "${message}"
תאריך היום: ${today}

חלץ מהטקסט את השדות הבאים. אם שדה לא מוזכר - החזר null.
שים לב: תאריך היעדרות יכול להיות "מחר", "ביום שישי", "ה-10", תאריך מלא וכו' - המר לפורמט YYYY-MM-DD.`,
      response_json_schema: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "שם התלמיד אם הוזכר, אחרת null" },
          absence_date: { type: "string", description: "תאריך היעדרות בפורמט YYYY-MM-DD, אחרת null" },
          reason: { type: "string", description: "סיבת ההיעדרות אם הוזכרה, אחרת null" }
        }
      }
    });

    await base44.asServiceRole.entities.IncomingSMS.create({
      phone,
      dest: dest || '',
      message,
      sms_date: smsDate || new Date().toISOString(),
      parsed_student_name: parsed?.student_name || null,
      parsed_date: parsed?.absence_date || null,
      parsed_reason: parsed?.reason || null,
      status: 'ממתין'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});