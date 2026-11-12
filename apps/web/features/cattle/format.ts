/** Figma "Cattle" list's Age column ("2.3 years" / "1 year" / "5 months") — computed client-side
 * from `dateOfBirth` since the backend doesn't return a precomputed age. `t` must resolve
 * `cattle.age.years`/`cattle.age.year`/`cattle.age.months`/`cattle.age.month`. */
export function formatCattleAge(
  dateOfBirth: string | null,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): string {
  if (!dateOfBirth) return "—";
  const days = (Date.now() - new Date(dateOfBirth).getTime()) / 86_400_000;
  if (days < 0) return "—";
  const years = days / 365.25;
  if (years >= 1) {
    const rounded = Math.round(years * 10) / 10;
    return t(rounded === 1 ? "age.year" : "age.years", { value: rounded });
  }
  const months = Math.max(1, Math.round(days / 30.44));
  return t(months === 1 ? "age.month" : "age.months", { value: months });
}
