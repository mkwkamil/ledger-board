/** Email prowadzącego — ustaw w `.env` jako `VITE_ADMIN_EMAIL`. */
export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? "").trim();

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!ADMIN_EMAIL) return false;
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
