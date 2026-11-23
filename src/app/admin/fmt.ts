// Admin dates are shown in local shop time.
export const ADMIN_TZ = "Asia/Jerusalem";

export function fmtDate(iso: string, withYear = false) {
  return new Date(iso).toLocaleString("ar-u-nu-latn", {
    timeZone: ADMIN_TZ,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayKey(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ADMIN_TZ });
}
