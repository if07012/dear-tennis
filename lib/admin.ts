// ============================================
// ADMIN EMAIL CONSTANT (client-safe)
// ============================================
// `process.env.ADMIN_EMAIL` is only available on the server. To gate UI in a
// client component (e.g. Navbar's "Admin" link) we mirror it as
// `NEXT_PUBLIC_ADMIN_EMAIL` and read it here.

export const ADMIN_EMAIL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase()) ||
  '';

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!ADMIN_EMAIL || !email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}
