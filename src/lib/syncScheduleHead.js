const SCHEDULE_META_DESCRIPTION_ID = 'schedule-meta-description';
const SCHEDULE_CANONICAL_ID = 'schedule-canonical';
const SCHEDULE_DESCRIPTION = 'סידור העבודה היומי של רגבים בעמק. צפייה בשיבוץ שפורסם.';

export function removeScheduleHead() {
  document.getElementById(SCHEDULE_META_DESCRIPTION_ID)?.remove();
  document.getElementById(SCHEDULE_CANONICAL_ID)?.remove();
}

export function syncScheduleHead(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path !== '/schedule') {
    removeScheduleHead();
    return;
  }

  let description = document.getElementById(SCHEDULE_META_DESCRIPTION_ID);
  if (!description) {
    description = document.createElement('meta');
    description.id = SCHEDULE_META_DESCRIPTION_ID;
    description.setAttribute('name', 'description');
    document.head.appendChild(description);
  }
  description.setAttribute('content', SCHEDULE_DESCRIPTION);

  let canonical = document.getElementById(SCHEDULE_CANONICAL_ID);
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.id = SCHEDULE_CANONICAL_ID;
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', new URL('/schedule', window.location.origin).href);
}
