const STORAGE_KEY = "schedule_access";

export function readScheduleAccessToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveScheduleAccessToken(token, remember) {
  clearScheduleAccessToken();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(STORAGE_KEY, token);
}

export function clearScheduleAccessToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage can be unavailable in private mode
  }
}
