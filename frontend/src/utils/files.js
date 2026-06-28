/** Authenticated upload URL (session cookie required). */
export function uploadUrl(filename) {
  if (!filename) return null;
  return `/api/files/${encodeURIComponent(filename)}`;
}
