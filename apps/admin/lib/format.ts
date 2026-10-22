const TIME_ZONE = "Asia/Dhaka";

/** Admin screens show times in the team's zone (Bangladesh) and say so; ISO strings come from the API in UTC. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }).format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TIME_ZONE }).format(date);
}

export const formatCount = (n: number): string => new Intl.NumberFormat("en-GB").format(n);

/** "Dhaka, Dhaka Division" style location; empty parts are skipped. */
export function formatLocation(...parts: (string | null | undefined)[]): string {
  const text = parts.filter((p): p is string => !!p && p.trim().length > 0).join(", ");
  return text || "-";
}

/** SUPPORT_ADMIN -> "support admin". */
export const humanizeEnum = (value: string): string => value.replace(/_/g, " ").toLowerCase();

export const TIME_ZONE_LABEL = "Bangladesh time (UTC+6)";
