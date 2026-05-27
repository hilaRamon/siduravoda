/** Routes that do not require sign-in */
export const PUBLIC_PATHS = ['/login', '/schedule'];

export function isPublicPath(pathname) {
  const path = (pathname || '').replace(/\/$/, '') || '/';
  return PUBLIC_PATHS.includes(path);
}
