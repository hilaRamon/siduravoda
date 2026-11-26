export function toHebrewWeekday(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("he-IL", {
    weekday: "long",
  });
}

export function toHebrewDate(dateStr) {
  try {
    const d = new Date(dateStr + "T12:00:00");
    const formatter = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const formatted = formatter.format(d);

    // המרה של מספרים לגימטריה עברית
    const hebrewDigits = [
      "",
      "א",
      "ב",
      "ג",
      "ד",
      "ה",
      "ו",
      "ז",
      "ח",
      "ט",
      "י",
      "י״א",
      "י״ב",
      "י״ג",
      "י״ד",
      "ט״ו",
      "ט״ז",
      "י״ז",
      "י״ח",
      "י״ט",
      "כ",
      "כ״א",
      "כ״ב",
      "כ״ג",
      "כ״ד",
      "כ״ה",
      "כ״ו",
      "כ״ז",
      "כ״ח",
      "כ״ט",
      "ל",
    ];
    const parts = formatted.split(" ");

    if (parts.length >= 3 && !Number.isNaN(Number(parts[0]))) {
      const day = parseInt(parts[0]);
      const year = parseInt(parts[parts.length - 1]);
      const month = parts.slice(1, -1).join(" ");

      const dayHebrew = hebrewDigits[day] || parts[0];
      const yearHebrew = year
        .toString()
        .split("")
        .map((d, i, arr) => {
          const num = parseInt(d);
          if (i === arr.length - 1) return hebrewDigits[num] || d;
          return hebrewDigits[num * Math.pow(10, arr.length - i - 1)] || d;
        })
        .join("");

      return `${dayHebrew} ${month} תשפ"${hebrewDigits[year % 10]}`;
    }

    return formatted;
  } catch {
    return "";
  }
}

export function toGregDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
