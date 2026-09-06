const ISRAEL_TZ = "Asia/Jerusalem";
const PUBLISH_HOUR = 16;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function addCalendarDays(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function getTimeZoneOffsetMs(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - instant.getTime();
}

export function zonedDateTimeToUtc(
  dateStr,
  hour,
  minute = 0,
  timeZone = ISRAEL_TZ,
) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = wallAsUtc;
  for (let i = 0; i < 2; i += 1) {
    const offset = getTimeZoneOffsetMs(new Date(instant), timeZone);
    instant = wallAsUtc - offset;
  }
  return new Date(instant);
}

export function getScheduleVisibleDate(dateStr) {
  return addCalendarDays(dateStr, -1);
}

export function getScheduleVisibleAt(dateStr) {
  return zonedDateTimeToUtc(getScheduleVisibleDate(dateStr), PUBLISH_HOUR, 0);
}

export function isScheduleVisible(dateStr, now = new Date()) {
  return now.getTime() >= getScheduleVisibleAt(dateStr).getTime();
}

export function formatDayMonth(dateStr) {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export { ISRAEL_TZ, PUBLISH_HOUR };
