import { cn } from "../../lib/utils";

export interface MobileRecordField {
  label: string;
  value: React.ReactNode;
}

/**
 * Card shown by `DataTable` (`renderMobileCard`) below `sm` in place of a table row: a title (opens
 * the record when `onOpen` is given), an optional right-aligned figure, badges, label/value pairs and
 * an actions row. Presentation only — callers pass already-translated text.
 */
export function MobileRecordCard({
  title,
  subtitle,
  trailing,
  badges,
  fields,
  actions,
  onOpen,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  badges?: React.ReactNode;
  fields?: MobileRecordField[];
  actions?: React.ReactNode;
  onOpen?: () => void;
  className?: string;
}) {
  const heading = (
    <span className="flex min-w-0 flex-col gap-0.5 text-left">
      <span className="truncate text-sm font-medium text-foreground">{title}</span>
      {subtitle ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
    </span>
  );

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-3", className)}>
      <div className="flex items-start justify-between gap-3">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {heading}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{heading}</div>
        )}
        {trailing ? <div className="shrink-0 text-sm font-semibold text-foreground">{trailing}</div> : null}
      </div>
      {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
      {fields && fields.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {fields.map((field) => (
            <div key={field.label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="truncate text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {actions ? <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-border pt-3">{actions}</div> : null}
    </div>
  );
}
