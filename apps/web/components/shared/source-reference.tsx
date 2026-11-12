import Link from "next/link";
import { cn } from "@/lib/utils";

/** RAKHAL-392 (MILESTONE 22, `BUSINESS_IA_PRD.md` §5.14) — one shared renderer for "this row came
 * from that operational record": a `Link` when `href` is present, plain text otherwise (never a
 * broken link). Every money-row table (Transactions/Invoices/Purchases/Expenses) renders its
 * reference cell through this instead of an ad-hoc inline `<Link>`/text branch, so drill-through
 * behavior — and its "no href yet" fallback — stays in one place. */
export function SourceReference({
  label,
  href,
  className,
}: {
  label: string;
  href: string | null | undefined;
  className?: string;
}) {
  if (href) {
    return (
      <Link href={href} className={cn("text-sm font-medium text-primary hover:underline", className)}>
        {label}
      </Link>
    );
  }
  return <span className={cn("text-sm font-medium text-foreground", className)}>{label}</span>;
}
